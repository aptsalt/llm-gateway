"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { toast } from "sonner";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

interface RoutingConfig {
  strategy: string;
  weights?: { cost: number; quality: number; latency: number };
  constraints: {
    maxCostPer1kTokens?: number;
    maxLatencyMs?: number;
    requiredCapabilities?: string[];
    preferLocal?: boolean;
  };
  fallbackChain: string[];
}

const strategies = [
  { value: "balanced", label: "Balanced", description: "Weighted mix of cost, quality, and latency" },
  { value: "cost", label: "Cost Optimized", description: "Minimize cost, prefer free/cheap models" },
  { value: "quality", label: "Quality Optimized", description: "Best model quality regardless of cost" },
  { value: "latency", label: "Latency Optimized", description: "Fastest response time" },
];

export default function RoutingPage() {
  const [config, setConfig] = useState<RoutingConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${GATEWAY_URL}/api/admin/routing`)
      .then((r) => r.json())
      .then((data) => setConfig(data as RoutingConfig))
      .catch(() => {});
  }, []);

  async function handleSave() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch(`${GATEWAY_URL}/api/admin/routing`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("adminKey") ?? ""}`,
        },
        body: JSON.stringify(config),
      });
      if (res.ok) toast.success("Routing configuration saved");
      else toast.error("Failed to save configuration");
    } catch {
      toast.error("Failed to save configuration");
    }
    setSaving(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Routing</h1>
        <p className="mt-1 text-muted-foreground">
          Configure how requests are routed to providers
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Routing Strategy</CardTitle>
          <CardDescription>Select the primary routing strategy</CardDescription>
        </CardHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {strategies.map((s) => (
            <button
              key={s.value}
              onClick={() => setConfig((prev) => prev ? { ...prev, strategy: s.value } : null)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                config?.strategy === s.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "hover:bg-secondary"
              }`}
            >
              <div className="font-medium">{s.label}</div>
              <div className="mt-1 text-sm text-muted-foreground">{s.description}</div>
            </button>
          ))}
        </div>
      </Card>

      {config?.weights && (
        <Card>
          <CardHeader>
            <CardTitle>Weights</CardTitle>
            <CardDescription>Adjust the weight of each factor (must sum to 1.0)</CardDescription>
          </CardHeader>
          <div className="space-y-4">
            {(["cost", "quality", "latency"] as const).map((key) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="capitalize">{key}</span>
                  <span className="font-mono">{config.weights![key].toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={config.weights![key] * 100}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) / 100;
                    setConfig((prev) => prev ? {
                      ...prev,
                      weights: { ...prev.weights!, [key]: val },
                    } : null);
                  }}
                  className="w-full"
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Constraints</CardTitle>
          <CardDescription>Set limits on routing decisions</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={config?.constraints.preferLocal ?? true}
              onChange={(e) =>
                setConfig((prev) => prev ? {
                  ...prev,
                  constraints: { ...prev.constraints, preferLocal: e.target.checked },
                } : null)
              }
              className="h-4 w-4 rounded border-gray-300"
            />
            <div>
              <div className="text-sm font-medium">Prefer Local Models</div>
              <div className="text-xs text-muted-foreground">
                Route to Ollama when competitive with cloud providers
              </div>
            </div>
          </label>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fallback Chain</CardTitle>
          <CardDescription>Order of providers to try on failure</CardDescription>
        </CardHeader>
        <div className="space-y-2">
          {config?.fallbackChain.map((provider, index) => (
            <div
              key={provider}
              className="flex items-center gap-3 rounded-md border px-4 py-2"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium">
                {index + 1}
              </span>
              <span className="font-medium capitalize">{provider}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Configuration"}
        </button>
      </div>
    </div>
  );
}
