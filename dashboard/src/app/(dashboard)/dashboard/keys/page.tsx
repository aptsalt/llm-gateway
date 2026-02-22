"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Copy, Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  key: string;
  environment: "production" | "staging" | "development";
  createdAt: string;
  lastUsed?: string;
}

const mockKeys: ApiKey[] = [
  {
    id: "1",
    name: "Production Key",
    key: "rtr_prod_abc123xyz456def789ghi012jkl345mno678pqr901stu234vwx567yza890",
    environment: "production",
    createdAt: "2024-02-15",
    lastUsed: "2m ago",
  },
  {
    id: "2",
    name: "Development Key",
    key: "rtr_dev_123abc456def789ghi012jkl345mno678pqr901stu234vwx567yza890bcd",
    environment: "development",
    createdAt: "2024-02-10",
    lastUsed: "1h ago",
  },
];

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>(mockKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState<"production" | "staging" | "development">("production");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  const handleCreateKey = () => {
    const newKey: ApiKey = {
      id: Date.now().toString(),
      name: newKeyName,
      key: `rtr_${newKeyEnv}_${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`,
      environment: newKeyEnv,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setKeys([...keys, newKey]);
    setNewKeyName("");
    setDialogOpen(false);
    toast.success("API key created successfully");
  };

  const handleCopyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success("API key copied to clipboard");
  };

  const handleRevokeKey = (id: string) => {
    setKeys(keys.filter((k) => k.id !== id));
    toast.success("API key revoked");
  };

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  const maskKey = (key: string) => {
    return `${key.substring(0, 12)}${"•".repeat(40)}${key.substring(key.length - 8)}`;
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="mt-1 text-muted-foreground">Manage your RouterAI API keys</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for your organization
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="keyName" className="text-sm font-medium">
                  Key Name
                </label>
                <Input
                  id="keyName"
                  placeholder="Production Key"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="environment" className="text-sm font-medium">
                  Environment
                </label>
                <Select
                  id="environment"
                  value={newKeyEnv}
                  onChange={(e) => setNewKeyEnv(e.target.value as any)}
                >
                  <option value="production">Production</option>
                  <option value="staging">Staging</option>
                  <option value="development">Development</option>
                </Select>
              </div>
              <Button onClick={handleCreateKey} className="w-full" disabled={!newKeyName}>
                Create Key
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription className="text-muted-foreground">
            Use these keys to authenticate requests to the gateway
          </CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="pb-3 px-6">Name</th>
                <th className="pb-3 pr-4">Key</th>
                <th className="pb-3 pr-4">Environment</th>
                <th className="pb-3 pr-4">Created</th>
                <th className="pb-3 pr-4">Last Used</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b border-border last:border-0">
                  <td className="py-4 px-6 font-medium">{key.name}</td>
                  <td className="py-4 pr-4">
                    <code className="rounded bg-accent px-2 py-1 text-xs font-mono">
                      {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                    </code>
                  </td>
                  <td className="py-4 pr-4">
                    <Badge
                      variant={
                        key.environment === "production"
                          ? "default"
                          : key.environment === "staging"
                          ? "secondary"
                          : "outline"
                      }
                    >
                      {key.environment}
                    </Badge>
                  </td>
                  <td className="py-4 pr-4 text-muted-foreground">{key.createdAt}</td>
                  <td className="py-4 pr-4 text-muted-foreground">{key.lastUsed || "Never"}</td>
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleKeyVisibility(key.id)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                        title={visibleKeys.has(key.id) ? "Hide key" : "Show key"}
                      >
                        {visibleKeys.has(key.id) ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        onClick={() => handleCopyKey(key.key)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-accent-foreground"
                        title="Copy key"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleRevokeKey(key.id)}
                        className="rounded p-1 hover:bg-accent text-muted-foreground hover:text-red-400"
                        title="Revoke key"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    No API keys yet. Create one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Usage Example</CardTitle>
          <CardDescription className="text-muted-foreground">
            How to use your API key
          </CardDescription>
        </CardHeader>
        <div className="p-6">
          <pre className="rounded-lg bg-background p-4 text-sm overflow-x-auto">
            <code className="text-foreground">
{`curl http://localhost:4000/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`}
            </code>
          </pre>
        </div>
      </Card>
    </div>
  );
}
