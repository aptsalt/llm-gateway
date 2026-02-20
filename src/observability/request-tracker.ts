export interface RequestStats {
  totalRequests: number;
  activeRequests: number;
  avgResponseTimeMs: number;
  requestsPerMinute: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  uptimeSeconds: number;
  providerBreakdown: Record<string, number>;
  modelBreakdown: Record<string, number>;
  costBreakdown: { totalUsd: number; last24hUsd: number; last1hUsd: number };
  cacheHitRate: number;
}

interface RequestRecord {
  startTime: number;
  endTime?: number;
  provider?: string;
  model?: string;
  costUsd?: number;
  cacheHit?: boolean;
}

export class RequestTracker {
  private active = new Map<string, RequestRecord>();
  private completed: RequestRecord[] = [];
  private startedAt = Date.now();
  private maxHistory = 10000;

  track(requestId: string): void {
    this.active.set(requestId, { startTime: Date.now() });
  }

  complete(requestId: string): void {
    const record = this.active.get(requestId);
    if (record) {
      record.endTime = Date.now();
      this.active.delete(requestId);
      this.completed.push(record);
      if (this.completed.length > this.maxHistory) {
        this.completed = this.completed.slice(-this.maxHistory);
      }
    }
  }

  recordMetadata(requestId: string, metadata: { provider?: string; model?: string; costUsd?: number; cacheHit?: boolean }): void {
    const record = this.active.get(requestId);
    if (record) {
      Object.assign(record, metadata);
    }
  }

  getActiveCount(): number {
    return this.active.size;
  }

  getStats(): RequestStats {
    const now = Date.now();
    const latencies = this.completed
      .filter((r) => r.endTime)
      .map((r) => r.endTime! - r.startTime)
      .sort((a, b) => a - b);

    const last1h = this.completed.filter((r) => r.endTime && now - r.endTime < 3600000);
    const last24h = this.completed.filter((r) => r.endTime && now - r.endTime < 86400000);
    const lastMinute = this.completed.filter((r) => r.endTime && now - r.endTime < 60000);

    const providerBreakdown: Record<string, number> = {};
    const modelBreakdown: Record<string, number> = {};
    let totalCost = 0;
    let last24hCost = 0;
    let last1hCost = 0;
    let cacheHits = 0;
    let totalWithCacheInfo = 0;

    for (const record of this.completed) {
      if (record.provider) {
        providerBreakdown[record.provider] = (providerBreakdown[record.provider] ?? 0) + 1;
      }
      if (record.model) {
        modelBreakdown[record.model] = (modelBreakdown[record.model] ?? 0) + 1;
      }
      if (record.costUsd !== undefined) {
        totalCost += record.costUsd;
      }
      if (record.cacheHit !== undefined) {
        totalWithCacheInfo++;
        if (record.cacheHit) cacheHits++;
      }
    }

    for (const record of last24h) {
      if (record.costUsd) last24hCost += record.costUsd;
    }
    for (const record of last1h) {
      if (record.costUsd) last1hCost += record.costUsd;
    }

    const percentile = (arr: number[], p: number) => {
      if (arr.length === 0) return 0;
      const idx = Math.ceil((p / 100) * arr.length) - 1;
      return arr[Math.max(0, idx)] ?? 0;
    };

    return {
      totalRequests: this.completed.length,
      activeRequests: this.active.size,
      avgResponseTimeMs: latencies.length > 0
        ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
        : 0,
      requestsPerMinute: lastMinute.length,
      p50LatencyMs: percentile(latencies, 50),
      p95LatencyMs: percentile(latencies, 95),
      p99LatencyMs: percentile(latencies, 99),
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      providerBreakdown,
      modelBreakdown,
      costBreakdown: {
        totalUsd: Math.round(totalCost * 10000) / 10000,
        last24hUsd: Math.round(last24hCost * 10000) / 10000,
        last1hUsd: Math.round(last1hCost * 10000) / 10000,
      },
      cacheHitRate: totalWithCacheInfo > 0 ? Math.round((cacheHits / totalWithCacheInfo) * 100) : 0,
    };
  }
}
