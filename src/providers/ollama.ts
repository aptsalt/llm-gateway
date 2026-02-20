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

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

interface OllamaModel {
  name: string;
  size: number;
  details?: { parameter_size?: string; family?: string };
}

export class OllamaProvider implements LLMProvider {
  readonly id = "ollama";
  readonly name = "Ollama (Local)";
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? env.OLLAMA_URL;
  }

  async chat(request: ChatRequest): Promise<ChatCompletionResult> {
    const model = this.resolveModel(request.model);
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: false,
        options: {
          temperature: request.temperature,
          num_predict: request.max_tokens,
          top_p: request.top_p,
          stop: request.stop ? (Array.isArray(request.stop) ? request.stop : [request.stop]) : undefined,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama error: ${response.status} ${await response.text()}`);
    }

    const data = (await response.json()) as OllamaChatResponse;
    const promptTokens = data.prompt_eval_count ?? this.estimateTokens(request.messages.map((m) => m.content).join(" "));
    const completionTokens = data.eval_count ?? this.estimateTokens(data.message.content);

    return {
      content: data.message.content,
      finishReason: "stop",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      model: data.model,
    };
  }

  async *chatStream(request: ChatRequest): AsyncIterable<ChatChunk> {
    const model = this.resolveModel(request.model);
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: request.messages,
        stream: true,
        options: {
          temperature: request.temperature,
          num_predict: request.max_tokens,
          top_p: request.top_p,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama streaming error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body from Ollama");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const chunk = JSON.parse(line) as OllamaChatResponse;
        yield {
          content: chunk.message.content,
          finishReason: chunk.done ? "stop" : null,
        };
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) return [];

    const data = (await response.json()) as { models: OllamaModel[] };
    return data.models.map((m) => ({
      id: m.name,
      name: m.name,
      provider: this.id,
      capabilities: this.inferCapabilities(m.name),
      contextWindow: this.inferContextWindow(m.name),
      costPer1kInput: 0,
      costPer1kOutput: 0,
    }));
  }

  async healthCheck(): Promise<HealthStatus> {
    const start = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(5000),
      });
      return {
        healthy: response.ok,
        latencyMs: Date.now() - start,
      };
    } catch {
      return { healthy: false, latencyMs: Date.now() - start, message: "Connection failed" };
    }
  }

  estimateCost(_request: ChatRequest): CostEstimate {
    return {
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  private resolveModel(model: string): string {
    const virtualModels: Record<string, string> = {
      auto: "llama3.2",
      fast: "llama3.2",
      cheap: "llama3.2",
    };
    return virtualModels[model] ?? model;
  }

  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  private inferCapabilities(modelName: string): ModelInfo["capabilities"] {
    const caps: ModelInfo["capabilities"] = ["general", "instruction-following"];
    if (modelName.includes("code") || modelName.includes("coder") || modelName.includes("deepseek-coder")) {
      caps.push("code");
    }
    if (modelName.includes("math")) {
      caps.push("math");
    }
    return caps;
  }

  private inferContextWindow(modelName: string): number {
    if (modelName.includes("llama3")) return 8192;
    if (modelName.includes("mistral")) return 32768;
    if (modelName.includes("qwen")) return 32768;
    return 4096;
  }
}
