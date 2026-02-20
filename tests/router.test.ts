import { describe, it, expect, beforeEach } from "vitest";
import { Router, type RoutingDecision } from "../src/router/router.js";
import { ProviderRegistry } from "../src/providers/registry.js";
import type { LLMProvider, ChatCompletionResult, ChatChunk, ModelInfo, HealthStatus, CostEstimate } from "../src/providers/interface.js";
import type { ChatRequest } from "../src/gateway/validator.js";
import { DEFAULT_ROUTING_CONFIG, STRATEGY_PRESETS } from "../src/router/config.js";

class MockProvider implements LLMProvider {
  readonly id: string;
  readonly name: string;
  healthy = true;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  async chat(_request: ChatRequest): Promise<ChatCompletionResult> {
    return {
      content: "mock response",
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "mock-model",
    };
  }

  async *chatStream(_request: ChatRequest): AsyncIterable<ChatChunk> {
    yield { content: "mock", finishReason: "stop" };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [{
      id: "mock-model",
      name: "Mock Model",
      provider: this.id,
      capabilities: ["general", "instruction-following"],
      contextWindow: 4096,
      costPer1kInput: 0,
      costPer1kOutput: 0,
    }];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: this.healthy, latencyMs: 100 };
  }

  estimateCost(_request: ChatRequest): CostEstimate {
    return { estimatedInputTokens: 10, estimatedOutputTokens: 20, estimatedCostUsd: 0.001 };
  }
}

function makeRequest(overrides: Partial<ChatRequest> = {}): ChatRequest {
  return {
    model: "auto",
    messages: [{ role: "user", content: "Hello" }],
    stream: false,
    "x-cache": true,
    n: 1,
    ...overrides,
  };
}

describe("Router", () => {
  let registry: ProviderRegistry;
  let router: Router;

  beforeEach(async () => {
    registry = new ProviderRegistry();
    const ollama = new MockProvider("ollama", "Ollama");
    const openai = new MockProvider("openai", "OpenAI");
    const groq = new MockProvider("groq", "Groq");

    registry.register(ollama);
    registry.register(openai);
    registry.register(groq);
    await registry.runHealthChecks();

    router = new Router(registry, DEFAULT_ROUTING_CONFIG);
  });

  it("routes to a provider for a virtual model", () => {
    const decision = router.route(makeRequest({ model: "auto" }));
    expect(decision).toBeDefined();
    expect(decision.provider).toBeDefined();
    expect(decision.strategy).toBe("balanced");
  });

  it("routes to a specific provider for a specific model", () => {
    const decision = router.route(makeRequest({ model: "gpt-4o" }));
    expect(decision.provider.id).toBe("openai");
    expect(decision.modelId).toBe("gpt-4o");
  });

  it("routes to Anthropic for Claude models", () => {
    const anthropic = new MockProvider("anthropic", "Anthropic");
    registry.register(anthropic);
    void registry.runHealthChecks();

    const decision = router.route(makeRequest({ model: "claude-sonnet-4-20250514" }));
    expect(decision.provider.id).toBe("anthropic");
  });

  it("respects routing strategy override from request", () => {
    const decision = router.route(makeRequest({
      model: "auto",
      "x-routing-strategy": "cost",
    }));
    expect(decision.strategy).toBe("cost");
  });

  it("respects quality strategy", () => {
    router.updateConfig(STRATEGY_PRESETS.quality);
    const decision = router.route(makeRequest({ model: "auto" }));
    expect(decision.strategy).toBe("quality");
    expect(decision.score).toBeGreaterThan(0);
  });

  it("respects latency strategy", () => {
    router.updateConfig(STRATEGY_PRESETS.latency);
    const decision = router.route(makeRequest({ model: "auto" }));
    expect(decision.strategy).toBe("latency");
  });

  it("throws when no healthy providers available", () => {
    // Deregister all providers
    registry.deregister("ollama");
    registry.deregister("openai");
    registry.deregister("groq");

    expect(() => router.route(makeRequest())).toThrow("No healthy providers available");
  });

  it("prefers local provider when configured", () => {
    router.updateConfig({
      ...DEFAULT_ROUTING_CONFIG,
      constraints: { preferLocal: true },
    });
    const decision = router.route(makeRequest({ model: "auto" }));
    // Should prefer ollama if it's competitive
    expect(decision).toBeDefined();
    expect(decision.reasoning).toContain("Local-first");
  });

  it("provides reasoning for routing decision", () => {
    const decision = router.route(makeRequest({ model: "auto" }));
    expect(decision.reasoning).toBeTruthy();
    expect(typeof decision.reasoning).toBe("string");
  });
});
