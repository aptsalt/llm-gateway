import type { ProviderRegistry } from "../providers/registry.js";
import type { ChatRequest } from "../gateway/validator.js";
import { ALL_BENCHMARK_TASKS, CATEGORIES, getTasksByCategory, type BenchmarkTask } from "./tasks.js";
import { scoreResponse, aggregateResults, type TaskScore, type ModelBenchmarkResult } from "./scorer.js";

export interface BenchmarkRunConfig {
  models?: string[];
  categories?: string[];
  concurrency?: number;
}

export interface BenchmarkRunStatus {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  progress: { completed: number; total: number; currentModel?: string; currentTask?: string };
  startedAt?: string;
  completedAt?: string;
  results: ModelBenchmarkResult[];
  error?: string;
}

export class BenchmarkRunner {
  private registry: ProviderRegistry;
  private currentRun: BenchmarkRunStatus = {
    id: "",
    status: "idle",
    progress: { completed: 0, total: 0 },
    results: [],
  };
  private history: ModelBenchmarkResult[] = [];

  constructor(registry: ProviderRegistry) {
    this.registry = registry;
  }

  getStatus(): BenchmarkRunStatus {
    return { ...this.currentRun };
  }

  getHistory(): ModelBenchmarkResult[] {
    return [...this.history];
  }

  getLatestResults(): ModelBenchmarkResult[] {
    return this.currentRun.results.length > 0 ? this.currentRun.results : this.history;
  }

  isRunning(): boolean {
    return this.currentRun.status === "running";
  }

  async run(config: BenchmarkRunConfig = {}): Promise<ModelBenchmarkResult[]> {
    if (this.isRunning()) {
      throw new Error("Benchmark already running");
    }

    const runId = `bench-${Date.now()}`;
    const categories = config.categories ?? [...CATEGORIES];
    const tasks = categories.flatMap((cat) => getTasksByCategory(cat));

    if (tasks.length === 0) {
      throw new Error("No benchmark tasks found for selected categories");
    }

    // Discover models to benchmark
    const modelsToTest = await this.resolveModels(config.models);
    if (modelsToTest.length === 0) {
      throw new Error("No models available for benchmarking");
    }

    const totalTasks = modelsToTest.length * tasks.length;

    this.currentRun = {
      id: runId,
      status: "running",
      progress: { completed: 0, total: totalTasks },
      startedAt: new Date().toISOString(),
      results: [],
    };

    try {
      for (const { modelId, providerId } of modelsToTest) {
        this.currentRun.progress.currentModel = modelId;
        const taskScores: TaskScore[] = [];

        for (const task of tasks) {
          this.currentRun.progress.currentTask = task.name;

          try {
            const result = await this.runSingleTask(task, modelId, providerId);
            taskScores.push(result);
          } catch (err) {
            taskScores.push({
              taskId: task.id,
              score: 0,
              latencyMs: 0,
              tokensUsed: 0,
              passed: false,
              details: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
            });
          }

          this.currentRun.progress.completed++;
        }

        const modelResult = aggregateResults(taskScores, modelId, providerId);
        this.currentRun.results.push(modelResult);
      }

      this.currentRun.status = "completed";
      this.currentRun.completedAt = new Date().toISOString();
      this.currentRun.progress.currentModel = undefined;
      this.currentRun.progress.currentTask = undefined;

      // Save to history
      this.history = [...this.currentRun.results];

      return this.currentRun.results;
    } catch (err) {
      this.currentRun.status = "failed";
      this.currentRun.error = err instanceof Error ? err.message : "Unknown error";
      throw err;
    }
  }

  private async runSingleTask(task: BenchmarkTask, modelId: string, providerId: string): Promise<TaskScore> {
    const provider = this.registry.get(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }

    const request: ChatRequest = {
      model: modelId,
      messages: [
        ...(task.systemPrompt ? [{ role: "system" as const, content: task.systemPrompt }] : []),
        { role: "user" as const, content: task.prompt },
      ],
      max_tokens: task.maxTokens,
      temperature: 0.1, // Low temperature for consistent benchmark results
      stream: false,
      n: 1,
      "x-cache": false,
    };

    const start = performance.now();
    const result = await provider.chat(request);
    const latencyMs = Math.round(performance.now() - start);

    return scoreResponse(
      task,
      result.content,
      latencyMs,
      result.usage.totalTokens
    );
  }

  private async resolveModels(
    requestedModels?: string[]
  ): Promise<Array<{ modelId: string; providerId: string }>> {
    const models: Array<{ modelId: string; providerId: string }> = [];
    const allModels = await this.registry.getAllModels();

    if (requestedModels && requestedModels.length > 0) {
      for (const modelId of requestedModels) {
        const provider = this.registry.findProviderForModel(modelId);
        if (provider) {
          models.push({ modelId, providerId: provider.id });
        }
      }
      return models;
    }

    // Auto-select: pick representative models from each provider
    // Filter out embedding models and pick up to 3 per provider
    const providerModels = new Map<string, string[]>();
    const skipPatterns = ["embed", "nomic", "mxbai", "whisper"];

    for (const model of allModels) {
      const lower = model.id.toLowerCase();
      if (skipPatterns.some((p) => lower.includes(p))) continue;

      const existing = providerModels.get(model.provider) ?? [];
      if (existing.length < 3) {
        existing.push(model.id);
        providerModels.set(model.provider, existing);
      }
    }

    for (const [providerId, modelIds] of providerModels) {
      for (const modelId of modelIds) {
        models.push({ modelId, providerId });
      }
    }

    return models;
  }
}
