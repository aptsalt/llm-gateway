"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { CheckCircle2, XCircle, Edit } from "lucide-react";
import { toast } from "sonner";

const providers = [
  {
    id: "openai",
    name: "OpenAI",
    healthy: true,
    latencyMs: 450,
    modelCount: 12,
    hasKey: true,
  },
  {
    id: "anthropic",
    name: "Anthropic",
    healthy: true,
    latencyMs: 520,
    modelCount: 8,
    hasKey: true,
  },
  {
    id: "groq",
    name: "Groq",
    healthy: true,
    latencyMs: 180,
    modelCount: 6,
    hasKey: true,
  },
  {
    id: "together",
    name: "Together AI",
    healthy: false,
    latencyMs: 0,
    modelCount: 0,
    hasKey: false,
  },
];

const latencyData = [
  { time: "10m ago", openai: 420, anthropic: 490, groq: 160 },
  { time: "8m ago", openai: 440, anthropic: 510, groq: 170 },
  { time: "6m ago", openai: 460, anthropic: 530, groq: 180 },
  { time: "4m ago", openai: 450, anthropic: 520, groq: 175 },
  { time: "2m ago", openai: 430, anthropic: 505, groq: 165 },
  { time: "now", openai: 450, anthropic: 520, groq: 180 },
];

export default function ProvidersPage() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleSaveKey = () => {
    toast.success(`API key for ${selectedProvider} saved successfully`);
    setApiKey("");
    setDialogOpen(false);
  };

  const openKeyDialog = (providerId: string) => {
    setSelectedProvider(providerId);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Providers</h1>
        <p className="mt-1 text-muted-foreground">Manage your LLM provider connections</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => (
          <Card key={provider.id} className="bg-card border-border">
            <CardHeader>
              <div className="flex items-center justify-between mb-2">
                <CardTitle className="text-lg">{provider.name}</CardTitle>
                {provider.healthy ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Latency</span>
                  <span>{provider.latencyMs > 0 ? `${provider.latencyMs}ms` : "N/A"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Models</span>
                  <span>{provider.modelCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">API Key</span>
                  <Badge variant={provider.hasKey ? "default" : "outline"}>
                    {provider.hasKey ? "Configured" : "Missing"}
                  </Badge>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => openKeyDialog(provider.id)}
              >
                <Edit className="mr-2 h-3 w-3" />
                {provider.hasKey ? "Update Key" : "Add Key"}
              </Button>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Latency Over Time</CardTitle>
          <CardDescription className="text-muted-foreground">
            Real-time latency monitoring per provider
          </CardDescription>
        </CardHeader>
        <div className="h-64 px-4 pb-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={latencyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="time" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} label={{ value: "ms", angle: -90, position: "insideLeft", style: { fill: "#71717a" } }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "6px",
                }}
              />
              <Line type="monotone" dataKey="openai" stroke="#10b981" strokeWidth={2} name="OpenAI" />
              <Line type="monotone" dataKey="anthropic" stroke="#3b82f6" strokeWidth={2} name="Anthropic" />
              <Line type="monotone" dataKey="groq" stroke="#f59e0b" strokeWidth={2} name="Groq" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Provider Details</CardTitle>
          <CardDescription className="text-muted-foreground">
            Configuration and health status
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 px-6">Provider</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Latency</th>
                <th className="pb-3 pr-4">Models</th>
                <th className="pb-3">API Key</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="border-b border-border last:border-0">
                  <td className="py-3 px-6 font-medium">{provider.name}</td>
                  <td className="py-3 pr-4">
                    <Badge variant={provider.healthy ? "default" : "destructive"}>
                      {provider.healthy ? "Healthy" : "Down"}
                    </Badge>
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {provider.latencyMs > 0 ? `${provider.latencyMs}ms` : "N/A"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{provider.modelCount}</td>
                  <td className="py-3 text-muted-foreground">
                    {provider.hasKey ? "••••••••" : "Not configured"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {selectedProvider?.toUpperCase()} API Key</DialogTitle>
            <DialogDescription>
              Enter your API key for {selectedProvider}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="apiKey" className="text-sm font-medium">
                API Key
              </label>
              <Input
                id="apiKey"
                type="password"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveKey} className="w-full" disabled={!apiKey}>
              Save API Key
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
