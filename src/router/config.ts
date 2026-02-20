import { z } from "zod";

export const RoutingStrategySchema = z.enum(["cost", "quality", "latency", "balanced"]);
export type RoutingStrategy = z.infer<typeof RoutingStrategySchema>;

export const RoutingWeightsSchema = z.object({
  cost: z.number().min(0).max(1),
  quality: z.number().min(0).max(1),
  latency: z.number().min(0).max(1),
});

export const RoutingConstraintsSchema = z.object({
  maxCostPer1kTokens: z.number().optional(),
  maxLatencyMs: z.number().optional(),
  requiredCapabilities: z.array(z.string()).optional(),
  preferLocal: z.boolean().default(true),
});

export const RoutingConfigSchema = z.object({
  strategy: RoutingStrategySchema,
  weights: RoutingWeightsSchema.optional(),
  constraints: RoutingConstraintsSchema,
  fallbackChain: z.array(z.string()),
});

export type RoutingConfig = z.infer<typeof RoutingConfigSchema>;

export const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  strategy: "balanced",
  weights: {
    cost: 0.4,
    quality: 0.35,
    latency: 0.25,
  },
  constraints: {
    preferLocal: true,
  },
  fallbackChain: ["ollama", "groq", "together", "openai", "anthropic"],
};

export const STRATEGY_PRESETS: Record<RoutingStrategy, RoutingConfig> = {
  cost: {
    strategy: "cost",
    weights: { cost: 0.8, quality: 0.1, latency: 0.1 },
    constraints: { preferLocal: true },
    fallbackChain: ["ollama", "groq", "together", "openai", "anthropic"],
  },
  quality: {
    strategy: "quality",
    weights: { cost: 0.05, quality: 0.85, latency: 0.1 },
    constraints: { preferLocal: false },
    fallbackChain: ["anthropic", "openai", "groq", "together", "ollama"],
  },
  latency: {
    strategy: "latency",
    weights: { cost: 0.1, quality: 0.1, latency: 0.8 },
    constraints: { preferLocal: true },
    fallbackChain: ["ollama", "groq", "together", "openai", "anthropic"],
  },
  balanced: {
    strategy: "balanced",
    weights: { cost: 0.4, quality: 0.35, latency: 0.25 },
    constraints: { preferLocal: true },
    fallbackChain: ["ollama", "groq", "together", "openai", "anthropic"],
  },
};
