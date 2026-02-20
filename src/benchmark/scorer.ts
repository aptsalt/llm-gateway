import type { BenchmarkTask } from "./tasks.js";

export interface TaskScore {
  taskId: string;
  score: number; // 0-100
  latencyMs: number;
  tokensUsed: number;
  passed: boolean;
  details: string;
}

export interface ModelBenchmarkResult {
  modelId: string;
  provider: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  taskResults: TaskScore[];
  totalLatencyMs: number;
  totalTokens: number;
  completedAt: string;
}

export function scoreResponse(
  task: BenchmarkTask,
  response: string,
  latencyMs: number,
  tokensUsed: number
): TaskScore {
  const content = response.trim().toLowerCase();

  switch (task.scoring) {
    case "contains":
      return scoreContains(task, content, response, latencyMs, tokensUsed);
    case "length":
      return scoreLength(task, content, response, latencyMs, tokensUsed);
    case "format":
      return scoreFormat(task, content, response, latencyMs, tokensUsed);
    case "composite":
      return scoreComposite(task, content, response, latencyMs, tokensUsed);
    default:
      return {
        taskId: task.id,
        score: 0,
        latencyMs,
        tokensUsed,
        passed: false,
        details: "Unknown scoring method",
      };
  }
}

function scoreContains(
  task: BenchmarkTask,
  contentLower: string,
  _raw: string,
  latencyMs: number,
  tokensUsed: number
): TaskScore {
  const expected = task.expectedContains ?? [];
  if (expected.length === 0) {
    return { taskId: task.id, score: 50, latencyMs, tokensUsed, passed: true, details: "No expected values" };
  }

  const matched = expected.filter((exp) => contentLower.includes(exp.toLowerCase()));
  const ratio = matched.length / expected.length;
  const score = Math.round(ratio * 100);

  return {
    taskId: task.id,
    score,
    latencyMs,
    tokensUsed,
    passed: score >= 50,
    details: `Matched ${matched.length}/${expected.length}: [${matched.join(", ")}]`,
  };
}

function scoreLength(
  task: BenchmarkTask,
  _contentLower: string,
  raw: string,
  latencyMs: number,
  tokensUsed: number
): TaskScore {
  const sentences = raw.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const words = raw.split(/\s+/).length;

  // Good summary: 20-80 words, proportional to request
  let score = 100;
  if (words < 10) score = 20;
  else if (words < 20) score = 60;
  else if (words > 150) score = 50;

  // Bonus for meeting sentence count if implied
  if (task.prompt.includes("2 sentences")) {
    score = sentences.length === 2 ? 100 : sentences.length === 1 ? 50 : 40;
  } else if (task.prompt.includes("3 bullet")) {
    const bullets = raw.split(/[-•*]/).filter((s) => s.trim().length > 5);
    score = bullets.length >= 3 ? 100 : Math.round((bullets.length / 3) * 100);
  }

  return {
    taskId: task.id,
    score,
    latencyMs,
    tokensUsed,
    passed: score >= 50,
    details: `${words} words, ${sentences.length} sentences`,
  };
}

function scoreFormat(
  task: BenchmarkTask,
  contentLower: string,
  raw: string,
  latencyMs: number,
  tokensUsed: number
): TaskScore {
  let score = 0;
  const details: string[] = [];

  // Check for JSON validity
  if (task.id.includes("json") || task.prompt.toLowerCase().includes("json")) {
    try {
      // Try to extract JSON from the response
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        score += 50;
        details.push("Valid JSON");

        // Check expected keys
        const expected = task.expectedContains ?? [];
        const keys = Object.keys(parsed);
        const matchedKeys = expected.filter((exp) => {
          const keyName = exp.replace(/"/g, "");
          return keys.includes(keyName) || contentLower.includes(exp.toLowerCase());
        });
        score += Math.round((matchedKeys.length / Math.max(expected.length, 1)) * 50);
        details.push(`${matchedKeys.length}/${expected.length} expected keys`);
      } else {
        details.push("No JSON found in response");
      }
    } catch {
      details.push("Invalid JSON");
      // Partial credit for having expected content
      const expected = task.expectedContains ?? [];
      const matched = expected.filter((exp) => contentLower.includes(exp.toLowerCase()));
      score = Math.round((matched.length / Math.max(expected.length, 1)) * 40);
    }
  } else {
    // Generic format check - contains expected patterns
    const expected = task.expectedContains ?? [];
    const matched = expected.filter((exp) => contentLower.includes(exp.toLowerCase()));
    score = Math.round((matched.length / Math.max(expected.length, 1)) * 100);
    details.push(`${matched.length}/${expected.length} format markers`);
  }

  return {
    taskId: task.id,
    score,
    latencyMs,
    tokensUsed,
    passed: score >= 50,
    details: details.join("; "),
  };
}

function scoreComposite(
  task: BenchmarkTask,
  contentLower: string,
  raw: string,
  latencyMs: number,
  tokensUsed: number
): TaskScore {
  // Combine contains + length scoring
  const containsResult = scoreContains(task, contentLower, raw, latencyMs, tokensUsed);
  const lengthResult = scoreLength(task, contentLower, raw, latencyMs, tokensUsed);

  const score = Math.round(containsResult.score * 0.6 + lengthResult.score * 0.4);

  return {
    taskId: task.id,
    score,
    latencyMs,
    tokensUsed,
    passed: score >= 50,
    details: `Contains: ${containsResult.score}, Length: ${lengthResult.score}`,
  };
}

export function aggregateResults(taskScores: TaskScore[], modelId: string, provider: string): ModelBenchmarkResult {
  const categoryMap = new Map<string, TaskScore[]>();

  for (const result of taskScores) {
    const category = result.taskId.split("-")[0] ?? "unknown";
    // Map task ID prefixes to categories
    const cat =
      category === "mmlu" ? "mmlu" :
      category === "code" ? "code-gen" :
      category === "sum" ? "summarization" :
      category === "reason" ? "reasoning" :
      category === "inst" ? "instruction" :
      "unknown";

    const existing = categoryMap.get(cat) ?? [];
    existing.push(result);
    categoryMap.set(cat, existing);
  }

  const categoryScores: Record<string, number> = {};
  for (const [cat, scores] of categoryMap) {
    categoryScores[cat] = Math.round(scores.reduce((sum, s) => sum + s.score, 0) / scores.length);
  }

  const overallScore = taskScores.length > 0
    ? Math.round(taskScores.reduce((sum, s) => sum + s.score, 0) / taskScores.length)
    : 0;

  return {
    modelId,
    provider,
    overallScore,
    categoryScores,
    taskResults: taskScores,
    totalLatencyMs: taskScores.reduce((sum, s) => sum + s.latencyMs, 0),
    totalTokens: taskScores.reduce((sum, s) => sum + s.tokensUsed, 0),
    completedAt: new Date().toISOString(),
  };
}
