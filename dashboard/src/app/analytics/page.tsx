"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { formatCost, formatNumber, formatLatency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

interface CacheStatsData {
  hits: number;
  misses: number;
  hitRate: number;
  estimatedSavingsUsd: number;
  totalEntries: number;
  hitsByModel?: Record<string, number>;
  missesByModel?: Record<string, number>;
}

interface BudgetData {
  tokensUsed: number;
  costUsed: number;
  budget: { monthlyUsd?: number; monthlyTokens?: number };
}

interface ProviderStatus {
  id: string;
  name: string;
  healthy: boolean;
  latencyMs: number;
  modelCount: number;
}

interface BenchmarkResult {
  modelId: string;
  provider: string;
  overallScore: number;
  categoryScores: Record<string, number>;
  totalLatencyMs: number;
  totalTokens: number;
  taskResults: Array<{ taskId: string; score: number; latencyMs: number; tokensUsed: number; passed: boolean }>;
}

export default function AnalyticsPage() {
  const [cacheStats, setCacheStats] = useState<CacheStatsData | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [benchResults, setBenchResults] = useState<BenchmarkResult[]>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cacheRes, budgetRes, provRes, benchRes] = await Promise.allSettled([
          fetch(`${GATEWAY_URL}/api/cache/stats`).then((r) => r.ok ? r.json() : null),
          fetch(`${GATEWAY_URL}/api/budget`).then((r) => r.ok ? r.json() : null),
          fetch(`${GATEWAY_URL}/api/providers`).then((r) => r.ok ? r.json() : null),
          fetch(`${GATEWAY_URL}/api/benchmarks/results`).then((r) => r.ok ? r.json() : null),
        ]);

        if (cacheRes.status === "fulfilled" && cacheRes.value) setCacheStats(cacheRes.value as CacheStatsData);
        if (budgetRes.status === "fulfilled" && budgetRes.value) setBudget(budgetRes.value as BudgetData);
        if (provRes.status === "fulfilled" && provRes.value) setProviders(provRes.value as ProviderStatus[]);
        if (benchRes.status === "fulfilled" && benchRes.value) {
          const data = benchRes.value as BenchmarkResult[];
          if (data.length > 0) setBenchResults(data);
        }
      } catch {
        // Handle error
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const modelHitsData = cacheStats?.hitsByModel
    ? Object.entries(cacheStats.hitsByModel).map(([model, hits]) => ({
        name: model,
        hits,
        misses: cacheStats.missesByModel?.[model] ?? 0,
      }))
    : [];

  const costBreakdown = budget && budget.costUsed > 0
    ? [
        { name: "Spent", value: budget.costUsed },
        { name: "Remaining", value: Math.max(0, (budget.budget.monthlyUsd ?? 100) - budget.costUsed) },
      ]
    : [];

  // Benchmark-derived analytics
  const totalBenchTokens = benchResults.reduce((sum, r) => sum + r.totalTokens, 0);
  const totalBenchLatency = benchResults.reduce((sum, r) => sum + r.totalLatencyMs, 0);
  const totalBenchTasks = benchResults.reduce((sum, r) => sum + r.taskResults.length, 0);

  const benchScoreData = benchResults
    .sort((a, b) => b.overallScore - a.overallScore)
    .map((r) => ({
      name: r.modelId.length > 20 ? r.modelId.slice(0, 20) + "..." : r.modelId,
      score: r.overallScore,
      tokens: r.totalTokens,
      avgLatency: Math.round(r.totalLatencyMs / Math.max(r.taskResults.length, 1)),
    }));

  const providerModelData = providers.map((p) => ({
    name: p.name,
    models: p.modelCount,
    latency: p.latencyMs,
  }));

  // Cost per token comparison from benchmarks
  const tokenEfficiencyData = benchResults.map((r) => {
    const taskCount = r.taskResults.length || 1;
    return {
      name: r.modelId.length > 20 ? r.modelId.slice(0, 20) + "..." : r.modelId,
      tokensPerTask: Math.round(r.totalTokens / taskCount),
      msPerToken: r.totalTokens > 0 ? Math.round(r.totalLatencyMs / r.totalTokens) : 0,
      qualityPerMs: r.totalLatencyMs > 0 ? Number(((r.overallScore / r.totalLatencyMs) * 1000).toFixed(2)) : 0,
    };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Performance analysis, cost efficiency, and model comparison
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Active Providers</CardDescription>
            <CardTitle className="text-2xl">
              {providers.filter((p) => p.healthy).length} / {providers.length}
            </CardTitle>
          </CardHeader>
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            {providers.reduce((sum, p) => sum + p.modelCount, 0)} total models
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gateway Tokens</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(budget?.tokensUsed ?? 0)}
            </CardTitle>
          </CardHeader>
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            Via /v1/chat/completions
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Gateway Cost</CardDescription>
            <CardTitle className="text-2xl">
              {formatCost(budget?.costUsed)}
            </CardTitle>
          </CardHeader>
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            {budget?.costUsed === 0 ? "Ollama = free" : "Cloud provider costs"}
          </p>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Benchmark Tokens</CardDescription>
            <CardTitle className="text-2xl">
              {formatNumber(totalBenchTokens)}
            </CardTitle>
          </CardHeader>
          <p className="px-6 pb-4 text-sm text-muted-foreground">
            {totalBenchTasks} tasks across {benchResults.length} models
          </p>
        </Card>
      </div>

      {/* Cache Stats (only if Redis is running) */}
      {cacheStats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Cache Requests</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(cacheStats.hits + cacheStats.misses)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Hit Rate</CardDescription>
              <CardTitle className="text-2xl">
                {(cacheStats.hitRate * 100).toFixed(1)}%
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Cached Entries</CardDescription>
              <CardTitle className="text-2xl">
                {formatNumber(cacheStats.totalEntries)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Cache Savings</CardDescription>
              <CardTitle className="text-2xl text-green-600">
                {formatCost(cacheStats.estimatedSavingsUsd)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Model Quality Scores */}
        {benchScoreData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Model Quality Ranking</CardTitle>
              <CardDescription>Benchmark scores (0-100) from automated evaluation</CardDescription>
            </CardHeader>
            <div className="h-64 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={benchScoreData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(val: number, name: string) =>
                    name === "score" ? `${val}/100` : name === "avgLatency" ? `${val}ms` : formatNumber(val)
                  } />
                  <Bar dataKey="score" fill="#0088FE" name="Quality Score" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Token Efficiency */}
        {tokenEfficiencyData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Token Efficiency</CardTitle>
              <CardDescription>Tokens per task and quality per millisecond</CardDescription>
            </CardHeader>
            <div className="h-64 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={tokenEfficiencyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="tokensPerTask" fill="#00C49F" name="Tokens/Task" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="msPerToken" fill="#FF8042" name="ms/Token" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Cache by Model (only if data exists) */}
        {modelHitsData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Cache Performance by Model</CardTitle>
              <CardDescription>Hits vs misses per model</CardDescription>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelHitsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="hits" fill="#00C49F" name="Cache Hits" />
                  <Bar dataKey="misses" fill="#FF8042" name="Cache Misses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Cost Breakdown (only if there's actual cost) */}
        {costBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Budget Usage</CardTitle>
              <CardDescription>Monthly budget consumption</CardDescription>
            </CardHeader>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={costBreakdown}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${formatCost(value)}`}
                  >
                    <Cell fill="#FF8042" />
                    <Cell fill="#00C49F" />
                  </Pie>
                  <Tooltip formatter={(val: number) => formatCost(val)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}

        {/* Provider Health */}
        {providerModelData.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Provider Overview</CardTitle>
              <CardDescription>Models and latency per provider</CardDescription>
            </CardHeader>
            <div className="h-64 px-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={providerModelData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" label={{ value: "models", angle: -90, position: "insideLeft" }} />
                  <YAxis yAxisId="right" orientation="right" label={{ value: "ms", angle: 90, position: "insideRight" }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="models" fill="#0088FE" name="Models" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="latency" fill="#FFBB28" name="Latency (ms)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        )}
      </div>

      {/* Detailed Benchmark Analysis */}
      {benchResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Model Comparison</CardTitle>
            <CardDescription>Quality, speed, and efficiency metrics from benchmarks</CardDescription>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 pr-4 pl-6">Model</th>
                  <th className="pb-3 pr-4">Provider</th>
                  <th className="pb-3 pr-4">Quality</th>
                  <th className="pb-3 pr-4">Avg Latency</th>
                  <th className="pb-3 pr-4">Total Tokens</th>
                  <th className="pb-3 pr-4">Tokens/Task</th>
                  <th className="pb-3 pr-6">Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {benchResults.sort((a, b) => b.overallScore - a.overallScore).map((r) => {
                  const taskCount = r.taskResults.length || 1;
                  const avgLatency = Math.round(r.totalLatencyMs / taskCount);
                  const tokensPerTask = Math.round(r.totalTokens / taskCount);
                  const efficiency = r.totalLatencyMs > 0
                    ? ((r.overallScore / r.totalLatencyMs) * 1000).toFixed(1)
                    : "0";
                  return (
                    <tr key={r.modelId} className="border-b last:border-0">
                      <td className="py-3 pr-4 pl-6 font-medium">{r.modelId}</td>
                      <td className="py-3 pr-4">{r.provider}</td>
                      <td className="py-3 pr-4">
                        <span className={`font-bold ${r.overallScore >= 80 ? "text-green-600" : r.overallScore >= 50 ? "text-yellow-600" : "text-red-600"}`}>
                          {r.overallScore}/100
                        </span>
                      </td>
                      <td className="py-3 pr-4">{formatLatency(avgLatency)}</td>
                      <td className="py-3 pr-4">{formatNumber(r.totalTokens)}</td>
                      <td className="py-3 pr-4">{tokensPerTask}</td>
                      <td className="py-3 pr-6 text-muted-foreground">
                        {efficiency} quality/sec
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Cost Explainer */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Tracking</CardTitle>
          <CardDescription>How costs are measured</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6 space-y-3 text-sm text-muted-foreground">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <p className="font-medium text-foreground">Local Models (Ollama)</p>
              <p className="mt-1">Cost: $0.00 — runs on your GPU. The only cost is electricity and VRAM.</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="font-medium text-foreground">Cloud Providers</p>
              <p className="mt-1">OpenAI, Anthropic, Groq, Together AI — billed per token. The gateway tracks cost per request and enforces monthly budgets.</p>
            </div>
          </div>
          <p>
            Add cloud providers by setting API keys in <code className="rounded bg-muted px-1">.env</code> (e.g., <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>).
            The routing engine considers cost when selecting models — use <code className="rounded bg-muted px-1">model: "cheap"</code> to optimize for cost.
          </p>
        </div>
      </Card>

      {/* Budget Details */}
      {budget && (budget.budget.monthlyTokens || budget.budget.monthlyUsd) && (
        <Card>
          <CardHeader>
            <CardTitle>Budget Limits</CardTitle>
          </CardHeader>
          <div className="grid gap-6 sm:grid-cols-2 px-6 pb-6">
            {budget.budget.monthlyTokens && (
              <div>
                <p className="text-sm text-muted-foreground">Token Budget</p>
                <p className="text-3xl font-bold">{formatNumber(budget.tokensUsed)}</p>
                <div className="mt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all"
                      style={{
                        width: `${Math.min(100, (budget.tokensUsed / budget.budget.monthlyTokens) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {((budget.tokensUsed / budget.budget.monthlyTokens) * 100).toFixed(1)}% of {formatNumber(budget.budget.monthlyTokens)} limit
                  </p>
                </div>
              </div>
            )}
            {budget.budget.monthlyUsd && (
              <div>
                <p className="text-sm text-muted-foreground">Cost Budget</p>
                <p className="text-3xl font-bold">{formatCost(budget.costUsed)}</p>
                <div className="mt-2">
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-green-500 transition-all"
                      style={{
                        width: `${Math.min(100, (budget.costUsed / budget.budget.monthlyUsd) * 100)}%`,
                      }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {((budget.costUsed / budget.budget.monthlyUsd) * 100).toFixed(1)}% of {formatCost(budget.budget.monthlyUsd)} limit
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
