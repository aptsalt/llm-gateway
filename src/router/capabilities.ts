import type { ModelCapability } from "../providers/interface.js";

export interface ModelProfile {
  modelId: string;
  provider: string;
  capabilities: ModelCapability[];
  qualityScore: number; // 0-100
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  avgLatencyMs: number;
}

const DEFAULT_PROFILES: ModelProfile[] = [
  // Ollama (local, free)
  {
    modelId: "llama3.2",
    provider: "ollama",
    capabilities: ["general", "instruction-following"],
    qualityScore: 55,
    contextWindow: 8192,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    avgLatencyMs: 500,
  },
  {
    modelId: "qwen2.5-coder:7b",
    provider: "ollama",
    capabilities: ["general", "code", "instruction-following"],
    qualityScore: 60,
    contextWindow: 32768,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    avgLatencyMs: 600,
  },
  // Groq (fast + cheap)
  {
    modelId: "llama-3.3-70b-versatile",
    provider: "groq",
    capabilities: ["general", "code", "math", "instruction-following", "multilingual"],
    qualityScore: 75,
    contextWindow: 131072,
    costPer1kInput: 0.00059,
    costPer1kOutput: 0.00079,
    avgLatencyMs: 200,
  },
  {
    modelId: "llama-3.1-8b-instant",
    provider: "groq",
    capabilities: ["general", "instruction-following"],
    qualityScore: 55,
    contextWindow: 131072,
    costPer1kInput: 0.00005,
    costPer1kOutput: 0.00008,
    avgLatencyMs: 100,
  },
  // OpenAI
  {
    modelId: "gpt-4o",
    provider: "openai",
    capabilities: ["general", "code", "math", "creative", "instruction-following", "multilingual"],
    qualityScore: 90,
    contextWindow: 128000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    avgLatencyMs: 1500,
  },
  {
    modelId: "gpt-4o-mini",
    provider: "openai",
    capabilities: ["general", "code", "instruction-following", "multilingual"],
    qualityScore: 70,
    contextWindow: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    avgLatencyMs: 800,
  },
  // Anthropic
  {
    modelId: "claude-sonnet-4-20250514",
    provider: "anthropic",
    capabilities: ["general", "code", "math", "creative", "instruction-following", "multilingual"],
    qualityScore: 92,
    contextWindow: 200000,
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    avgLatencyMs: 1800,
  },
  {
    modelId: "claude-3-5-haiku-20241022",
    provider: "anthropic",
    capabilities: ["general", "code", "instruction-following"],
    qualityScore: 65,
    contextWindow: 200000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.005,
    avgLatencyMs: 600,
  },
  // Together
  {
    modelId: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    provider: "together",
    capabilities: ["general", "code", "instruction-following"],
    qualityScore: 72,
    contextWindow: 131072,
    costPer1kInput: 0.00088,
    costPer1kOutput: 0.00088,
    avgLatencyMs: 400,
  },
];

export class CapabilityMap {
  private profiles: Map<string, ModelProfile> = new Map();
  private aliases: Map<string, string> = new Map();
  private latencyHistory: Map<string, number[]> = new Map();

  constructor() {
    for (const profile of DEFAULT_PROFILES) {
      this.profiles.set(`${profile.provider}:${profile.modelId}`, profile);
    }
  }

  getProfile(provider: string, modelId: string): ModelProfile | undefined {
    const resolvedId = this.aliases.get(modelId) ?? modelId;
    return this.profiles.get(`${provider}:${resolvedId}`);
  }

  getAllProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values());
  }

  getProfilesByCapability(capability: ModelCapability): ModelProfile[] {
    return this.getAllProfiles().filter((p) => p.capabilities.includes(capability));
  }

  getProfilesByProvider(provider: string): ModelProfile[] {
    return this.getAllProfiles().filter((p) => p.provider === provider);
  }

  updateLatency(provider: string, modelId: string, latencyMs: number): void {
    const key = `${provider}:${modelId}`;
    const profile = this.profiles.get(key);
    if (profile) {
      // Exponential moving average
      profile.avgLatencyMs = profile.avgLatencyMs * 0.8 + latencyMs * 0.2;
    }

    // Store history for percentile calculations
    const history = this.latencyHistory.get(key) ?? [];
    history.push(latencyMs);
    if (history.length > 100) history.shift();
    this.latencyHistory.set(key, history);
  }

  getLatencyPercentiles(provider: string, modelId: string): { p50: number; p95: number; p99: number } | undefined {
    const history = this.latencyHistory.get(`${provider}:${modelId}`);
    if (!history || history.length === 0) return undefined;
    const sorted = [...history].sort((a, b) => a - b);
    const percentile = (p: number) => sorted[Math.ceil((p / 100) * sorted.length) - 1] ?? 0;
    return { p50: percentile(50), p95: percentile(95), p99: percentile(99) };
  }

  addProfile(profile: ModelProfile): void {
    this.profiles.set(`${profile.provider}:${profile.modelId}`, profile);
  }

  addAlias(alias: string, modelId: string): void {
    this.aliases.set(alias, modelId);
  }

  resolveAlias(modelId: string): string {
    return this.aliases.get(modelId) ?? modelId;
  }

  getModelCount(): number {
    return this.profiles.size;
  }

  getBestModelForCapability(capability: ModelCapability): ModelProfile | undefined {
    return this.getProfilesByCapability(capability)
      .sort((a, b) => b.qualityScore - a.qualityScore)[0];
  }
}

export const capabilityMap = new CapabilityMap();
