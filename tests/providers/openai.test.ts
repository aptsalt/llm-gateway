import { describe, it, expect } from "vitest";
import { OpenAIProvider } from "../../src/providers/openai.js";

describe("OpenAIProvider", () => {
  const provider = new OpenAIProvider("test-key");

  it("has correct id and name", () => {
    expect(provider.id).toBe("openai");
    expect(provider.name).toBe("OpenAI");
  });

  it("lists known models", async () => {
    const models = await provider.listModels();
    expect(models.length).toBeGreaterThan(0);

    const gpt4o = models.find((m) => m.id === "gpt-4o");
    expect(gpt4o).toBeDefined();
    expect(gpt4o!.costPer1kInput).toBeGreaterThan(0);
    expect(gpt4o!.costPer1kOutput).toBeGreaterThan(0);
    expect(gpt4o!.capabilities).toContain("general");
    expect(gpt4o!.capabilities).toContain("code");
  });

  it("estimates cost for a request", () => {
    const cost = provider.estimateCost({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello, how are you?" }],
      stream: false,
      "x-cache": true,
      n: 1,
    });
    expect(cost.estimatedCostUsd).toBeGreaterThan(0);
    expect(cost.estimatedInputTokens).toBeGreaterThan(0);
    expect(cost.estimatedOutputTokens).toBeGreaterThan(0);
  });

  it("reports unhealthy without valid API key", async () => {
    const badProvider = new OpenAIProvider("");
    const health = await badProvider.healthCheck();
    expect(health.healthy).toBe(false);
  });
});
