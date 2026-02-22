"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/card";
import { Button } from "@/components/ui/button";
import { Database, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function CachePage() {
  const handleClearCache = () => {
    toast.success("Cache cleared successfully");
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Cache Statistics</h1>
        <p className="mt-1 text-muted-foreground">Monitor your semantic cache performance</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Hit Rate</CardDescription>
              <TrendingUp className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">68.2%</CardTitle>
            <p className="text-xs text-muted-foreground">4,250 hits / 6,230 requests</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Miss Rate</CardDescription>
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">31.8%</CardTitle>
            <p className="text-xs text-muted-foreground">1,980 misses</p>
          </CardHeader>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardDescription className="text-muted-foreground">Total Entries</CardDescription>
              <Database className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-2xl">4,250</CardTitle>
            <p className="text-xs text-muted-foreground">Cached responses</p>
          </CardHeader>
        </Card>
      </div>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Cost Savings from Cache</CardTitle>
          <CardDescription className="text-muted-foreground">
            Money saved by serving cached responses
          </CardDescription>
        </CardHeader>
        <div className="grid gap-4 p-6 md:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">This Week</p>
            <p className="text-2xl font-bold text-green-500">$15.20</p>
            <p className="text-xs text-muted-foreground">4,250 cached requests</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">This Month</p>
            <p className="text-2xl font-bold text-green-500">$58.40</p>
            <p className="text-xs text-muted-foreground">18,900 cached requests</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">All Time</p>
            <p className="text-2xl font-bold text-green-500">$142.80</p>
            <p className="text-xs text-muted-foreground">45,200 cached requests</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg per Request</p>
            <p className="text-2xl font-bold">$0.0032</p>
            <p className="text-xs text-muted-foreground">Cost avoided</p>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Cache Configuration</CardTitle>
          <CardDescription className="text-muted-foreground">
            Current cache settings
          </CardDescription>
        </CardHeader>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Semantic Similarity Threshold</p>
              <p className="text-xs text-muted-foreground">0.95 (95% similarity required)</p>
            </div>
            <span className="text-sm text-muted-foreground">Configured in gateway</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">TTL (Time to Live)</p>
              <p className="text-xs text-muted-foreground">24 hours</p>
            </div>
            <span className="text-sm text-muted-foreground">Configured in Redis</span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Vector Database</p>
              <p className="text-xs text-muted-foreground">Redis with vector search</p>
            </div>
            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-green-500/10 text-green-500">
              Connected
            </span>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div>
              <p className="text-sm font-medium">Embedding Model</p>
              <p className="text-xs text-muted-foreground">text-embedding-3-small (OpenAI)</p>
            </div>
            <span className="text-sm text-muted-foreground">1536 dimensions</span>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>Cache Management</CardTitle>
          <CardDescription className="text-muted-foreground">
            Clear cache data
          </CardDescription>
        </CardHeader>
        <div className="p-6">
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-start gap-3">
              <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-red-500">Clear All Cache Entries</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  This will delete all cached responses. New requests will need to call the actual providers until the cache is rebuilt.
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  className="mt-3"
                  onClick={handleClearCache}
                >
                  Clear Cache
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle>How Semantic Caching Works</CardTitle>
          <CardDescription className="text-muted-foreground">
            Understanding the caching mechanism
          </CardDescription>
        </CardHeader>
        <div className="p-6 space-y-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">Vector Similarity Search</h3>
            <p className="text-muted-foreground">
              When a request comes in, we generate an embedding of the prompt and search for similar cached entries
              using cosine similarity. If a match above the threshold is found, we return the cached response.
            </p>
          </div>
          <div>
            <h3 className="font-medium mb-2">Benefits</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-1">
              <li>Instant responses (no LLM call needed)</li>
              <li>Significant cost savings (no tokens charged)</li>
              <li>Works across paraphrased prompts</li>
              <li>Reduces provider rate limit pressure</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Cache Invalidation</h3>
            <p className="text-muted-foreground">
              Entries automatically expire after 24 hours (configurable). You can also manually clear the cache
              if you need to force fresh responses.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
