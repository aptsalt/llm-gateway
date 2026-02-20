"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { formatCost, formatNumber } from "@/lib/utils";
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
  hitsByModel: Record<string, number>;
  missesByModel: Record<string, number>;
}

interface BudgetData {
  tokensUsed: number;
  costUsed: number;
  budget: { monthlyUsd?: number; monthlyTokens?: number };
}

export default function AnalyticsPage() {
  const [cacheStats, setCacheStats] = useState<CacheStatsData | null>(null);
  const [budget, setBudget] = useState<BudgetData | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const [cacheRes, budgetRes] = await Promise.allSettled([
          fetch(`${GATEWAY_URL}/api/cache/stats`).then((r) => r.json()),
          fetch(`${GATEWAY_URL}/api/budget`).then((r) => r.json()),
        ]);

        if (cacheRes.status === "fulfilled") setCacheStats(cacheRes.value as CacheStatsData);
        if (budgetRes.status === "fulfilled") setBudget(budgetRes.value as BudgetData);
      } catch {
        // Handle error
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const modelHitsData = cacheStats
    ? Object.entries(cacheStats.hitsByModel).map(([model, hits]) => ({
        name: model,
        hits,
        misses: cacheStats.missesByModel[model] ?? 0,
      }))
    : [];

  const costBreakdown = budget
    ? [
        { name: "Spent", value: budget.costUsed },
        { name: "Remaining", value: Math.max(0, (budget.budget.monthlyUsd ?? 100) - budget.costUsed) },
      ]
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Analytics</h1>
        <p className="mt-1 text-muted-foreground">
          Cost breakdown, cache effectiveness, and usage patterns
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Total Requests</CardDescription>
            <CardTitle className="text-2xl">
              {cacheStats ? formatNumber(cacheStats.hits + cacheStats.misses) : "0"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cache Hit Rate</CardDescription>
            <CardTitle className="text-2xl">
              {cacheStats ? `${(cacheStats.hitRate * 100).toFixed(1)}%` : "0%"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Cost</CardDescription>
            <CardTitle className="text-2xl">
              {budget ? formatCost(budget.costUsed) : "$0.00"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Cache Savings</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {cacheStats ? formatCost(cacheStats.estimatedSavingsUsd) : "$0.00"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Cache by Model */}
        <Card>
          <CardHeader>
            <CardTitle>Cache Performance by Model</CardTitle>
            <CardDescription>Hits vs misses per model</CardDescription>
          </CardHeader>
          <div className="h-64">
            {modelHitsData.length > 0 ? (
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
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No data yet
              </div>
            )}
          </div>
        </Card>

        {/* Cost Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Budget Usage</CardTitle>
            <CardDescription>Monthly budget consumption</CardDescription>
          </CardHeader>
          <div className="h-64">
            {costBreakdown.length > 0 && costBreakdown.some((d) => d.value > 0) ? (
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
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                No cost data yet
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Token Usage Details */}
      {budget && (
        <Card>
          <CardHeader>
            <CardTitle>Usage Details</CardTitle>
          </CardHeader>
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm text-muted-foreground">Tokens Used This Month</p>
              <p className="text-3xl font-bold">{formatNumber(budget.tokensUsed)}</p>
              {budget.budget.monthlyTokens && (
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
                    {((budget.tokensUsed / budget.budget.monthlyTokens) * 100).toFixed(1)}% of{" "}
                    {formatNumber(budget.budget.monthlyTokens)} limit
                  </p>
                </div>
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cost This Month</p>
              <p className="text-3xl font-bold">{formatCost(budget.costUsed)}</p>
              {budget.budget.monthlyUsd && (
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
                    {((budget.costUsed / budget.budget.monthlyUsd) * 100).toFixed(1)}% of{" "}
                    {formatCost(budget.budget.monthlyUsd)} limit
                  </p>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
