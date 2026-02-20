import type { ChatRequest } from "../gateway/validator.js";
import type { ChatCompletionResult, LLMProvider } from "../providers/interface.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { CircuitBreakerManager } from "./circuit-breaker.js";
import { getTimeout, withTimeout } from "./timeout.js";

export interface FallbackResult {
  result: ChatCompletionResult;
  provider: LLMProvider;
  attempts: FallbackAttempt[];
  fallbackUsed: boolean;
}

export interface FallbackAttempt {
  providerId: string;
  success: boolean;
  errorMessage?: string;
  latencyMs: number;
}

export class FallbackChain {
  private registry: ProviderRegistry;
  private circuitBreakers: CircuitBreakerManager;
  private maxRetries: number;

  constructor(
    registry: ProviderRegistry,
    circuitBreakers: CircuitBreakerManager,
    maxRetries = 3
  ) {
    this.registry = registry;
    this.circuitBreakers = circuitBreakers;
    this.maxRetries = maxRetries;
  }

  async execute(
    request: ChatRequest,
    primaryProvider: LLMProvider,
    fallbackChain: string[]
  ): Promise<FallbackResult> {
    const attempts: FallbackAttempt[] = [];

    // Try primary provider first
    const primaryResult = await this.tryProvider(primaryProvider, request);
    attempts.push(primaryResult);

    if (primaryResult.success) {
      return {
        result: primaryResult.result!,
        provider: primaryProvider,
        attempts,
        fallbackUsed: false,
      };
    }

    // Try fallback providers with exponential backoff between retries
    const remainingProviders = fallbackChain.filter((id) => id !== primaryProvider.id);
    let retryIndex = 0;

    for (const providerId of remainingProviders) {
      if (attempts.length >= this.maxRetries + 1) break;

      if (!this.circuitBreakers.canExecute(providerId)) {
        attempts.push({
          providerId,
          success: false,
          errorMessage: "Circuit breaker open",
          latencyMs: 0,
        });
        continue;
      }

      const provider = this.registry.get(providerId);
      if (!provider) continue;
      if (!this.registry.isHealthy(providerId)) continue;

      // Exponential backoff: 100ms, 200ms, 400ms...
      if (retryIndex > 0) {
        const backoffMs = Math.min(100 * Math.pow(2, retryIndex - 1), 2000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      const result = await this.tryProvider(provider, request);
      attempts.push(result);
      retryIndex++;

      if (result.success) {
        return {
          result: result.result!,
          provider,
          attempts,
          fallbackUsed: true,
        };
      }
    }

    throw new Error(
      `All providers failed after ${attempts.length} attempts. Details: ${attempts.map((a) => `${a.providerId}: ${a.errorMessage}`).join("; ")}`
    );
  }

  private async tryProvider(
    provider: LLMProvider,
    request: ChatRequest
  ): Promise<FallbackAttempt & { result?: ChatCompletionResult }> {
    const start = Date.now();
    const timeout = getTimeout(provider.id);

    try {
      const result = await withTimeout(
        provider.chat(request),
        timeout.completionTimeoutMs,
        provider.id
      );
      this.circuitBreakers.recordSuccess(provider.id);

      return {
        providerId: provider.id,
        success: true,
        latencyMs: Date.now() - start,
        result,
      };
    } catch (error) {
      this.circuitBreakers.recordFailure(provider.id);
      const message = error instanceof Error ? error.message : "Unknown error";

      return {
        providerId: provider.id,
        success: false,
        errorMessage: message,
        latencyMs: Date.now() - start,
      };
    }
  }
}
