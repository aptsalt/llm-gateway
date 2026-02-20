import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { requestLogs } from "../db/schema.js";
import { env } from "../env.js";

export interface RequestLogEntry {
  requestId: string;
  apiKeyId?: number;
  modelRequested: string;
  modelUsed: string;
  provider: string;
  routingStrategy?: string;
  routingDecision?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  latencyMs: number;
  costUsd: number;
  cacheHit: boolean;
  fallbackUsed: boolean;
  statusCode: number;
  errorMessage?: string;
}

export class RequestLogger {
  private db: NodePgDatabase | null;
  private buffer: RequestLogEntry[] = [];
  private flushInterval: ReturnType<typeof setInterval> | null = null;
  private batchSize: number;

  constructor(db: NodePgDatabase | null, batchSize = 50) {
    this.db = db;
    this.batchSize = batchSize;
  }

  log(entry: RequestLogEntry): void {
    // Always log to stdout in structured format
    if (env.LOG_LEVEL === "debug" || env.LOG_LEVEL === "info") {
      const logLine = {
        ...entry,
        timestamp: new Date().toISOString(),
      };
      console.log(JSON.stringify(logLine));
    }

    // Buffer for database persistence
    if (this.db) {
      this.buffer.push(entry);
      if (this.buffer.length >= this.batchSize) {
        void this.flush();
      }
    }
  }

  startPeriodicFlush(intervalMs = 5000): void {
    this.flushInterval = setInterval(() => void this.flush(), intervalMs);
  }

  stopPeriodicFlush(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }
  }

  async flush(): Promise<void> {
    if (!this.db || this.buffer.length === 0) return;

    const entries = this.buffer.splice(0, this.buffer.length);

    try {
      await this.db.insert(requestLogs).values(
        entries.map((e) => ({
          requestId: e.requestId,
          apiKeyId: e.apiKeyId,
          modelRequested: e.modelRequested,
          modelUsed: e.modelUsed,
          provider: e.provider,
          routingStrategy: e.routingStrategy,
          routingDecision: e.routingDecision,
          promptTokens: e.promptTokens,
          completionTokens: e.completionTokens,
          totalTokens: e.totalTokens,
          latencyMs: e.latencyMs,
          costUsd: e.costUsd,
          cacheHit: e.cacheHit,
          fallbackUsed: e.fallbackUsed,
          statusCode: e.statusCode,
          errorMessage: e.errorMessage,
        }))
      );
    } catch (error) {
      // Re-add entries to buffer on failure
      this.buffer.unshift(...entries);
      console.error("Failed to flush request logs:", error);
    }
  }
}
