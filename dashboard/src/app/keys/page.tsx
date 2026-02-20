"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { formatCost, formatNumber } from "@/lib/utils";
import { toast } from "sonner";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL ?? "http://localhost:4000";

interface ApiKeyRecord {
  id: number;
  key: string;
  name: string;
  enabled: boolean;
  monthlyTokenBudget: number | null;
  monthlyCostBudgetUsd: number | null;
  rateLimitRpm: number | null;
  rateLimitTpm: number | null;
  tokensUsedThisMonth: number;
  costUsedThisMonthUsd: number;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        toast.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rounded px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [adminKey, setAdminKey] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyBudget, setNewKeyBudget] = useState("");
  const [newKeyCostBudget, setNewKeyCostBudget] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem("adminKey");
    if (stored) setAdminKey(stored);
  }, []);

  const fetchKeys = useCallback(async () => {
    if (!adminKey) return;
    try {
      const response = await fetch(`${GATEWAY_URL}/api/admin/keys`, {
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      if (response.ok) {
        setKeys(await response.json() as ApiKeyRecord[]);
      }
    } catch {
      toast.error("Failed to fetch API keys");
    }
  }, [adminKey]);

  useEffect(() => {
    if (adminKey) {
      localStorage.setItem("adminKey", adminKey);
      fetchKeys();
    }
  }, [adminKey, fetchKeys]);

  async function createKey() {
    if (!newKeyName || !adminKey) return;
    try {
      const response = await fetch(`${GATEWAY_URL}/api/admin/keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminKey}`,
        },
        body: JSON.stringify({
          name: newKeyName,
          monthlyTokenBudget: newKeyBudget ? parseInt(newKeyBudget) : undefined,
          monthlyCostBudgetUsd: newKeyCostBudget ? parseFloat(newKeyCostBudget) : undefined,
        }),
      });
      if (response.ok) {
        const record = await response.json() as ApiKeyRecord;
        setCreatedKey(record.key);
        setNewKeyName("");
        setNewKeyBudget("");
        setNewKeyCostBudget("");
        toast.success(`API key "${record.name}" created`);
        await fetchKeys();
      } else {
        toast.error("Failed to create key");
      }
    } catch {
      toast.error("Failed to create key");
    }
  }

  async function revokeKey(key: string) {
    if (!adminKey) return;
    try {
      await fetch(`${GATEWAY_URL}/api/admin/keys/${key}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${adminKey}` },
      });
      toast.success("Key revoked");
      await fetchKeys();
    } catch {
      toast.error("Failed to revoke key");
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">API Keys</h1>
        <p className="mt-1 text-muted-foreground">
          Create and manage API keys with budgets and rate limits
        </p>
      </div>

      {/* Admin Key Input */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Authentication</CardTitle>
          <CardDescription>Enter your admin API key to manage keys</CardDescription>
        </CardHeader>
        <input
          type="password"
          value={adminKey}
          onChange={(e) => setAdminKey(e.target.value)}
          placeholder="gw-admin-..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
        />
      </Card>

      {/* Create Key */}
      <Card>
        <CardHeader>
          <CardTitle>Create New Key</CardTitle>
          <CardDescription>Issue a new API key with optional budget limits</CardDescription>
        </CardHeader>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium">Name</label>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="My App"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium">Monthly Token Budget</label>
              <input
                type="number"
                min="0"
                value={newKeyBudget}
                onChange={(e) => setNewKeyBudget(e.target.value)}
                placeholder="100000"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Monthly Cost Budget (USD)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={newKeyCostBudget}
                onChange={(e) => setNewKeyCostBudget(e.target.value)}
                placeholder="10.00"
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
          <button
            onClick={createKey}
            disabled={!newKeyName || !adminKey}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            Create Key
          </button>

          {createdKey && (
            <div className="rounded-md border border-green-500/30 bg-green-500/10 p-4">
              <p className="text-sm font-medium text-green-700 dark:text-green-400">Key created successfully!</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted p-2 text-sm">
                  {createdKey}
                </code>
                <CopyButton text={createdKey} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Copy this key now. It will not be shown again in full.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Keys</CardTitle>
          <CardDescription>{keys.length} keys configured</CardDescription>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-3 pr-4">Name</th>
                <th className="pb-3 pr-4">Key</th>
                <th className="pb-3 pr-4">Status</th>
                <th className="pb-3 pr-4">Tokens Used</th>
                <th className="pb-3 pr-4">Cost Used</th>
                <th className="pb-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-b last:border-0">
                  <td className="py-3 pr-4 font-medium">{key.name}</td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-1.5">
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {key.key.slice(0, 12)}...
                      </code>
                      <CopyButton text={key.key} />
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    <span
                      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        key.enabled
                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                          : "bg-destructive/10 text-destructive"
                      }`}
                    >
                      {key.enabled ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    {formatNumber(key.tokensUsedThisMonth)}
                    {key.monthlyTokenBudget && (
                      <span className="text-muted-foreground">
                        {" "}/ {formatNumber(key.monthlyTokenBudget)}
                      </span>
                    )}
                  </td>
                  <td className="py-3 pr-4">
                    {formatCost(key.costUsedThisMonthUsd)}
                    {key.monthlyCostBudgetUsd && (
                      <span className="text-muted-foreground">
                        {" "}/ {formatCost(key.monthlyCostBudgetUsd)}
                      </span>
                    )}
                  </td>
                  <td className="py-3">
                    {key.enabled && (
                      <button
                        onClick={() => revokeKey(key.key)}
                        className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {keys.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-muted-foreground">
                    {adminKey ? "No API keys found" : "Enter admin key to view keys"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
