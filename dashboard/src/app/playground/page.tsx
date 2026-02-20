"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { formatCost, formatLatency } from "@/lib/utils";

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

export default function PlaygroundPage() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("auto");
  const [strategy, setStrategy] = useState("balanced");
  const [response, setResponse] = useState<ChatResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");

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
        setError((data as { error?: { message?: string } }).error?.message ?? "Request failed");
      } else {
        setResponse(data as ChatResponse);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
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
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium">Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  >
                    <optgroup label="Virtual Models">
                      <option value="auto">auto (router decides)</option>
                      <option value="fast">fast (latency-optimized)</option>
                      <option value="cheap">cheap (cost-optimized)</option>
                    </optgroup>
                    <optgroup label="Ollama">
                      <option value="llama3.2">llama3.2</option>
                      <option value="qwen2.5-coder:7b">qwen2.5-coder:7b</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                    </optgroup>
                    <optgroup label="Anthropic">
                      <option value="claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                    </optgroup>
                    <optgroup label="Groq">
                      <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                      <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium">Routing Strategy</label>
                  <select
                    value={strategy}
                    onChange={(e) => setStrategy(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
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
                  rows={6}
                  placeholder="Enter your prompt here..."
                  className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>

              <button
                onClick={sendRequest}
                disabled={loading || !prompt.trim()}
                className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Request"}
              </button>
            </div>
          </Card>
        </div>

        {/* Response */}
        <div className="space-y-4">
          {error && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-800">Error</CardTitle>
              </CardHeader>
              <p className="text-sm text-red-700">{error}</p>
            </Card>
          )}

          {response && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Response</CardTitle>
                  <CardDescription>Model: {response.model}</CardDescription>
                </CardHeader>
                <div className="whitespace-pre-wrap rounded-md bg-gray-50 p-4 text-sm">
                  {response.choices[0]?.message.content}
                </div>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Gateway Metadata</CardTitle>
                </CardHeader>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{response["x-gateway"].provider}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Routing Decision</span>
                    <span className="max-w-xs truncate font-medium">{response["x-gateway"].routing_decision}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Latency</span>
                    <span className="font-medium">{formatLatency(response["x-gateway"].latency_ms)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cost</span>
                    <span className="font-medium">{formatCost(response["x-gateway"].cost_usd)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cache Hit</span>
                    <span className="font-medium">{response["x-gateway"].cache_hit ? "Yes" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fallback Used</span>
                    <span className="font-medium">{response["x-gateway"].fallback_used ? "Yes" : "No"}</span>
                  </div>
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
              <div className="py-12 text-center text-muted-foreground">
                Send a request to see the response
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
