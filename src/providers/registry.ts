import type { LLMProvider, HealthStatus, ModelInfo } from "./interface.js";

interface ProviderState {
  provider: LLMProvider;
  healthy: boolean;
  lastHealthCheck: number;
  latencyMs: number;
  models: ModelInfo[];
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderState>();
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  register(provider: LLMProvider): void {
    this.providers.set(provider.id, {
      provider,
      healthy: true,
      lastHealthCheck: 0,
      latencyMs: 0,
      models: [],
    });
  }

  deregister(providerId: string): void {
    this.providers.delete(providerId);
  }

  get(providerId: string): LLMProvider | undefined {
    return this.providers.get(providerId)?.provider;
  }

  getState(providerId: string): ProviderState | undefined {
    return this.providers.get(providerId);
  }

  getAll(): LLMProvider[] {
    return Array.from(this.providers.values()).map((s) => s.provider);
  }

  getHealthy(): LLMProvider[] {
    return Array.from(this.providers.values())
      .filter((s) => s.healthy)
      .map((s) => s.provider);
  }

  isHealthy(providerId: string): boolean {
    return this.providers.get(providerId)?.healthy ?? false;
  }

  getLatency(providerId: string): number {
    return this.providers.get(providerId)?.latencyMs ?? Infinity;
  }

  async getAllModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [];
    for (const state of this.providers.values()) {
      if (state.models.length > 0) {
        models.push(...state.models);
      } else {
        try {
          const providerModels = await state.provider.listModels();
          state.models = providerModels;
          models.push(...providerModels);
        } catch {
          // Skip provider if models can't be fetched
        }
      }
    }
    return models;
  }

  findProviderForModel(modelId: string): LLMProvider | undefined {
    // Check virtual model names
    const virtualModels = ["auto", "fast", "cheap", "quality"];
    if (virtualModels.includes(modelId)) {
      // Return first healthy provider for virtual models
      const healthy = this.getHealthy();
      return healthy[0];
    }

    // Check specific model mapping
    for (const state of this.providers.values()) {
      if (!state.healthy) continue;
      for (const model of state.models) {
        if (model.id === modelId) return state.provider;
      }
    }

    // Infer from model name prefix
    if (modelId.startsWith("gpt-") || modelId.startsWith("o1")) {
      return this.get("openai");
    }
    if (modelId.startsWith("claude-")) {
      return this.get("anthropic");
    }
    if (modelId.includes("llama") || modelId.includes("mixtral") || modelId.includes("gemma")) {
      // Check Groq first (faster), then Together, then Ollama
      return this.get("groq") ?? this.get("together") ?? this.get("ollama");
    }

    // Default to Ollama for unrecognized models
    return this.get("ollama");
  }

  async runHealthChecks(): Promise<Map<string, HealthStatus>> {
    const results = new Map<string, HealthStatus>();

    const checks = Array.from(this.providers.entries()).map(async ([id, state]) => {
      try {
        const status = await state.provider.healthCheck();
        state.healthy = status.healthy;
        state.latencyMs = status.latencyMs;
        state.lastHealthCheck = Date.now();
        results.set(id, status);
      } catch {
        state.healthy = false;
        state.lastHealthCheck = Date.now();
        results.set(id, { healthy: false, latencyMs: 0, message: "Health check failed" });
      }
    });

    await Promise.allSettled(checks);
    return results;
  }

  startHealthCheckLoop(intervalMs = 30000): void {
    this.stopHealthCheckLoop();
    // Run immediately
    void this.runHealthChecks();
    void this.refreshModels();
    // Then on interval
    this.healthCheckInterval = setInterval(() => {
      void this.runHealthChecks();
    }, intervalMs);
  }

  stopHealthCheckLoop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  async refreshModels(): Promise<void> {
    for (const state of this.providers.values()) {
      try {
        state.models = await state.provider.listModels();
      } catch {
        // Keep existing models if refresh fails
      }
    }
  }

  getProvidersStatus(): Array<{
    id: string;
    name: string;
    healthy: boolean;
    latencyMs: number;
    modelCount: number;
    lastCheck: number;
  }> {
    return Array.from(this.providers.entries()).map(([id, state]) => ({
      id,
      name: state.provider.name,
      healthy: state.healthy,
      latencyMs: state.latencyMs,
      modelCount: state.models.length,
      lastCheck: state.lastHealthCheck,
    }));
  }
}

export const registry = new ProviderRegistry();
