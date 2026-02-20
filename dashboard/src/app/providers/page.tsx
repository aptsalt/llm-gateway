"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { StatusBadge } from "@/components/status-badge";
import { formatLatency } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from "recharts";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

interface ProviderStatus {
  id: string;
  name: string;
  healthy: boolean;
  latencyMs: number;
  modelCount: number;
  lastCheck: number;
}

interface CircuitBreakerStats {
  state: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime: number;
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [breakers, setBreakers] = useState<Record<string, CircuitBreakerStats>>({});
  const [latencyHistory, setLatencyHistory] = useState<Array<Record<string, number>>>([]);

  useEffect(() => {
    async function fetchData() {
      try {
        const [provRes, breakerRes] = await Promise.allSettled([
          fetch(`${GATEWAY_URL}/api/providers`).then((r) => r.json()),
          fetch(`${GATEWAY_URL}/api/circuit-breakers`).then((r) => r.json()),
        ]);

        if (provRes.status === "fulfilled") {
          const data = provRes.value as ProviderStatus[];
          setProviders(data);
          setLatencyHistory((prev) => {
            const point: Record<string, number> = { time: Date.now() };
            data.forEach((p) => { point[p.id] = p.latencyMs; });
            const next = [...prev, point];
            return next.slice(-30); // Keep last 30 data points
          });
        }
        if (breakerRes.status === "fulfilled") setBreakers(breakerRes.value as Record<string, CircuitBreakerStats>);
      } catch {
        // Silently handle fetch errors
      }
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Providers</h1>
        <p className="mt-1 text-muted-foreground">
          Monitor and manage LLM provider connections
        </p>
      </div>

      {/* Latency Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Latency Over Time</CardTitle>
          <CardDescription>Health check latency per provider (last 30 samples)</CardDescription>
        </CardHeader>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyHistory}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" tickFormatter={() => ""} />
              <YAxis label={{ value: "ms", angle: -90, position: "insideLeft" }} />
              <Tooltip
                labelFormatter={() => ""}
                formatter={(val: number) => formatLatency(val)}
              />
              {providers.map((p, i) => (
                <Line
                  key={p.id}
                  type="monotone"
                  dataKey={p.id}
                  name={p.name}
                  stroke={["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"][i % 5]}
                  dot={false}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Provider Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {providers.map((provider) => {
          const breakerState = breakers[provider.id];
          return (
            <Card key={provider.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{provider.name}</CardTitle>
                  <StatusBadge status={provider.healthy ? "healthy" : "unhealthy"} />
                </div>
                <CardDescription>ID: {provider.id}</CardDescription>
              </CardHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Latency</span>
                  <span className="font-medium">{formatLatency(provider.latencyMs)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Models</span>
                  <span className="font-medium">{provider.modelCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Circuit Breaker</span>
                  <span className="font-medium">
                    {breakerState ? (
                      <StatusBadge
                        status={
                          breakerState.state === "closed" ? "healthy" :
                          breakerState.state === "half-open" ? "degraded" : "unhealthy"
                        }
                        label={breakerState.state}
                      />
                    ) : (
                      "N/A"
                    )}
                  </span>
                </div>
                {breakerState && breakerState.failureCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Failures</span>
                    <span className="font-medium text-red-600">{breakerState.failureCount}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last Check</span>
                  <span className="font-medium">
                    {provider.lastCheck ? new Date(provider.lastCheck).toLocaleTimeString() : "Never"}
                  </span>
                </div>
              </div>
            </Card>
          );
        })}
        {providers.length === 0 && (
          <Card className="col-span-full">
            <div className="py-8 text-center text-muted-foreground">
              No providers connected. Start the gateway first.
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
