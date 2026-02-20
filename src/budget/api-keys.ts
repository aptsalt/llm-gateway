import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { nanoid } from "nanoid";
import { apiKeys } from "../db/schema.js";

export interface CreateKeyOptions {
  name: string;
  monthlyTokenBudget?: number;
  monthlyCostBudgetUsd?: number;
  rateLimitRpm?: number;
  rateLimitTpm?: number;
}

export interface ApiKeyRecord {
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

export class ApiKeyManager {
  private db: NodePgDatabase;

  constructor(db: NodePgDatabase) {
    this.db = db;
  }

  async createKey(options: CreateKeyOptions): Promise<ApiKeyRecord> {
    const key = `gw-${process.env.NODE_ENV === "production" ? "prod" : "dev"}-${nanoid(16)}`;

    const [record] = await this.db
      .insert(apiKeys)
      .values({
        key,
        name: options.name,
        monthlyTokenBudget: options.monthlyTokenBudget,
        monthlyCostBudgetUsd: options.monthlyCostBudgetUsd,
        rateLimitRpm: options.rateLimitRpm ?? 60,
        rateLimitTpm: options.rateLimitTpm ?? 100000,
      })
      .returning();

    if (!record) throw new Error("Failed to create API key");

    return {
      id: record.id,
      key: record.key,
      name: record.name,
      enabled: record.enabled,
      monthlyTokenBudget: record.monthlyTokenBudget,
      monthlyCostBudgetUsd: record.monthlyCostBudgetUsd,
      rateLimitRpm: record.rateLimitRpm,
      rateLimitTpm: record.rateLimitTpm,
      tokensUsedThisMonth: record.tokensUsedThisMonth,
      costUsedThisMonthUsd: record.costUsedThisMonthUsd,
    };
  }

  async validateKey(key: string): Promise<ApiKeyRecord | null> {
    const [record] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.key, key))
      .limit(1);

    if (!record || !record.enabled) return null;

    // Check if month has rolled over and reset counters
    const now = new Date();
    const lastReset = new Date(record.lastResetAt);
    if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
      await this.db
        .update(apiKeys)
        .set({
          tokensUsedThisMonth: 0,
          costUsedThisMonthUsd: 0,
          lastResetAt: now,
        })
        .where(eq(apiKeys.id, record.id));
      record.tokensUsedThisMonth = 0;
      record.costUsedThisMonthUsd = 0;
    }

    return {
      id: record.id,
      key: record.key,
      name: record.name,
      enabled: record.enabled,
      monthlyTokenBudget: record.monthlyTokenBudget,
      monthlyCostBudgetUsd: record.monthlyCostBudgetUsd,
      rateLimitRpm: record.rateLimitRpm,
      rateLimitTpm: record.rateLimitTpm,
      tokensUsedThisMonth: record.tokensUsedThisMonth,
      costUsedThisMonthUsd: record.costUsedThisMonthUsd,
    };
  }

  async recordUsage(keyId: number, tokens: number, costUsd: number): Promise<void> {
    const [record] = await this.db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, keyId))
      .limit(1);

    if (!record) return;

    await this.db
      .update(apiKeys)
      .set({
        tokensUsedThisMonth: record.tokensUsedThisMonth + tokens,
        costUsedThisMonthUsd: record.costUsedThisMonthUsd + costUsd,
        updatedAt: new Date(),
      })
      .where(eq(apiKeys.id, keyId));
  }

  async revokeKey(key: string): Promise<boolean> {
    const result = await this.db
      .update(apiKeys)
      .set({ enabled: false, updatedAt: new Date() })
      .where(eq(apiKeys.key, key));

    return (result?.rowCount ?? 0) > 0;
  }

  async listKeys(): Promise<ApiKeyRecord[]> {
    const records = await this.db
      .select()
      .from(apiKeys)
      .orderBy(apiKeys.createdAt);

    return records.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      enabled: r.enabled,
      monthlyTokenBudget: r.monthlyTokenBudget,
      monthlyCostBudgetUsd: r.monthlyCostBudgetUsd,
      rateLimitRpm: r.rateLimitRpm,
      rateLimitTpm: r.rateLimitTpm,
      tokensUsedThisMonth: r.tokensUsedThisMonth,
      costUsedThisMonthUsd: r.costUsedThisMonthUsd,
    }));
  }
}
