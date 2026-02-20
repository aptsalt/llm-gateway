import { describe, it, expect } from "vitest";
import { classifyRequest, type ClassificationResult } from "../src/router/classifier.js";

function classify(content: string, extraMessages: Array<{ role: string; content: string }> = []): ClassificationResult {
  return classifyRequest([
    ...extraMessages,
    { role: "user", content },
  ]);
}

describe("Complexity Classifier", () => {
  it("classifies simple greetings as simple", () => {
    const result = classify("Hello");
    expect(result.complexity).toBe("simple");
  });

  it("classifies simple questions as simple", () => {
    const result = classify("What is the capital of France?");
    expect(result.complexity).toBe("simple");
  });

  it("classifies code requests as moderate or complex", () => {
    const result = classify("Write a function to calculate fibonacci numbers in Python");
    expect(["moderate", "complex"]).toContain(result.complexity);
    expect(result.requiredCapabilities).toContain("code");
  });

  it("classifies code blocks as code-related", () => {
    const result = classify("Fix this code:\n```python\ndef foo():\n  return bar\n```");
    expect(result.requiredCapabilities).toContain("code");
  });

  it("classifies math problems", () => {
    const result = classify("Calculate the integral of x^2 from 0 to 5");
    expect(result.requiredCapabilities).toContain("math");
  });

  it("classifies creative writing requests", () => {
    const result = classify("Write a short story about a space explorer");
    expect(result.requiredCapabilities).toContain("creative");
  });

  it("increases complexity for deep conversations", () => {
    const messages = [
      { role: "user", content: "Hi" },
      { role: "assistant", content: "Hello!" },
      { role: "user", content: "I need help" },
      { role: "assistant", content: "Sure!" },
      { role: "user", content: "Can you explain" },
      { role: "assistant", content: "Of course" },
    ];
    const result = classifyRequest([...messages, { role: "user", content: "Now implement the refactoring we discussed for the class hierarchy" }]);
    expect(result.complexity).not.toBe("simple");
  });

  it("estimates tokens from content length", () => {
    const result = classify("Hello world");
    expect(result.estimatedTokens).toBeGreaterThan(0);
  });

  it("always includes general and instruction-following capabilities", () => {
    const result = classify("Hello");
    expect(result.requiredCapabilities).toContain("general");
    expect(result.requiredCapabilities).toContain("instruction-following");
  });

  it("provides reasoning for classification", () => {
    const result = classify("Write a function to sort an array");
    expect(result.reasoning).toBeTruthy();
  });
});
