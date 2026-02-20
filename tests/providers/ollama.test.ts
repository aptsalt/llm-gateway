import { describe, it, expect } from "vitest";
import { OllamaProvider } from "../../src/providers/ollama.js";

describe("OllamaProvider", () => {
  const provider = new OllamaProvider("http://localhost:11434");

  it("has correct id and name", () => {
    expect(provider.id).toBe("ollama");
    expect(provider.name).toBe("Ollama (Local)");
  });

  it("estimates zero cost", () => {
    const cost = provider.estimateCost({
      model: "llama3.2",
      messages: [{ role: "user", content: "Hello" }],
      stream: false,
      "x-cache": true,
      n: 1,
    });
    expect(cost.estimatedCostUsd).toBe(0);
    expect(cost.estimatedInputTokens).toBe(0);
    expect(cost.estimatedOutputTokens).toBe(0);
  });
});
