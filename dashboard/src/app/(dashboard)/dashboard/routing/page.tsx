"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";

export default function RoutingPage() {
  const [strategy, setStrategy] = useState("balanced");
  const [costWeight, setCostWeight] = useState(0.33);
  const [qualityWeight, setQualityWeight] = useState(0.34);
  const [latencyWeight, setLatencyWeight] = useState(0.33);
  const [preferLocal, setPreferLocal] = useState(false);

  const handleSave = () => {
    toast.success("Routing configuration saved successfully");
  };

  const normalizeWeights = (cost: number, quality: number, latency: number) => {
    const total = cost + quality + latency;
    if (total === 0) return { cost: 0.33, quality: 0.34, latency: 0.33 };
    return {
      cost: cost / total,
      quality: quality / total,
      latency: latency / total,
    };
  };

  const handleCostChange = (value: number) => {
    const weights = normalizeWeights(value, qualityWeight, latencyWeight);
    setCostWeight(weights.cost);
    setQualityWeight(weights.quality);
    setLatencyWeight(weights.latency);
  };

  const handleQualityChange = (value: number) => {
    const weights = normalizeWeights(costWeight, value, latencyWeight);
    setCostWeight(weights.cost);
    setQualityWeight(weights.quality);
    setLatencyWeight(weights.latency);
  };

  const handleLatencyChange = (value: number) => {
    const weights = normalizeWeights(costWeight, qualityWeight, value);
    setCostWeight(weights.cost);
    setQualityWeight(weights.quality);
    setLatencyWeight(weights.latency);
  };

  const setPreset = (preset: string) => {
    setStrategy(preset);
    switch (preset) {
      case "cost":
        setCostWeight(0.70);
        setQualityWeight(0.20);
        setLatencyWeight(0.10);
        break;
      case "quality":
        setCostWeight(0.10);
        setQualityWeight(0.70);
        setLatencyWeight(0.20);
        break;
      case "latency":
        setCostWeight(0.10);
        setQualityWeight(0.20);
        setLatencyWeight(0.70);
        break;
      case "balanced":
        setCostWeight(0.33);
        setQualityWeight(0.34);
        setLatencyWeight(0.33);
        break;
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Routing Configuration</h1>
        <p className="mt-1 text-zinc-400">
          Configure how the gateway selects providers
        </p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Routing Strategy</CardTitle>
          <CardDescription className="text-zinc-400">
            Choose a preset or customize weights
          </CardDescription>
        </CardHeader>
        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="strategy" className="text-sm font-medium">
              Preset Strategy
            </label>
            <Select
              id="strategy"
              value={strategy}
              onChange={(e) => setPreset(e.target.value)}
            >
              <option value="balanced">Balanced</option>
              <option value="cost">Cost Optimized</option>
              <option value="quality">Quality Optimized</option>
              <option value="latency">Latency Optimized</option>
            </Select>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Cost Weight</label>
                <span className="text-sm text-zinc-400">{(costWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={costWeight}
                onChange={(e) => handleCostChange(parseFloat(e.target.value))}
              />
              <p className="text-xs text-zinc-500">
                Higher values prioritize cheaper providers
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Quality Weight</label>
                <span className="text-sm text-zinc-400">{(qualityWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={qualityWeight}
                onChange={(e) => handleQualityChange(parseFloat(e.target.value))}
              />
              <p className="text-xs text-zinc-500">
                Higher values prioritize better model quality
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Latency Weight</label>
                <span className="text-sm text-zinc-400">{(latencyWeight * 100).toFixed(0)}%</span>
              </div>
              <Slider
                min={0}
                max={1}
                step={0.01}
                value={latencyWeight}
                onChange={(e) => handleLatencyChange(parseFloat(e.target.value))}
              />
              <p className="text-xs text-zinc-500">
                Higher values prioritize faster responses
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-zinc-800 p-4">
            <div>
              <p className="text-sm font-medium">Prefer Local Models</p>
              <p className="text-xs text-zinc-500">
                Prioritize Ollama models when available
              </p>
            </div>
            <button
              onClick={() => setPreferLocal(!preferLocal)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                preferLocal ? "bg-blue-500" : "bg-zinc-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  preferLocal ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <Button onClick={handleSave} className="w-full">
            Save Configuration
          </Button>
        </div>
      </Card>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>How It Works</CardTitle>
          <CardDescription className="text-zinc-400">
            Understanding the routing algorithm
          </CardDescription>
        </CardHeader>
        <div className="p-6 space-y-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">Weighted Score Calculation</h3>
            <p className="text-zinc-400">
              Each provider receives a score based on the weighted combination of cost, quality, and latency.
              The provider with the highest score is selected for each request.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Cost Factor</h3>
            <p className="text-zinc-400">
              Providers with lower per-token costs score higher on this metric.
              Ollama (local) models have zero cost.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Quality Factor</h3>
            <p className="text-zinc-400">
              Based on benchmark scores for reasoning, coding, and general capabilities.
              GPT-4 and Claude models typically score highest.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Latency Factor</h3>
            <p className="text-zinc-400">
              Measured as average response time. Groq and local models are typically fastest.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
