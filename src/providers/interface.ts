import type { ChatRequest } from "../gateway/validator.js";

export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  content: string;
  finishReason: "stop" | "length" | "content_filter" | null;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model: string;
}

export interface ChatChunk {
  content: string;
  finishReason: "stop" | "length" | "content_filter" | null;
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  capabilities: ModelCapability[];
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

export type ModelCapability =
  | "general"
  | "code"
  | "math"
  | "creative"
  | "instruction-following"
  | "multilingual"
  | "vision";

export interface HealthStatus {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

export interface CostEstimate {
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedCostUsd: number;
}

export interface LLMProvider {
  readonly id: string;
  readonly name: string;
  chat(request: ChatRequest): Promise<ChatCompletionResult>;
  chatStream(request: ChatRequest): AsyncIterable<ChatChunk>;
  listModels(): Promise<ModelInfo[]>;
  healthCheck(): Promise<HealthStatus>;
  estimateCost(request: ChatRequest): CostEstimate;
}
