"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { TrendingUp, DollarSign, Zap, Activity } from "lucide-react";

const usageData = [
  { date: "Feb 15", tokens: 45000 },
  { date: "Feb 16", tokens: 52000 },
  { date: "Feb 17", tokens: 48000 },
  { date: "Feb 18", tokens: 61000 },
  { date: "Feb 19", tokens: 55000 },
  { date: "Feb 20", tokens: 67000 },
  { date: "Feb 21", tokens: 72000 },
];

const providerData = [
  { name: "OpenAI", value: 45, color: "#10b981" },
  { name: "Anthropic", value: 30, color: "#3b82f6" },
  { name: "Groq", value: 15, color: "#f59e0b" },
  { name: "Ollama", value: 10, color: "#8b5cf6" },
];

const recentRequests = [
  { id: 1, model: "gpt-4o", tokens: 1250, cost: "$0.025", status: "success", time: "2m ago" },
  { id: 2, model: "claude-3-5-sonnet", tokens: 980, cost: "$0.019", status: "success", time: "5m ago" },
  { id: 3, model: "llama-3.1-70b", tokens: 2100, cost: "$0.00", status: "cached", time: "8m ago" },
  { id: 4, model: "gpt-4o-mini", tokens: 450, cost: "$0.003", status: "success", time: "12m ago" },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="mt-1 text-muted-foreground">Overview of your gateway usage</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Overview of your gateway usage</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Tokens This Month</CardDescription>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">1.2M</CardTitle>
            <p className="text-xs text-green-500">+12% from last month</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Cost This Month</CardDescription>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">$24.80</CardTitle>
            <p className="text-xs text-green-500">Saved $15.20 with cache</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Cache Hit Rate</CardDescription>
              <Zap className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">68%</CardTitle>
            <p className="text-xs text-muted-foreground">4,250 cached entries</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Avg Latency</CardDescription>
              <Activity className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">342ms</CardTitle>
            <p className="text-xs text-green-500">-15ms from last week</p>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Usage Over Time</CardTitle>
            <CardDescription className="text-muted-foreground">Token usage by day</CardDescription>
          </CardHeader>
          <div className="h-64 px-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={usageData}>
                <defs>
                  <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis dataKey="date" stroke="#71717a" fontSize={12} />
                <YAxis stroke="#71717a" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke="#3b82f6"
                  fillOpacity={1}
                  fill="url(#colorTokens)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Provider Distribution</CardTitle>
            <CardDescription className="text-muted-foreground">Usage by provider</CardDescription>
          </CardHeader>
          <div className="h-64 px-4 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={providerData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {providerData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    borderRadius: "6px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Cost Savings Summary</CardTitle>
          <CardDescription className="text-muted-foreground">How caching and routing saves you money</CardDescription>
        </CardHeader>
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Cache Savings</p>
            <p className="text-2xl font-bold text-green-500">$12.40</p>
            <p className="text-xs text-muted-foreground">68% hit rate</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Local Model Usage</p>
            <p className="text-2xl font-bold text-green-500">$2.80</p>
            <p className="text-xs text-muted-foreground">Via Ollama</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Smart Routing</p>
            <p className="text-2xl font-bold text-green-500">$0.60</p>
            <p className="text-xs text-muted-foreground">Optimal provider selection</p>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
          <CardDescription className="text-muted-foreground">Last few API calls</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 px-6">Model</th>
                <th className="pb-3 pr-4">Tokens</th>
                <th className="pb-3 pr-4">Cost</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Time</th>
              </tr>
            </thead>
            <tbody>
              {recentRequests.map((req) => (
                <tr key={req.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-6 font-medium">{req.model}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{req.tokens.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{req.cost}</td>
                  <td className="py-3 pr-4">
                    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                      req.status === "cached" ? "bg-yellow-500/10 text-yellow-500" : "bg-green-500/10 text-green-500"
                    }`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="py-3 text-muted-foreground">{req.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
