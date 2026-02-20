"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { formatCost, formatNumber, formatLatency } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

interface ProviderStatus {
  id: string;
  name: string;
  healthy: boolean;
  latencyMs: number;
  modelCount: number;
}

interface CacheStatsData {
  hits: number;
  misses: number;
  hitRate: number;
  estimatedSavingsUsd: number;
  totalEntries: number;
}

interface BudgetData {
  tokensUsed: number;
  costUsed: number;
  budget: { monthlyUsd?: number; monthlyTokens?: number };
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"];

export default function OverviewPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [cacheStats, setCacheStats] = useState<CacheStatsData | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [provRes, cacheRes, budgetRes] = await Promise.allSettled([
          fetch(`${GATEWAY_URL}/api/providers`).then((r) => r.json()),
          fetch(`${GATEWAY_URL}/api/cache/stats`).then((r) => r.json()),
          fetch(`${GATEWAY_URL}/api/budget`).then((r) => r.json()),
        ]);

        if (provRes.status === "fulfilled") setProviders(provRes.value as ProviderStatus[]);
        if (cacheRes.status === "fulfilled") setCacheStats(cacheRes.value as CacheStatsData);
        if (budgetRes.status === "fulfilled") setBudget(budgetRes.value as BudgetData);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch data");
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const healthyCount = providers.filter((p) => p.healthy).length;
  const totalModels = providers.reduce((sum, p) => sum + p.modelCount, 0);

  const providerLatencyData = providers.map((p) => ({
    name: p.name,
    latency: p.latencyMs,
  }));

  const cacheChartData = cacheStats
    ? [
        { name: "Hits", value: cacheStats.hits },
        { name: "Misses", value: cacheStats.misses },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Real-time overview of your LLM Gateway
        </p>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
          Gateway not reachable: {error}. Make sure the gateway is running on {GATEWAY_URL}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Active Providers</CardDescription>
            <CardTitle className="text-2xl">
              {healthyCount} / {providers.length}
            </CardTitle>
          </CardHeader>
          <StatusBadge
            status={healthyCount === providers.length ? "healthy" : healthyCount > 0 ? "degraded" : "unhealthy"}
            label={healthyCount === providers.length ? "All healthy" : `${healthyCount} healthy`}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Available Models</CardDescription>
            <CardTitle className="text-2xl">{totalModels}</CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            Across {providers.length} providers
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Cache Hit Rate</CardDescription>
            <CardTitle className="text-2xl">
              {cacheStats ? `${(cacheStats.hitRate * 100).toFixed(1)}%` : "N/A"}
            </CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground">
            {cacheStats ? `${cacheStats.totalEntries} cached entries` : "Cache not available"}
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>Cost Savings</CardDescription>
            <CardTitle className="text-2xl">
              {cacheStats ? formatCost(cacheStats.estimatedSavingsUsd) : "N/A"}
            </CardTitle>
          </CardHeader>
          <p className="text-sm text-muted-foreground">From semantic caching</p>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Provider Latency</CardTitle>
            <CardDescription>Average response time by provider</CardDescription>
          </CardHeader>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={providerLatencyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis label={{ value: "ms", angle: -90, position: "insideLeft" }} />
                <Tooltip formatter={(val: number) => formatLatency(val)} />
                <Bar dataKey="latency" fill="#0088FE" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cache Performance</CardTitle>
            <CardDescription>Hit vs miss distribution</CardDescription>
          </CardHeader>
          <div className="h-64">
            {cacheChartData.length > 0 && (cacheChartData[0]!.value > 0 || cacheChartData[1]!.value > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={cacheChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {cacheChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No cache data yet
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Provider Status Table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider Status</CardTitle>
          <CardDescription>Real-time health of all configured providers</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4">Provider</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Latency</th>
                <th className="pb-3">Models</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{provider.name}</td>
                  <td className="py-3 pr-4">
                    <StatusBadge status={provider.healthy ? "healthy" : "unhealthy"} />
                  </td>
                  <td className="py-3 pr-4">{formatLatency(provider.latencyMs)}</td>
                  <td className="py-3">{provider.modelCount}</td>
                </tr>
              ))}
              {providers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-muted-foreground">
                    No providers connected. Start the gateway first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Budget Status */}
      {budget && (
        <Card>
          <CardHeader>
            <CardTitle>Budget Status</CardTitle>
            <CardDescription>Global usage tracking</CardDescription>
          </CardHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Tokens Used</p>
              <p className="text-2xl font-bold">{formatNumber(budget.tokensUsed)}</p>
              {budget.budget.monthlyTokens && (
                <p className="text-sm text-muted-foreground">
                  of {formatNumber(budget.budget.monthlyTokens)} monthly limit
                </p>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost</p>
              <p className="text-2xl font-bold">{formatCost(budget.costUsed)}</p>
              {budget.budget.monthlyUsd && (
                <p className="text-sm text-muted-foreground">
                  of {formatCost(budget.budget.monthlyUsd)} monthly limit
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
