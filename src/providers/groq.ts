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

interface GroqChatResponse {
  id: string;
  choices: Array<{
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  model: string;
}

interface GroqStreamChunk {
  id: string;
  choices: Array<{
    delta: { role?: string; content?: string };
    finish_reason: string | null;
  }>;
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "llama-3.3-70b-versatile": { input: 0.00059, output: 0.00079 },
  "llama-3.1-8b-instant": { input: 0.00005, output: 0.00008 },
  "mixtral-8x7b-32768": { input: 0.00024, output: 0.00024 },
  "gemma2-9b-it": { input: 0.0002, output: 0.0002 },
};

export class GroqProvider implements LLMProvider {
  readonly id = "groq";
  readonly name = "Groq";
  private apiKey: string;
  private baseUrl = "https://api.groq.com/openai/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? env.GROQ_API_KEY ?? "";
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
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Groq error: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as GroqChatResponse;
    const choice = data.choices[0];
    if (!choice) throw new Error("No choices returned from Groq");

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
      throw new Error(`Groq streaming error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from Groq");

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

        const chunk = JSON.parse(payload) as GroqStreamChunk;
        const delta = chunk.choices[0]?.delta;
        if (delta?.content) {
          yield { content: delta.content, finishReason: null };
        }
        if (chunk.choices[0]?.finish_reason) {
          yield { content: "", finishReason: chunk.choices[0].finish_reason as ChatChunk["finishReason"] };
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    return Object.entries(MODEL_COSTS).map(([id, costs]) => ({
      id,
      name: id,
      provider: this.id,
      capabilities: ["general", "instruction-following", "code"] as ModelInfo["capabilities"],
      contextWindow: id.includes("32768") ? 32768 : 131072,
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
    const costs = MODEL_COSTS[model] ?? { input: 0.0003, output: 0.0003 };
    const inputTokens = Math.ceil(request.messages.map((m) => m.content).join(" ").length / 4);
    const outputTokens = request.max_tokens ?? 1000;
    return {
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostUsd: (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output,
    };
  }

  private resolveModel(model: string): string {
    const virtualModels: Record<string, string> = {
      auto: "llama-3.3-70b-versatile",
      fast: "llama-3.1-8b-instant",
      cheap: "llama-3.1-8b-instant",
      quality: "llama-3.3-70b-versatile",
    };
    return virtualModels[model] ?? model;
  }
}
