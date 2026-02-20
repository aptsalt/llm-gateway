import { describe, it, expect } from "vitest";
import { CapabilityMap } from "../src/router/capabilities.js";

describe("CapabilityMap", () => {
  it("returns all profiles", () => {
    const map = new CapabilityMap();
    const profiles = map.getAllProfiles();
    expect(profiles.length).toBeGreaterThan(0);
  });

  it("filters profiles by capability", () => {
    const map = new CapabilityMap();
    const codeModels = map.getProfilesByCapability("code");
    expect(codeModels.length).toBeGreaterThan(0);
    for (const model of codeModels) {
      expect(model.capabilities).toContain("code");
    }
  });

  it("filters profiles by provider", () => {
    const map = new CapabilityMap();
    const ollamaModels = map.getProfilesByProvider("ollama");
    expect(ollamaModels.length).toBeGreaterThan(0);
    for (const model of ollamaModels) {
      expect(model.provider).toBe("ollama");
    }
  });

  it("updates latency with EMA", () => {
    const map = new CapabilityMap();
    const profile = map.getProfile("ollama", "llama3.2");
    const originalLatency = profile?.avgLatencyMs ?? 0;

    map.updateLatency("ollama", "llama3.2", 1000);
    const updated = map.getProfile("ollama", "llama3.2");
    expect(updated?.avgLatencyMs).not.toBe(originalLatency);
  });

  it("tracks latency percentiles", () => {
    const map = new CapabilityMap();
    for (let i = 0; i < 20; i++) {
      map.updateLatency("ollama", "llama3.2", 100 + i * 10);
    }
    const percentiles = map.getLatencyPercentiles("ollama", "llama3.2");
    expect(percentiles).toBeDefined();
    expect(percentiles!.p50).toBeGreaterThan(0);
    expect(percentiles!.p95).toBeGreaterThanOrEqual(percentiles!.p50);
    expect(percentiles!.p99).toBeGreaterThanOrEqual(percentiles!.p95);
  });

  it("supports model aliases", () => {
    const map = new CapabilityMap();
    map.addAlias("gpt4", "gpt-4o");
    expect(map.resolveAlias("gpt4")).toBe("gpt-4o");
    expect(map.resolveAlias("unknown")).toBe("unknown");
  });

  it("finds best model for capability", () => {
    const map = new CapabilityMap();
    const best = map.getBestModelForCapability("code");
    expect(best).toBeDefined();
    expect(best!.capabilities).toContain("code");
  });

  it("returns model count", () => {
    const map = new CapabilityMap();
    expect(map.getModelCount()).toBeGreaterThan(0);
  });
});
