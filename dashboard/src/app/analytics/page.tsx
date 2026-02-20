"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { formatCost, formatNumber, formatLatency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";


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

  const monthlyBudgetUsd = budget?.budget.monthlyUsd ?? 100;
  const currentCost = budget?.costUsed ?? 0;
  const costBreakdown = [
    { name: "Spent", value: currentCost || 0.001 }, // tiny value so pie renders even at $0
    { name: "Remaining", value: Math.max(0.001, monthlyBudgetUsd - currentCost) },
  ];

  // Provider pricing reference data
  const providerPricing = [
    { provider: "Ollama (local)", model: "Any local model", input: "$0.00", output: "$0.00", note: "Free — runs on your GPU" },
    { provider: "Groq", model: "Llama 3.3 70B", input: "$0.00059", output: "$0.00079", note: "Fast inference API" },
    { provider: "OpenAI", model: "GPT-4o", input: "$0.0025", output: "$0.01", note: "High quality" },
    { provider: "OpenAI", model: "GPT-4o-mini", input: "$0.00015", output: "$0.0006", note: "Cost-efficient" },
    { provider: "Anthropic", model: "Claude Sonnet 4", input: "$0.003", output: "$0.015", note: "Top quality" },
    { provider: "Anthropic", model: "Claude 3.5 Haiku", input: "$0.001", output: "$0.005", note: "Fast + cheap" },
    { provider: "Together AI", model: "Llama 3.3 70B Turbo", input: "$0.00088", output: "$0.00088", note: "Open-source hosting" },
  ];

  // Benchmark-derived analytics
  const totalBenchTokens = benchResults.reduce((sum, r) => sum + r.totalTokens, 0);

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

        {/* Cost Budget Usage — always visible */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Usage</CardTitle>
            <CardDescription>
              {currentCost === 0
                ? "No cloud spend yet — local models are free"
                : "Monthly budget consumption"}
            </CardDescription>
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
                  label={({ name }) => `${name}: ${name === "Spent" ? formatCost(currentCost) : formatCost(monthlyBudgetUsd - currentCost)}`}
                >
                  <Cell fill={currentCost > 0 ? "#FF8042" : "#e5e7eb"} />
                  <Cell fill="#00C49F" />
                </Pie>
                <Tooltip formatter={(_val: number, name: string) =>
                  name === "Spent" ? formatCost(currentCost) : formatCost(monthlyBudgetUsd - currentCost)
                } />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

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
                  <th className="pb-3 pr-4">Est. Cost</th>
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
                  // Estimate cost: Ollama = $0, cloud = lookup from pricing data
                  const isLocal = r.provider === "ollama";
                  const estCostPer1k = isLocal ? 0 : 0.001; // conservative default for unknown cloud models
                  const estCost = (r.totalTokens / 1000) * estCostPer1k;
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
                      <td className="py-3 pr-4 font-mono">
                        {isLocal
                          ? <span className="text-green-600">$0.00</span>
                          : <span>{formatCost(estCost)}</span>}
                      </td>
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

      {/* Provider Cost Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Cost Comparison</CardTitle>
          <CardDescription>Per 1K token pricing across supported providers</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4 pl-6">Provider</th>
                <th className="pb-3 pr-4">Model</th>
                <th className="pb-3 pr-4">Input / 1K</th>
                <th className="pb-3 pr-4">Output / 1K</th>
                <th className="pb-3 pr-6">Note</th>
              </tr>
            </thead>
            <tbody>
              {providerPricing.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="py-3 pr-4 pl-6 font-medium">{row.provider}</td>
                  <td className="py-3 pr-4">{row.model}</td>
                  <td className="py-3 pr-4 font-mono">{row.input}</td>
                  <td className="py-3 pr-4 font-mono">{row.output}</td>
                  <td className="py-3 pr-6 text-muted-foreground">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-6 pb-6 pt-4 text-sm text-muted-foreground space-y-2">
          <p>
            Add cloud providers by setting API keys in <code className="rounded bg-muted px-1">.env</code> (e.g., <code className="rounded bg-muted px-1">OPENAI_API_KEY</code>, <code className="rounded bg-muted px-1">ANTHROPIC_API_KEY</code>).
            The gateway tracks cost per request automatically and enforces monthly budgets.
          </p>
          <p>
            Use <code className="rounded bg-muted px-1">model: &quot;cheap&quot;</code> to route to the cheapest available model, or <code className="rounded bg-muted px-1">model: &quot;auto&quot;</code> to let the routing engine balance cost, quality, and latency.
          </p>
        </div>
      </Card>

      {/* Budget Limits — always visible */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Limits</CardTitle>
          <CardDescription>
            {budget?.budget.monthlyTokens || budget?.budget.monthlyUsd
              ? "Configured monthly limits"
              : "Set TOKEN_BUDGET_MONTHLY_TOKENS / TOKEN_BUDGET_MONTHLY_USD in .env to enforce limits"}
          </CardDescription>
        </CardHeader>
        <div className="grid gap-6 sm:grid-cols-2 px-6 pb-6">
          <div>
            <p className="text-sm text-muted-foreground">Token Usage</p>
            <p className="text-3xl font-bold">{formatNumber(budget?.tokensUsed ?? 0)}</p>
            <div className="mt-2">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all"
                  style={{
                    width: budget?.budget.monthlyTokens
                      ? `${Math.min(100, ((budget.tokensUsed) / budget.budget.monthlyTokens) * 100)}%`
                      : "0%",
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {budget?.budget.monthlyTokens
                  ? `${((budget.tokensUsed / budget.budget.monthlyTokens) * 100).toFixed(1)}% of ${formatNumber(budget.budget.monthlyTokens)} limit`
                  : "No token limit configured"}
              </p>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cost Usage</p>
            <p className="text-3xl font-bold">{formatCost(currentCost)}</p>
            <div className="mt-2">
              <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${Math.min(100, (currentCost / monthlyBudgetUsd) * 100)}%`,
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {currentCost === 0
                  ? `$0.00 of ${formatCost(monthlyBudgetUsd)} budget — cloud API calls will show cost here`
                  : `${((currentCost / monthlyBudgetUsd) * 100).toFixed(1)}% of ${formatCost(monthlyBudgetUsd)} limit`}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
