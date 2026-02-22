"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Select } from "@/components/ui/select";
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";

const usageData = [
  { date: "Feb 15", openai: 15000, anthropic: 12000, groq: 8000, ollama: 5000 },
  { date: "Feb 16", openai: 18000, anthropic: 14000, groq: 10000, ollama: 6000 },
  { date: "Feb 17", openai: 16000, anthropic: 13000, groq: 9000, ollama: 5500 },
  { date: "Feb 18", openai: 21000, anthropic: 16000, groq: 12000, ollama: 7000 },
  { date: "Feb 19", openai: 19000, anthropic: 15000, groq: 11000, ollama: 6500 },
  { date: "Feb 20", openai: 23000, anthropic: 18000, groq: 13000, ollama: 8000 },
  { date: "Feb 21", openai: 25000, anthropic: 20000, groq: 15000, ollama: 9000 },
];

const costBreakdown = [
  { provider: "OpenAI", tokens: 125000, cost: 12.50, percentage: 50 },
  { provider: "Anthropic", tokens: 98000, cost: 9.80, percentage: 39 },
  { provider: "Groq", tokens: 72000, cost: 2.16, percentage: 9 },
  { provider: "Ollama", tokens: 45000, cost: 0.00, percentage: 2 },
];

const modelUsage = [
  { model: "gpt-4o", requests: 450, tokens: 85000, cost: "$8.50" },
  { model: "claude-3-5-sonnet", requests: 380, tokens: 72000, cost: "$7.20" },
  { model: "llama-3.1-70b-versatile", requests: 290, tokens: 68000, cost: "$2.04" },
  { model: "gpt-4o-mini", requests: 520, tokens: 45000, cost: "$1.35" },
  { model: "llama-3.1-8b", requests: 180, tokens: 35000, cost: "$0.00" },
];

export default function UsagePage() {
  const [dateRange, setDateRange] = useState("7d");

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Usage Analytics</h1>
          <p className="mt-1 text-muted-foreground">Track your token usage and costs</p>
        </div>
        <Select value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader>
            <CardDescription className="text-muted-foreground">Total Tokens</CardDescription>
            <CardTitle className="text-2xl">340K</CardTitle>
            <p className="text-xs text-green-500">+18% from previous period</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardDescription className="text-muted-foreground">Total Cost</CardDescription>
            <CardTitle className="text-2xl">$24.80</CardTitle>
            <p className="text-xs text-green-500">Saved $15.20 with cache</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardDescription className="text-muted-foreground">Avg Cost per 1K Tokens</CardDescription>
            <CardTitle className="text-2xl">$0.073</CardTitle>
            <p className="text-xs text-muted-foreground">Mixed provider usage</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Token Usage by Provider</CardTitle>
          <CardDescription className="text-muted-foreground">
            Stacked area chart showing usage across providers
          </CardDescription>
        </CardHeader>
        <div className="h-80 px-4 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={usageData}>
              <defs>
                <linearGradient id="colorOpenai" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorAnthropic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorGroq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorOllama" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
              <Legend />
              <Area
                type="monotone"
                dataKey="openai"
                stackId="1"
                stroke="#10b981"
                fill="url(#colorOpenai)"
                name="OpenAI"
              />
              <Area
                type="monotone"
                dataKey="anthropic"
                stackId="1"
                stroke="#3b82f6"
                fill="url(#colorAnthropic)"
                name="Anthropic"
              />
              <Area
                type="monotone"
                dataKey="groq"
                stackId="1"
                stroke="#f59e0b"
                fill="url(#colorGroq)"
                name="Groq"
              />
              <Area
                type="monotone"
                dataKey="ollama"
                stackId="1"
                stroke="#8b5cf6"
                fill="url(#colorOllama)"
                name="Ollama"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Cost Breakdown by Provider</CardTitle>
          <CardDescription className="text-muted-foreground">
            Total spend per provider
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 px-6">Provider</th>
                <th className="pb-3 pr-4">Tokens</th>
                <th className="pb-3 pr-4">Cost</th>
                <th className="pb-3 pr-4">% of Total</th>
                <th className="pb-3">Cost/1K Tokens</th>
              </tr>
            </thead>
            <tbody>
              {costBreakdown.map((item) => (
                <tr key={item.provider} className="border-b border-border last:border-0">
                  <td className="py-3 px-6 font-medium">{item.provider}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{item.tokens.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-muted-foreground">${item.cost.toFixed(2)}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 bg-accent rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500"
                          style={{ width: `${item.percentage}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground">{item.percentage}%</span>
                    </div>
                  </td>
                  <td className="py-3 text-muted-foreground">
                    ${(item.cost / (item.tokens / 1000)).toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Model Usage Distribution</CardTitle>
          <CardDescription className="text-muted-foreground">
            Requests and costs by model
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 px-6">Model</th>
                <th className="pb-3 pr-4">Requests</th>
                <th className="pb-3 pr-4">Tokens</th>
                <th className="pb-3">Cost</th>
              </tr>
            </thead>
            <tbody>
              {modelUsage.map((model) => (
                <tr key={model.model} className="border-b border-border last:border-0">
                  <td className="py-3 px-6 font-medium">{model.model}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{model.requests.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{model.tokens.toLocaleString()}</td>
                  <td className="py-3 text-muted-foreground">{model.cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Cache Performance</CardTitle>
          <CardDescription className="text-muted-foreground">
            Impact of semantic caching on costs
          </CardDescription>
        </CardHeader>
        <div className="grid gap-4 p-6 md:grid-cols-3">
          <div>
            <p className="text-sm text-muted-foreground">Hit Rate</p>
            <p className="text-2xl font-bold">68%</p>
            <p className="text-xs text-muted-foreground">4,250 hits / 6,180 requests</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Saved Requests</p>
            <p className="text-2xl font-bold">4,250</p>
            <p className="text-xs text-muted-foreground">Served from cache</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Cost Savings</p>
            <p className="text-2xl font-bold text-green-500">$15.20</p>
            <p className="text-xs text-muted-foreground">38% reduction</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
