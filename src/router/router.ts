import type { ChatRequest } from "../gateway/validator.js";
import type { LLMProvider, ModelCapability } from "../providers/interface.js";
import type { ProviderRegistry } from "../providers/registry.js";
import { type ModelProfile, capabilityMap } from "./capabilities.js";
import { classifyRequest } from "./classifier.js";
import { type RoutingConfig, type RoutingStrategy, STRATEGY_PRESETS, DEFAULT_ROUTING_CONFIG } from "./config.js";

export interface RoutingDecision {
  provider: LLMProvider;
  modelId: string;
  strategy: RoutingStrategy;
  score: number;
  reasoning: string;
}

export class Router {
  private registry: ProviderRegistry;
  private config: RoutingConfig;

  constructor(registry: ProviderRegistry, config?: RoutingConfig) {
    this.registry = registry;
    this.config = config ?? DEFAULT_ROUTING_CONFIG;
  }

  updateConfig(config: RoutingConfig): void {
    this.config = config;
  }

  route(request: ChatRequest): RoutingDecision {
    const strategy = (request["x-routing-strategy"] as RoutingStrategy | undefined) ?? this.config.strategy;
    const config = STRATEGY_PRESETS[strategy] ?? this.config;
    const classification = classifyRequest(request.messages);
    const preferredProvider = request["x-prefer-provider"];

    // If a specific model is requested (not virtual), try to find its provider
    const isVirtualModel = ["auto", "fast", "cheap", "quality"].includes(request.model);
    if (!isVirtualModel) {
      const provider = this.registry.findProviderForModel(request.model);
      if (provider && this.registry.isHealthy(provider.id)) {
        return {
          provider,
          modelId: request.model,
          strategy,
          score: 1,
          reasoning: `Direct model request: ${request.model}`,
        };
      }
    }

    // If a preferred provider is specified and healthy, prioritize it
    if (preferredProvider) {
      const preferred = this.registry.get(preferredProvider);
      if (preferred && this.registry.isHealthy(preferredProvider)) {
        const candidates = this.getCandidates(classification.requiredCapabilities, config)
          .filter((p) => p.provider === preferredProvider);
        if (candidates.length > 0) {
          const best = candidates.sort((a, b) =>
            this.scoreCandidate(b, config, classification.complexity === "complex") -
            this.scoreCandidate(a, config, classification.complexity === "complex")
          )[0]!;
          return {
            provider: preferred,
            modelId: best.modelId,
            strategy,
            score: this.scoreCandidate(best, config, classification.complexity === "complex"),
            reasoning: `Preferred provider: ${preferredProvider} → ${best.modelId} (complexity: ${classification.complexity})`,
          };
        }
      }
    }

    // Get candidate profiles
    const candidates = this.getCandidates(classification.requiredCapabilities, config);

    if (candidates.length === 0) {
      // Fallback: try any healthy provider
      const healthy = this.registry.getHealthy();
      if (healthy.length === 0) {
        throw new Error("No healthy providers available");
      }
      const fallbackProvider = healthy[0]!;
      return {
        provider: fallbackProvider,
        modelId: request.model,
        strategy,
        score: 0,
        reasoning: "No candidates matched, using first healthy provider",
      };
    }

    // Score and rank candidates
    const scored = candidates.map((profile) => {
      const score = this.scoreCandidate(profile, config, classification.complexity === "complex");
      return { profile, score };
    });

    scored.sort((a, b) => b.score - a.score);

    // Prefer local if configured and a local option is competitive
    if (config.constraints.preferLocal) {
      const localCandidate = scored.find((s) => s.profile.provider === "ollama");
      const bestScore = scored[0]!.score;
      if (localCandidate && localCandidate.score >= bestScore * 0.7) {
        const provider = this.registry.get(localCandidate.profile.provider);
        if (provider) {
          return {
            provider,
            modelId: localCandidate.profile.modelId,
            strategy,
            score: localCandidate.score,
            reasoning: `Local-first: ${localCandidate.profile.modelId} (score: ${localCandidate.score.toFixed(2)})`,
          };
        }
      }
    }

    const best = scored[0]!;
    const provider = this.registry.get(best.profile.provider);
    if (!provider) {
      throw new Error(`Provider ${best.profile.provider} not found in registry`);
    }

    return {
      provider,
      modelId: best.profile.modelId,
      strategy,
      score: best.score,
      reasoning: `${strategy}: ${best.profile.modelId} (score: ${best.score.toFixed(2)}, complexity: ${classification.complexity})`,
    };
  }

  private getCandidates(
    requiredCapabilities: ModelCapability[],
    config: RoutingConfig
  ): ModelProfile[] {
    const allProfiles = capabilityMap.getAllProfiles();

    return allProfiles.filter((profile) => {
      // Must be from a healthy provider
      if (!this.registry.isHealthy(profile.provider)) return false;

      // Must have required capabilities
      const hasCapabilities = requiredCapabilities.every((cap) =>
        profile.capabilities.includes(cap)
      );
      if (!hasCapabilities) return false;

      // Check cost constraint
      if (config.constraints.maxCostPer1kTokens !== undefined) {
        const avgCost = (profile.costPer1kInput + profile.costPer1kOutput) / 2;
        if (avgCost > config.constraints.maxCostPer1kTokens) return false;
      }

      // Check latency constraint
      if (config.constraints.maxLatencyMs !== undefined) {
        if (profile.avgLatencyMs > config.constraints.maxLatencyMs) return false;
      }

      return true;
    });
  }

  private scoreCandidate(
    profile: ModelProfile,
    config: RoutingConfig,
    isComplex: boolean
  ): number {
    const weights = config.weights ?? { cost: 0.33, quality: 0.34, latency: 0.33 };

    // Normalize cost score (lower is better, 0 cost = perfect score)
    const maxCost = 0.1; // $0.10 per 1k tokens as max reference
    const avgCost = (profile.costPer1kInput + profile.costPer1kOutput) / 2;
    const costScore = Math.max(0, 1 - avgCost / maxCost);

    // Quality score (already 0-100, normalize to 0-1)
    let qualityScore = profile.qualityScore / 100;
    // Boost quality importance for complex tasks
    if (isComplex) {
      qualityScore = Math.pow(qualityScore, 0.8); // Reduce penalty for high quality
    }

    // Latency score (lower is better)
    const maxLatency = 5000; // 5 seconds as max reference
    const latencyScore = Math.max(0, 1 - profile.avgLatencyMs / maxLatency);

    return weights.cost * costScore + weights.quality * qualityScore + weights.latency * latencyScore;
  }
}
