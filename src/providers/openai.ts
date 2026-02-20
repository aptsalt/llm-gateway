import type { ChatRequest } from "../gateway/validator.js";
import type {
  LLMProvider,
  ChatCompletionResult,
  ChatChunk,
  ModelInfo,
  HealthStatus,
  CostEstimate,
} from "./interface.js";
import { env } from "../env.js";

interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}

interface OpenAIStreamChunk {
  id: string;
  choices: Array<{
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "gpt-4o": { input: 0.0025, output: 0.01 },
  "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
  "gpt-4-turbo": { input: 0.01, output: 0.03 },
  "gpt-3.5-turbo": { input: 0.0005, output: 0.0015 },
  "o1": { input: 0.015, output: 0.06 },
  "o1-mini": { input: 0.003, output: 0.012 },
};

export class OpenAIProvider implements LLMProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
  private apiKey: string;
  private baseUrl = "https://api.openai.com/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? env.OPENAI_API_KEY ?? "";
  }

  async chat(request: ChatRequest): Promise<ChatCompletionResult> {
    const model = this.resolveModel(request.model);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: request.top_p,
        stop: request.stop,
        presence_penalty: request.presence_penalty,
        frequency_penalty: request.frequency_penalty,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI error: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error("No choices returned from OpenAI");

    return {
      content: choice.message.content,
      finishReason: choice.finish_reason as ChatCompletionResult["finishReason"],
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      model: data.model,
    };
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const model = this.resolveModel(request.model);
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI streaming error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from OpenAI");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const payload = trimmed.slice(6);
        if (payload === "[DONE]") return;

        const chunk = JSON.parse(payload) as OpenAIStreamChunk;
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield {
            content: delta.content,
            finishReason: null,
          };
        }
        if (chunk.choices[0]?.finish_reason) {
          yield {
            content: "",
            finishReason: chunk.choices[0].finish_reason as ChatChunk["finishReason"],
          };
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return Object.entries(MODEL_COSTS).map(([id, costs]) => ({
      id,
      name: id,
      provider: this.id,
      capabilities: this.getCapabilities(id),
      contextWindow: this.getContextWindow(id),
      costPer1kInput: costs.input,
      costPer1kOutput: costs.output,
    }));
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.apiKey) {
      return { healthy: false, latencyMs: 0, message: "No API key configured" };
    }
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(5000),
      });
      return { healthy: response.ok, latencyMs: Date.now() - start };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: "Connection failed" };
    }
  }

  estimateCost(request: ChatRequest): CostEstimate {
    const model = this.resolveModel(request.model);
    const costs = MODEL_COSTS[model] ?? { input: 0.01, output: 0.03 };
    const inputTokens = this.estimateTokens(request.messages.map((m) => m.content).join(" "));
    const outputTokens = request.max_tokens ?? 1000;
    return {
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostUsd: (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output,
    };
  }

  private resolveModel(model: string): string {
    const virtualModels: Record<string, string> = {
      auto: "gpt-4o",
      fast: "gpt-4o-mini",
      cheap: "gpt-4o-mini",
      quality: "gpt-4o",
    };
    return virtualModels[model] ?? model;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private getCapabilities(model: string): ModelInfo["capabilities"] {
    const base: ModelInfo["capabilities"] = ["general", "instruction-following", "multilingual"];
    if (model.includes("gpt-4")) base.push("code", "math", "creative");
    if (model.includes("o1")) base.push("code", "math");
    return base;
  }

  private getContextWindow(model: string): number {
    if (model.includes("gpt-4o")) return 128000;
    if (model.includes("gpt-4-turbo")) return 128000;
    if (model.includes("gpt-3.5")) return 16385;
    if (model.includes("o1")) return 200000;
    return 128000;
  }
}
