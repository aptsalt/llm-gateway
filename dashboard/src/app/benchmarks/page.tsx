"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
} from "recharts";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

interface TaskResult {
  taskId: string;
  score: number;
  latencyMs: number;
  tokensUsed: number;
  passed: boolean;
  details: string;
}

interface ModelResult {
  modelId: string;
  provider: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  taskResults: TaskResult[];
  totalLatencyMs: number;
  totalTokens: number;
  completedAt: string;
}

interface BenchmarkStatus {
  id: string;
  status: "idle" | "running" | "completed" | "failed";
  progress: { completed: number; total: number; currentModel?: string; currentTask?: string };
  startedAt?: string;
  completedAt?: string;
  results: ModelResult[];
  error?: string;
}

interface BenchmarkInfo {
  categories: string[];
  totalTasks: number;
  tasks: Array<{ id: string; category: string; name: string; scoring: string }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  mmlu: "Knowledge (MMLU)",
  "code-gen": "Code Generation",
  summarization: "Summarization",
  reasoning: "Reasoning",
  instruction: "Instruction Following",
};

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function BenchmarksPage() {
  const [status, setStatus] = useState<BenchmarkStatus | null>(null);
  const [results, setResults] = useState<ModelResult[]>([]);
  const [info, setInfo] = useState<BenchmarkInfo | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/benchmarks/status`);
      if (res.ok) {
        const data = await res.json() as BenchmarkStatus;
        setStatus(data);
        if (data.results.length > 0) {
          setResults(data.results);
        }
      }
    } catch {
      // Gateway not reachable
    }
  }, []);

  const fetchResults = useCallback(async () => {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/benchmarks/results`);
      if (res.ok) {
        const data = await res.json() as ModelResult[];
        if (data.length > 0) setResults(data);
      }
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const res = await fetch(`${GATEWAY_URL}/api/benchmarks`);
        if (res.ok) setInfo(await res.json() as BenchmarkInfo);
      } catch {
        // Ignore
      }
      await fetchStatus();
      await fetchResults();
    }
    init();
  }, [fetchStatus, fetchResults]);

  // Poll while running
  useEffect(() => {
    if (status?.status !== "running") return;
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [status?.status, fetchStatus]);

  const startBenchmark = async () => {
    setIsStarting(true);
    try {
      const body: Record<string, unknown> = {};
      if (selectedCategories.length > 0) body.categories = selectedCategories;

      const res = await fetch(`${GATEWAY_URL}/api/benchmarks/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) toast.success("Benchmark started");
      else toast.error("Failed to start benchmark");
      await fetchStatus();
    } catch {
      toast.error("Failed to start benchmark");
    }
    setIsStarting(false);
  };

  const isRunning = status?.status === "running";
  const progressPct = status?.progress.total
    ? Math.round((status.progress.completed / status.progress.total) * 100)
    : 0;

  // Prepare chart data
  const overallScoreData = results.map((r) => ({
    name: r.modelId.length > 20 ? r.modelId.slice(0, 20) + "..." : r.modelId,
    score: r.overallScore,
    latency: Math.round(r.totalLatencyMs / Math.max(r.taskResults.length, 1)),
  }));

  const radarData = info?.categories.map((cat) => {
    const entry: Record<string, string | number> = { category: CATEGORY_LABELS[cat] ?? cat };
    for (const r of results) {
      const label = r.modelId.length > 15 ? r.modelId.slice(0, 15) + "..." : r.modelId;
      entry[label] = r.categoryScores[cat] ?? 0;
    }
    return entry;
  }) ?? [];

  const latencyData = results.map((r) => ({
    name: r.modelId.length > 20 ? r.modelId.slice(0, 20) + "..." : r.modelId,
    avgLatency: Math.round(r.totalLatencyMs / Math.max(r.taskResults.length, 1)),
    totalTokens: r.totalTokens,
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Benchmarks</h1>
          <p className="mt-1 text-muted-foreground">
            Auto-benchmark models on MMLU, code gen, summarization, reasoning, and instruction following
          </p>
        </div>
        <button
          onClick={startBenchmark}
          disabled={isRunning || isStarting}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isRunning ? "Running..." : isStarting ? "Starting..." : "Run Benchmark"}
        </button>
      </div>

      {/* Status Bar */}
      {isRunning && status && (
        <Card>
          <CardHeader>
            <CardTitle>Benchmark Running</CardTitle>
            <CardDescription>
              {status.progress.currentModel && `Testing ${status.progress.currentModel}`}
              {status.progress.currentTask && ` — ${status.progress.currentTask}`}
            </CardDescription>
          </CardHeader>
          <div className="px-6 pb-6">
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
              <span>{status.progress.completed} / {status.progress.total} tasks</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </Card>
      )}

      {/* Category Filter */}
      {info && (
        <Card>
          <CardHeader>
            <CardTitle>Benchmark Categories</CardTitle>
            <CardDescription>{info.totalTasks} tasks across {info.categories.length} categories</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2 px-6 pb-6">
            {info.categories.map((cat) => {
              const active = selectedCategories.length === 0 || selectedCategories.includes(cat);
              const count = info.tasks.filter((t) => t.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategories((prev) =>
                      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                    );
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {CATEGORY_LABELS[cat] ?? cat} ({count})
                </button>
              );
            })}
            {selectedCategories.length > 0 && (
              <button
                onClick={() => setSelectedCategories([])}
                className="rounded-full px-3 py-1 text-xs font-medium border border-border text-muted-foreground hover:bg-muted"
              >
                Clear filters
              </button>
            )}
          </div>
        </Card>
      )}

      {results.length === 0 && !isRunning && (
        <div className="rounded-md border border-dashed p-12 text-center text-muted-foreground">
          <p className="text-lg font-medium">No benchmark results yet</p>
          <p className="mt-2">Click "Run Benchmark" to evaluate your models</p>
        </div>
      )}

      {results.length > 0 && (
        <>
          {/* Model Scorecards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {results.sort((a, b) => b.overallScore - a.overallScore).map((r, idx) => (
              <Card key={r.modelId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardDescription>{r.provider}</CardDescription>
                    {idx === 0 && results.length > 1 && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                        Best
                      </span>
                    )}
                  </div>
                  <CardTitle className="text-lg truncate" title={r.modelId}>
                    {r.modelId}
                  </CardTitle>
                </CardHeader>
                <div className="px-6 pb-6 space-y-3">
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{r.overallScore}</span>
                    <span className="text-muted-foreground">/ 100</span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(r.categoryScores).map(([cat, score]) => (
                      <div key={cat}>
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{CATEGORY_LABELS[cat] ?? cat}</span>
                          <span>{score}%</span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${score}%`,
                              backgroundColor: score >= 80 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444",
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
                    <span>Avg latency: {Math.round(r.totalLatencyMs / Math.max(r.taskResults.length, 1))}ms</span>
                    <span>{r.totalTokens} tokens</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Charts Row */}
          <div className="grid gap-4 md:grid-cols-2">
            {/* Overall Score Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Overall Scores</CardTitle>
                <CardDescription>Quality score by model (0-100)</CardDescription>
              </CardHeader>
              <div className="h-72 px-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overallScoreData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" domain={[0, 100]} />
                    <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="score" fill="#0088FE" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Radar Chart */}
            {radarData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Category Breakdown</CardTitle>
                  <CardDescription>Performance across benchmark categories</CardDescription>
                </CardHeader>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="category" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                      {results.map((r, idx) => {
                        const label = r.modelId.length > 15 ? r.modelId.slice(0, 15) + "..." : r.modelId;
                        return (
                          <Radar
                            key={r.modelId}
                            name={label}
                            dataKey={label}
                            stroke={COLORS[idx % COLORS.length]}
                            fill={COLORS[idx % COLORS.length]}
                            fillOpacity={0.15}
                          />
                        );
                      })}
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </div>

          {/* Latency Comparison */}
          <Card>
            <CardHeader>
              <CardTitle>Latency Comparison</CardTitle>
              <CardDescription>Average response time per task (ms)</CardDescription>
            </CardHeader>
            <div className="h-64 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis label={{ value: "ms", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="avgLatency" fill="#FF8042" name="Avg Latency (ms)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Detailed Results Table */}
          <Card>
            <CardHeader>
              <CardTitle>Detailed Task Results</CardTitle>
              <CardDescription>Per-task scores across all models</CardDescription>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 pr-4 pl-6">Model</th>
                    <th className="pb-3 pr-4">Task</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4">Score</th>
                    <th className="pb-3 pr-4">Latency</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3 pr-6">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {results.flatMap((r) =>
                    r.taskResults.map((tr) => (
                      <tr key={`${r.modelId}-${tr.taskId}`} className="border-b last:border-0">
                        <td className="py-2 pr-4 pl-6 font-medium truncate max-w-[150px]" title={r.modelId}>
                          {r.modelId.length > 20 ? r.modelId.slice(0, 20) + "..." : r.modelId}
                        </td>
                        <td className="py-2 pr-4">{tr.taskId}</td>
                        <td className="py-2 pr-4">
                          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                            {tr.taskId.split("-")[0]}
                          </span>
                        </td>
                        <td className="py-2 pr-4">
                          <span className={`font-medium ${tr.score >= 80 ? "text-green-600" : tr.score >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                            {tr.score}
                          </span>
                        </td>
                        <td className="py-2 pr-4">{tr.latencyMs}ms</td>
                        <td className="py-2 pr-4">
                          <StatusBadge status={tr.passed ? "healthy" : "unhealthy"} label={tr.passed ? "Pass" : "Fail"} />
                        </td>
                        <td className="py-2 pr-6 text-muted-foreground truncate max-w-[250px]" title={tr.details}>
                          {tr.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
