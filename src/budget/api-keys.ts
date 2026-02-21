import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { nanoid } from "nanoid";
import { apiKeys } from "../db/schema.js";

export interface CreateKeyOptions {
  name: string;
  orgId?: number;
  environment?: string;
  monthlyTokenBudget?: number;
  monthlyCostBudgetUsd?: number;
  rateLimitRpm?: number;
  rateLimitTpm?: number;
}

export interface ApiKeyRecord {
  id: number;
  key: string;
  name: string;
  orgId: number | null;
  environment: string | null;
  enabled: boolean;
  monthlyTokenBudget: number | null;
  monthlyCostBudgetUsd: number | null;
  rateLimitRpm: number | null;
  rateLimitTpm: number | null;
  tokensUsedThisMonth: number;
  costUsedThisMonthUsd: number;
  lastUsedAt: Date | null;
}

export class ApiKeyManager {
  private db: NodePgDatabase;

  constructor(db: NodePgDatabase) {
    this.db = db;
  }

  async createKey(options: CreateKeyOptions): Promise<ApiKeyRecord> {
    const prefix = options.environment === "production" ? "prod" : options.environment === "staging" ? "stg" : "dev";
    const key = `gw-${prefix}-${nanoid(16)}`;

    const [record] = await this.db
      .insert(apiKeys)
      .values({
        key,
        name: options.name,
        orgId: options.orgId,
        environment: options.environment ?? "production",
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
      orgId: record.orgId,
      environment: record.environment,
      enabled: record.enabled,
      monthlyTokenBudget: record.monthlyTokenBudget,
      monthlyCostBudgetUsd: record.monthlyCostBudgetUsd,
      rateLimitRpm: record.rateLimitRpm,
      rateLimitTpm: record.rateLimitTpm,
      tokensUsedThisMonth: record.tokensUsedThisMonth,
      costUsedThisMonthUsd: record.costUsedThisMonthUsd,
      lastUsedAt: record.lastUsedAt,
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
      orgId: record.orgId,
      environment: record.environment,
      enabled: record.enabled,
      monthlyTokenBudget: record.monthlyTokenBudget,
      monthlyCostBudgetUsd: record.monthlyCostBudgetUsd,
      rateLimitRpm: record.rateLimitRpm,
      rateLimitTpm: record.rateLimitTpm,
      tokensUsedThisMonth: record.tokensUsedThisMonth,
      costUsedThisMonthUsd: record.costUsedThisMonthUsd,
      lastUsedAt: record.lastUsedAt,
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

  async listKeys(orgId?: number): Promise<ApiKeyRecord[]> {
    const condition = orgId
      ? and(eq(apiKeys.orgId, orgId))
      : undefined;

    const records = condition
      ? await this.db.select().from(apiKeys).where(condition).orderBy(apiKeys.createdAt)
      : await this.db.select().from(apiKeys).orderBy(apiKeys.createdAt);

    return records.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      orgId: r.orgId,
      environment: r.environment,
      enabled: r.enabled,
      monthlyTokenBudget: r.monthlyTokenBudget,
      monthlyCostBudgetUsd: r.monthlyCostBudgetUsd,
      rateLimitRpm: r.rateLimitRpm,
      rateLimitTpm: r.rateLimitTpm,
      tokensUsedThisMonth: r.tokensUsedThisMonth,
      costUsedThisMonthUsd: r.costUsedThisMonthUsd,
      lastUsedAt: r.lastUsedAt,
    }));
  }

  async rotateKey(oldKey: string): Promise<ApiKeyRecord | null> {
    const existing = await this.validateKey(oldKey);
    if (!existing) return null;

    // Revoke old key
    await this.revokeKey(oldKey);

    // Create new key with same config
    return this.createKey({
      name: existing.name,
      orgId: existing.orgId ?? undefined,
      environment: existing.environment ?? "production",
      monthlyTokenBudget: existing.monthlyTokenBudget ?? undefined,
      monthlyCostBudgetUsd: existing.monthlyCostBudgetUsd ?? undefined,
      rateLimitRpm: existing.rateLimitRpm ?? undefined,
      rateLimitTpm: existing.rateLimitTpm ?? undefined,
    });
  }
}
