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

interface AnthropicResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: Array<{ type: "text"; text: string }>;
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence";
  usage: { input_tokens: number; output_tokens: number };
}

interface AnthropicStreamEvent {
  type: string;
  delta?: { type: string; text?: string; stop_reason?: string };
  message?: AnthropicResponse;
  content_block?: { type: string; text: string };
}

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  "claude-opus-4-20250514": { input: 0.015, output: 0.075 },
  "claude-sonnet-4-20250514": { input: 0.003, output: 0.015 },
  "claude-3-5-haiku-20241022": { input: 0.001, output: 0.005 },
  "claude-3-5-sonnet-20241022": { input: 0.003, output: 0.015 },
};

export class AnthropicProvider implements LLMProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  private apiKey: string;
  private baseUrl = "https://api.anthropic.com/v1";

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? env.ANTHROPIC_API_KEY ?? "";
  }

  async chat(request: ChatRequest): Promise<ChatCompletionResult> {
    const model = this.resolveModel(request.model);
    const { system, messages } = this.convertMessages(request.messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: request.max_tokens ?? 4096,
        system,
        messages,
        temperature: request.temperature,
        top_p: request.top_p,
        stop_sequences: request.stop
          ? Array.isArray(request.stop) ? request.stop : [request.stop]
          : undefined,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic error: ${response.status} ${errorBody}`);
    }

    const data = (await response.json()) as AnthropicResponse;
    const text = data.content.map((c) => c.text).join("");

    return {
      content: text,
      finishReason: data.stop_reason === "end_turn" ? "stop" : "length",
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      model: data.model,
    };
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const model = this.resolveModel(request.model);
    const { system, messages } = this.convertMessages(request.messages);

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: request.max_tokens ?? 4096,
        system,
        messages,
        temperature: request.temperature,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic streaming error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from Anthropic");

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
        const event = JSON.parse(trimmed.slice(6)) as AnthropicStreamEvent;

        if (event.type === "content_block_delta" && event.delta?.text) {
          yield { content: event.delta.text, finishReason: null };
        }
        if (event.type === "message_delta" && event.delta?.stop_reason) {
          yield {
            content: "",
            finishReason: event.delta.stop_reason === "end_turn" ? "stop" : "length",
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
      contextWindow: 200000,
      costPer1kInput: costs.input,
      costPer1kOutput: costs.output,
    }));
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.apiKey) {
      return { healthy: false, latencyMs: 0, message: "No API key configured" };
    }
    // Anthropic doesn't have a lightweight health endpoint, so just validate the key format
    return {
      healthy: this.apiKey.startsWith("sk-ant-"),
      latencyMs: 0,
      message: this.apiKey.startsWith("sk-ant-") ? undefined : "Invalid key format",
    };
  }

  estimateCost(request: ChatRequest): CostEstimate {
    const model = this.resolveModel(request.model);
    const costs = MODEL_COSTS[model] ?? { input: 0.003, output: 0.015 };
    const inputTokens = this.estimateTokens(request.messages.map((m) => m.content).join(" "));
    const outputTokens = request.max_tokens ?? 4096;
    return {
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedCostUsd: (inputTokens / 1000) * costs.input + (outputTokens / 1000) * costs.output,
    };
  }

  private resolveModel(model: string): string {
    const virtualModels: Record<string, string> = {
      auto: "claude-sonnet-4-20250514",
      fast: "claude-3-5-haiku-20241022",
      cheap: "claude-3-5-haiku-20241022",
      quality: "claude-opus-4-20250514",
    };
    return virtualModels[model] ?? model;
  }

  private convertMessages(messages: Array<{ role: string; content: string }>) {
    let system: string | undefined;
    const converted: Array<{ role: string; content: string }> = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = (system ? system + "\n" : "") + msg.content;
      } else {
        converted.push({ role: msg.role, content: msg.content });
      }
    }

    return { system, messages: converted };
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private getCapabilities(model: string): ModelInfo["capabilities"] {
    const base: ModelInfo["capabilities"] = ["general", "instruction-following", "multilingual", "code"];
    if (model.includes("opus") || model.includes("sonnet")) {
      base.push("math", "creative");
    }
    return base;
  }
}
