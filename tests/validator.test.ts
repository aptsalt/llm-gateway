import { describe, it, expect } from "vitest";
import { ChatRequestSchema } from "../src/gateway/validator.js";

describe("ChatRequest Validator", () => {
  it("validates a minimal valid request", () => {
    const result = ChatRequestSchema.safeParse({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(true);
  });

  it("validates a full request with all optional fields", () => {
    const result = ChatRequestSchema.safeParse({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "You are helpful" },
        { role: "user", content: "Hello" },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.9,
      stream: true,
      stop: ["###"],
      presence_penalty: 0.5,
      frequency_penalty: 0.5,
      "x-routing-strategy": "cost",
      "x-prefer-provider": "ollama",
      "x-cache": false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty messages array", () => {
    const result = ChatRequestSchema.safeParse({
      model: "gpt-4o",
      messages: [],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing model", () => {
    const result = ChatRequestSchema.safeParse({
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid role", () => {
    const result = ChatRequestSchema.safeParse({
      model: "gpt-4o",
      messages: [{ role: "invalid", content: "Hello" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects temperature out of range", () => {
    const result = ChatRequestSchema.safeParse({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      temperature: 3.0,
    });
    expect(result.success).toBe(false);
  });

  it("accepts virtual model names", () => {
    for (const model of ["auto", "fast", "cheap"]) {
      const result = ChatRequestSchema.safeParse({
        model,
        messages: [{ role: "user", content: "Hello" }],
      });
      expect(result.success).toBe(true);
    }
  });

  it("defaults stream to false", () => {
    const result = ChatRequestSchema.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result.stream).toBe(false);
  });

  it("defaults x-cache to true", () => {
    const result = ChatRequestSchema.parse({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(result["x-cache"]).toBe(true);
  });

  it("rejects invalid routing strategy", () => {
    const result = ChatRequestSchema.safeParse({
      model: "gpt-4o",
      messages: [{ role: "user", content: "Hello" }],
      "x-routing-strategy": "invalid",
    });
    expect(result.success).toBe(false);
  });
});
