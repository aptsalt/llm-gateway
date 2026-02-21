"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, ExternalLink } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  model: string;
  provider: string;
  tokens: number;
  cost: string;
  latency: string;
  status: "success" | "cached" | "error";
  cached: boolean;
  promptPreview: string;
}

const mockLogs: LogEntry[] = [
  {
    id: "1",
    timestamp: "2024-02-21 14:32:15",
    model: "gpt-4o",
    provider: "OpenAI",
    tokens: 1250,
    cost: "$0.025",
    latency: "450ms",
    status: "success",
    cached: false,
    promptPreview: "Explain quantum computing in simple terms...",
  },
  {
    id: "2",
    timestamp: "2024-02-21 14:28:42",
    model: "claude-3-5-sonnet",
    provider: "Anthropic",
    tokens: 980,
    cost: "$0.019",
    latency: "520ms",
    status: "success",
    cached: false,
    promptPreview: "Write a function to parse JSON...",
  },
  {
    id: "3",
    timestamp: "2024-02-21 14:25:18",
    model: "llama-3.1-70b",
    provider: "Ollama",
    tokens: 2100,
    cost: "$0.00",
    latency: "12ms",
    status: "cached",
    cached: true,
    promptPreview: "Explain quantum computing in simple terms...",
  },
  {
    id: "4",
    timestamp: "2024-02-21 14:20:05",
    model: "gpt-4o-mini",
    provider: "OpenAI",
    tokens: 450,
    cost: "$0.003",
    latency: "380ms",
    status: "success",
    cached: false,
    promptPreview: "Summarize this article about AI safety...",
  },
  {
    id: "5",
    timestamp: "2024-02-21 14:15:30",
    model: "llama-3.1-70b-versatile",
    provider: "Groq",
    tokens: 1800,
    cost: "$0.054",
    latency: "180ms",
    status: "success",
    cached: false,
    promptPreview: "Generate a REST API design for...",
  },
];

export default function LogsPage() {
  const [logs] = useState<LogEntry[]>(mockLogs);
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

  const filteredLogs = logs.filter((log) => {
    if (filterProvider !== "all" && log.provider !== filterProvider) return false;
    if (filterStatus !== "all" && log.status !== filterStatus) return false;
    if (searchQuery && !log.model.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Request Logs</h1>
        <p className="mt-1 text-zinc-400">View detailed logs of all API requests</p>
      </div>

      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription className="text-zinc-400">
                Real-time request logs with filtering
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                <Input
                  placeholder="Search model..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-48"
                />
              </div>
              <Select value={filterProvider} onChange={(e) => setFilterProvider(e.target.value)}>
                <option value="all">All Providers</option>
                <option value="OpenAI">OpenAI</option>
                <option value="Anthropic">Anthropic</option>
                <option value="Groq">Groq</option>
                <option value="Ollama">Ollama</option>
              </Select>
              <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="cached">Cached</option>
                <option value="error">Error</option>
              </Select>
            </div>
          </div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-zinc-400">
                <th className="pb-3 px-6">Timestamp</th>
                <th className="pb-3 pr-4">Model</th>
                <th className="pb-3 pr-4">Provider</th>
                <th className="pb-3 pr-4">Tokens</th>
                <th className="pb-3 pr-4">Cost</th>
                <th className="pb-3 pr-4">Latency</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/50">
                  <td className="py-3 px-6 text-zinc-400 font-mono text-xs">
                    {log.timestamp}
                  </td>
                  <td className="py-3 pr-4 font-medium">{log.model}</td>
                  <td className="py-3 pr-4 text-zinc-400">{log.provider}</td>
                  <td className="py-3 pr-4 text-zinc-400">{log.tokens.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-zinc-400">{log.cost}</td>
                  <td className="py-3 pr-4 text-zinc-400">{log.latency}</td>
                  <td className="py-3 pr-4">
                    <Badge
                      variant={
                        log.status === "cached"
                          ? "secondary"
                          : log.status === "success"
                          ? "default"
                          : "destructive"
                      }
                    >
                      {log.status}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="rounded p-1 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100"
                      title="View details"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-zinc-400">
                    No logs match your filters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">
              Showing {filteredLogs.length} of {logs.length} requests
            </span>
            <div className="flex gap-2">
              <button className="px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50" disabled>
                Previous
              </button>
              <button className="px-3 py-1 rounded bg-zinc-800 text-zinc-400 hover:bg-zinc-700">
                Next
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-zinc-400">Model</p>
                  <p className="font-medium">{selectedLog.model}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Provider</p>
                  <p className="font-medium">{selectedLog.provider}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Tokens</p>
                  <p className="font-medium">{selectedLog.tokens.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Cost</p>
                  <p className="font-medium">{selectedLog.cost}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Latency</p>
                  <p className="font-medium">{selectedLog.latency}</p>
                </div>
                <div>
                  <p className="text-sm text-zinc-400">Status</p>
                  <Badge variant={selectedLog.cached ? "secondary" : "default"}>
                    {selectedLog.status}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-sm text-zinc-400 mb-2">Prompt Preview</p>
                <div className="rounded-lg bg-zinc-950 p-3 text-sm text-zinc-300">
                  {selectedLog.promptPreview}
                </div>
              </div>

              <div>
                <p className="text-sm text-zinc-400 mb-2">Timestamp</p>
                <p className="font-mono text-sm">{selectedLog.timestamp}</p>
              </div>

              {selectedLog.cached && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-3">
                  <p className="text-sm text-yellow-500">
                    This request was served from cache. No provider API call was made.
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
