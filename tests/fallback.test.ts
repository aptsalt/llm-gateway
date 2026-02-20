import { describe, it, expect, beforeEach } from "vitest";
import { FallbackChain } from "../src/reliability/fallback.js";
import { ProviderRegistry } from "../src/providers/registry.js";
import { CircuitBreakerManager } from "../src/reliability/circuit-breaker.js";
import type { LLMProvider, ChatCompletionResult, ChatChunk, ModelInfo, HealthStatus, CostEstimate } from "../src/providers/interface.js";
import type { ChatRequest } from "../src/gateway/validator.js";

class MockProvider implements LLMProvider {
  readonly id: string;
  readonly name: string;
  shouldFail: boolean;
  callCount = 0;

  constructor(id: string, shouldFail = false) {
    this.id = id;
    this.name = id;
    this.shouldFail = shouldFail;
  }

  async chat(_request: ChatRequest): Promise<ChatCompletionResult> {
    this.callCount++;
    if (this.shouldFail) {
      throw new Error(`${this.id} failed`);
    }
    return {
      content: `Response from ${this.id}`,
      finishReason: "stop",
      usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
      model: "mock-model",
    };
  }

  async *chatStream(_request: ChatRequest): AsyncIterable<ChatChunk> {
    yield { content: "mock", finishReason: "stop" };
  }

  async listModels(): Promise<ModelInfo[]> {
    return [];
  }

  async healthCheck(): Promise<HealthStatus> {
    return { healthy: !this.shouldFail, latencyMs: 100 };
  }

  estimateCost(_request: ChatRequest): CostEstimate {
    return { estimatedInputTokens: 10, estimatedOutputTokens: 20, estimatedCostUsd: 0.001 };
  }
}

function makeRequest(): ChatRequest {
  return {
    model: "auto",
    messages: [{ role: "user", content: "Hello" }],
    stream: false,
    "x-cache": true,
    n: 1,
  };
}

describe("FallbackChain", () => {
  let registry: ProviderRegistry;
  let circuitBreakers: CircuitBreakerManager;
  let fallbackChain: FallbackChain;
  let providerA: MockProvider;
  let providerB: MockProvider;
  let providerC: MockProvider;

  beforeEach(async () => {
    registry = new ProviderRegistry();
    circuitBreakers = new CircuitBreakerManager();

    providerA = new MockProvider("provider-a");
    providerB = new MockProvider("provider-b");
    providerC = new MockProvider("provider-c");

    registry.register(providerA);
    registry.register(providerB);
    registry.register(providerC);
    await registry.runHealthChecks();

    fallbackChain = new FallbackChain(registry, circuitBreakers, 3);
  });

  it("returns result from primary provider on success", async () => {
    const result = await fallbackChain.execute(
      makeRequest(),
      providerA,
      ["provider-a", "provider-b", "provider-c"]
    );

    expect(result.provider.id).toBe("provider-a");
    expect(result.fallbackUsed).toBe(false);
    expect(result.result.content).toContain("provider-a");
    expect(result.attempts).toHaveLength(1);
  });

  it("falls back to next provider on failure", async () => {
    providerA.shouldFail = true;

    const result = await fallbackChain.execute(
      makeRequest(),
      providerA,
      ["provider-a", "provider-b", "provider-c"]
    );

    expect(result.provider.id).toBe("provider-b");
    expect(result.fallbackUsed).toBe(true);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]!.success).toBe(false);
    expect(result.attempts[1]!.success).toBe(true);
  });

  it("tries multiple fallbacks", async () => {
    providerA.shouldFail = true;
    providerB.shouldFail = true;

    const result = await fallbackChain.execute(
      makeRequest(),
      providerA,
      ["provider-a", "provider-b", "provider-c"]
    );

    expect(result.provider.id).toBe("provider-c");
    expect(result.fallbackUsed).toBe(true);
    expect(result.attempts).toHaveLength(3);
  });

  it("throws when all providers fail", async () => {
    providerA.shouldFail = true;
    providerB.shouldFail = true;
    providerC.shouldFail = true;

    await expect(
      fallbackChain.execute(
        makeRequest(),
        providerA,
        ["provider-a", "provider-b", "provider-c"]
      )
    ).rejects.toThrow("All providers failed");
  });

  it("skips providers with open circuit breaker", async () => {
    providerA.shouldFail = true;

    // Trip circuit breaker for provider-b
    for (let i = 0; i < 5; i++) {
      circuitBreakers.recordFailure("provider-b");
    }

    const result = await fallbackChain.execute(
      makeRequest(),
      providerA,
      ["provider-a", "provider-b", "provider-c"]
    );

    expect(result.provider.id).toBe("provider-c");
    expect(providerB.callCount).toBe(0);
  });

  it("records attempt details for each provider", async () => {
    providerA.shouldFail = true;

    const result = await fallbackChain.execute(
      makeRequest(),
      providerA,
      ["provider-a", "provider-b"]
    );

    expect(result.attempts[0]!.providerId).toBe("provider-a");
    expect(result.attempts[0]!.success).toBe(false);
    expect(result.attempts[0]!.errorMessage).toBeDefined();
    expect(result.attempts[0]!.latencyMs).toBeGreaterThanOrEqual(0);

    expect(result.attempts[1]!.providerId).toBe("provider-b");
    expect(result.attempts[1]!.success).toBe(true);
    expect(result.attempts[1]!.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
