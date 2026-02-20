"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { formatCost, formatLatency } from "@/lib/utils";
import { toast } from "sonner";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

interface GatewayMetadata {
  provider: string;
  routing_decision: string;
  latency_ms: number;
  cost_usd: number;
  cache_hit: boolean;
  fallback_used: boolean;
}

interface ChatResponse {
  id: string;
  model: string;
  choices: Array<{ message: { content: string }; finish_reason: string }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  "x-gateway": GatewayMetadata;
}

interface ModelInfo {
  id: string;
  owned_by: string;
}

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("auto");
  const [strategy, setStrategy] = useState("balanced");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    fetch(`${GATEWAY_URL}/v1/models`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.data) setModels(data.data as ModelInfo[]);
      })
      .catch(() => {});
  }, []);

  const modelsByProvider = models.reduce<Record<string, ModelInfo[]>>((acc, m) => {
    const provider = m.owned_by || "unknown";
    if (!acc[provider]) acc[provider] = [];
    acc[provider].push(m);
    return acc;
  }, {});

  async function sendRequest() {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["Authorization"] = `Bearer ${apiKey}`;

      const res = await fetch(`${GATEWAY_URL}/v1/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          "x-routing-strategy": strategy,
          "x-cache": true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const msg = (data as { error?: { message?: string } }).error?.message ?? "Request failed";
        setError(msg);
        toast.error(msg);
      } else {
        setResponse(data as ChatResponse);
        const gw = (data as ChatResponse)["x-gateway"];
        toast.success(`Response from ${gw.provider} in ${formatLatency(gw.latency_ms)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Network error";
      setError(msg);
      toast.error(msg);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Playground</h1>
        <p className="mt-1 text-muted-foreground">
          Test requests with different models and routing strategies
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Request</CardTitle>
            </CardHeader>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium">API Key (optional)</label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="gw-dev-..."
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <optgroup label="Virtual Models (Router)">
                      <option value="auto">auto (router decides)</option>
                      <option value="fast">fast (latency-optimized)</option>
                      <option value="cheap">cheap (cost-optimized)</option>
                      <option value="quality">quality (best quality)</option>
                    </optgroup>
                    {Object.entries(modelsByProvider).map(([provider, provModels]) => (
                      <optgroup key={provider} label={provider}>
                        {provModels.map((m) => (
                          <option key={m.id} value={m.id}>{m.id}</option>
                        ))}
                      </optgroup>
                    ))}
                    {models.length === 0 && (
                      <optgroup label="Ollama">
                        <option value="llama3.2">llama3.2</option>
                        <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Routing Strategy</label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                  >
                    <option value="balanced">Balanced</option>
                    <option value="cost">Cost Optimized</option>
                    <option value="quality">Quality Optimized</option>
                    <option value="latency">Latency Optimized</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendRequest(); }}
                  rows={6}
                  placeholder="Enter your prompt here... (Ctrl+Enter to send)"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <button
                onClick={sendRequest}
                disabled={loading || !prompt.trim()}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Sending...
                  </span>
                ) : "Send Request"}
              </button>
            </div>
          </Card>
        </div>

        {/* Response */}
        <div className="space-y-4">
          {error && (
            <Card className="border-destructive/50 bg-destructive/10">
              <CardHeader>
                <CardTitle className="text-destructive">Error</CardTitle>
              </CardHeader>
              <p className="text-sm text-destructive">{error}</p>
            </Card>
          )}

          {response && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Response</CardTitle>
                  <CardDescription>Model: {response.model}</CardDescription>
                </CardHeader>
                <div className="whitespace-pre-wrap rounded-md bg-muted p-4 text-sm">
                  {response.choices[0]?.message.content}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gateway Metadata</CardTitle>
                </CardHeader>
                <div className="space-y-2 text-sm">
                  {[
                    { label: "Provider", value: response["x-gateway"].provider },
                    { label: "Routing Decision", value: response["x-gateway"].routing_decision },
                    { label: "Latency", value: formatLatency(response["x-gateway"].latency_ms) },
                    { label: "Cost", value: formatCost(response["x-gateway"].cost_usd) },
                    { label: "Cache Hit", value: response["x-gateway"].cache_hit ? "Yes" : "No" },
                    { label: "Fallback Used", value: response["x-gateway"].fallback_used ? "Yes" : "No" },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium max-w-xs truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Token Usage</CardTitle>
                </CardHeader>
                <div className="grid grid-cols-3 gap-4 text-center text-sm">
                  <div>
                    <p className="text-muted-foreground">Input</p>
                    <p className="text-lg font-bold">{response.usage.prompt_tokens}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Output</p>
                    <p className="text-lg font-bold">{response.usage.completion_tokens}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="text-lg font-bold">{response.usage.total_tokens}</p>
                  </div>
                </div>
              </Card>
            </>
          )}

          {!response && !error && (
            <Card>
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span className="text-sm">Send a request to see the response</span>
                <span className="text-xs">Ctrl+Enter to send</span>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
