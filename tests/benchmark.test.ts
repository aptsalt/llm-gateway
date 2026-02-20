import { describe, it, expect, beforeEach } from "vitest";
import { ALL_BENCHMARK_TASKS, getTasksByCategory, CATEGORIES } from "../src/benchmark/tasks.js";
import { scoreResponse, aggregateResults, type TaskScore } from "../src/benchmark/scorer.js";
import { BenchmarkRunner } from "../src/benchmark/runner.js";
import { ProviderRegistry } from "../src/providers/registry.js";

// --- Task definitions ---

describe("Benchmark Tasks", () => {
  it("should have tasks for all categories", () => {
    for (const cat of CATEGORIES) {
      const tasks = getTasksByCategory(cat);
      expect(tasks.length).toBeGreaterThan(0);
    }
  });

  it("should have unique task IDs", () => {
    const ids = ALL_BENCHMARK_TASKS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("should have valid scoring types", () => {
    const validScoring = ["contains", "length", "format", "composite"];
    for (const task of ALL_BENCHMARK_TASKS) {
      expect(validScoring).toContain(task.scoring);
    }
  });

  it("should have maxTokens set for all tasks", () => {
    for (const task of ALL_BENCHMARK_TASKS) {
      expect(task.maxTokens).toBeGreaterThan(0);
    }
  });

  it("should have prompts for all tasks", () => {
    for (const task of ALL_BENCHMARK_TASKS) {
      expect(task.prompt.length).toBeGreaterThan(10);
    }
  });
});

// --- Scorer ---

describe("Benchmark Scorer", () => {
  it("should score 100 for contains when all expected values match", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "mmlu-physics-1")!;
    const result = scoreResponse(task, "The acceleration is 9.8 m/s²", 100, 20);
    expect(result.score).toBe(100);
    expect(result.passed).toBe(true);
  });

  it("should score 0 for contains when nothing matches", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "mmlu-physics-1")!;
    const result = scoreResponse(task, "I don't know", 100, 10);
    expect(result.score).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("should handle partial matches in contains scoring", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "code-fizzbuzz")!;
    // Has 3 expected: ["def fizzbuzz", "Fizz", "Buzz"]
    // "def fizzbuzz" contains both "def fizzbuzz" and "Buzz" as substrings, so use a response that only matches one
    const result = scoreResponse(task, "Here is the function:\nFizz\nand some more", 200, 50);
    // Should match "Fizz" but not "def fizzbuzz" or "Buzz"
    expect(result.score).toBeGreaterThan(0);
    expect(result.score).toBeLessThan(100);
  });

  it("should score length-based tasks", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "sum-article-1")!;
    // Prompt asks for exactly 2 sentences
    const twoSentences = "ML is a subset of AI that learns from data. It's used in email filtering, recommendations, and image recognition.";
    const result = scoreResponse(task, twoSentences, 150, 30);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it("should score format-based tasks for valid JSON", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "inst-format-1")!;
    const validJson = '{"name": "Alice", "age": 30, "hobbies": ["reading", "coding"]}';
    const result = scoreResponse(task, validJson, 100, 25);
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.passed).toBe(true);
  });

  it("should give low score for invalid JSON in format tasks", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "inst-format-1")!;
    const result = scoreResponse(task, "not json at all", 100, 10);
    expect(result.score).toBeLessThan(50);
  });

  it("should score composite tasks", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "sum-article-2")!;
    const bullets = "- Quantum computers use qubits\n- They solve problems faster\n- Still in early stages";
    const result = scoreResponse(task, bullets, 200, 40);
    expect(result.score).toBeGreaterThan(0);
  });

  it("should track latency and tokens", () => {
    const task = ALL_BENCHMARK_TASKS.find((t) => t.id === "mmlu-cs-1")!;
    const result = scoreResponse(task, "O(log n)", 250, 15);
    expect(result.latencyMs).toBe(250);
    expect(result.tokensUsed).toBe(15);
  });
});

// --- Aggregation ---

describe("Result Aggregation", () => {
  it("should compute overall score as average", () => {
    const scores: TaskScore[] = [
      { taskId: "mmlu-physics-1", score: 100, latencyMs: 100, tokensUsed: 20, passed: true, details: "" },
      { taskId: "mmlu-biology-1", score: 50, latencyMs: 200, tokensUsed: 30, passed: true, details: "" },
      { taskId: "code-fizzbuzz", score: 80, latencyMs: 300, tokensUsed: 50, passed: true, details: "" },
    ];

    const result = aggregateResults(scores, "test-model", "test-provider");
    expect(result.overallScore).toBe(77); // (100+50+80)/3 = 76.67 -> 77
    expect(result.totalLatencyMs).toBe(600);
    expect(result.totalTokens).toBe(100);
  });

  it("should group scores by category", () => {
    const scores: TaskScore[] = [
      { taskId: "mmlu-physics-1", score: 100, latencyMs: 100, tokensUsed: 20, passed: true, details: "" },
      { taskId: "mmlu-biology-1", score: 80, latencyMs: 100, tokensUsed: 20, passed: true, details: "" },
      { taskId: "code-fizzbuzz", score: 60, latencyMs: 200, tokensUsed: 40, passed: true, details: "" },
    ];

    const result = aggregateResults(scores, "test-model", "test-provider");
    expect(result.categoryScores["mmlu"]).toBe(90); // (100+80)/2
    expect(result.categoryScores["code-gen"]).toBe(60);
  });

  it("should handle empty scores", () => {
    const result = aggregateResults([], "empty-model", "test-provider");
    expect(result.overallScore).toBe(0);
    expect(result.taskResults).toHaveLength(0);
  });

  it("should set completedAt timestamp", () => {
    const result = aggregateResults([], "model", "provider");
    expect(result.completedAt).toBeDefined();
    expect(() => new Date(result.completedAt)).not.toThrow();
  });
});

// --- Runner ---

describe("BenchmarkRunner", () => {
  let runner: BenchmarkRunner;
  let registry: ProviderRegistry;

  beforeEach(() => {
    registry = new ProviderRegistry();
    runner = new BenchmarkRunner(registry);
  });

  it("should start in idle state", () => {
    const status = runner.getStatus();
    expect(status.status).toBe("idle");
    expect(status.results).toHaveLength(0);
  });

  it("should reject run when no models available", async () => {
    await expect(runner.run()).rejects.toThrow("No models available");
  });

  it("should reject run when no tasks match categories", async () => {
    await expect(runner.run({ categories: ["nonexistent"] })).rejects.toThrow("No benchmark tasks");
  });

  it("should report not running initially", () => {
    expect(runner.isRunning()).toBe(false);
  });

  it("should return empty history initially", () => {
    expect(runner.getHistory()).toHaveLength(0);
  });

  it("should return empty latest results initially", () => {
    expect(runner.getLatestResults()).toHaveLength(0);
  });
});
