import { describe, it, expect } from "vitest";
import { cosineSimilarity } from "../src/cache/embedding.js";

describe("Cosine Similarity", () => {
  it("returns 1 for identical vectors", () => {
    const vec = [1, 2, 3, 4, 5];
    expect(cosineSimilarity(vec, vec)).toBeCloseTo(1.0);
  });

  it("returns 0 for orthogonal vectors", () => {
    const a = [1, 0, 0];
    const b = [0, 1, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    const a = [1, 0, 0];
    const b = [-1, 0, 0];
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1);
  });

  it("handles zero vectors", () => {
    const a = [0, 0, 0];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("returns 0 for different length vectors", () => {
    const a = [1, 2];
    const b = [1, 2, 3];
    expect(cosineSimilarity(a, b)).toBe(0);
  });

  it("is close to 1 for similar vectors", () => {
    const a = [1, 2, 3, 4, 5];
    const b = [1.1, 2.05, 3.02, 3.98, 5.01];
    expect(cosineSimilarity(a, b)).toBeGreaterThan(0.99);
  });

  it("is proportional for scaled vectors", () => {
    const a = [1, 2, 3];
    const b = [2, 4, 6];
    expect(cosineSimilarity(a, b)).toBeCloseTo(1.0);
  });
});
