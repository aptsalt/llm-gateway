import type { Context, Next } from "hono";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { apiKeys, organizations } from "../db/schema.js";

export interface TenantContext {
  orgId: number;
  orgSlug: string;
  plan: string;
  apiKeyId: number;
  routingStrategy: string;
  routingWeights: { cost: number; quality: number; latency: number };
  preferLocal: boolean;
  monthlyTokenBudget: number;
  tokensUsedThisMonth: number;
  monthlyCostBudgetUsd: number;
  costUsedThisMonthUsd: number;
  providerKeys: Record<string, string>;
}

export const PLAN_LIMITS: Record<string, {
  rpm: number;
  tpm: number;
  monthlyTokens: number;
  maxProviders: number;
  semanticCache: boolean;
  budgetAlerts: boolean;
  customRouting: boolean;
}> = {
  free: { rpm: 30, tpm: 50000, monthlyTokens: 100000, maxProviders: 2, semanticCache: false, budgetAlerts: false, customRouting: false },
  starter: { rpm: 120, tpm: 200000, monthlyTokens: 1000000, maxProviders: 10, semanticCache: false, budgetAlerts: false, customRouting: false },
  growth: { rpm: 600, tpm: 1000000, monthlyTokens: 10000000, maxProviders: 10, semanticCache: true, budgetAlerts: true, customRouting: false },
  scale: { rpm: 2400, tpm: 5000000, monthlyTokens: 100000000, maxProviders: 10, semanticCache: true, budgetAlerts: true, customRouting: true },
  enterprise: { rpm: 10000, tpm: 50000000, monthlyTokens: Number.MAX_SAFE_INTEGER, maxProviders: 10, semanticCache: true, budgetAlerts: true, customRouting: true },
};

export function createTenantMiddleware(db: NodePgDatabase | null) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    const apiKey = authHeader?.replace("Bearer ", "");

    if (!apiKey || !db) {
      // No auth or no DB — pass through (single-tenant / admin mode)
      await next();
      return;
    }

    // Skip tenant resolution for admin key
    const adminKey = process.env.ADMIN_API_KEY ?? "gw-admin-change-me";
    if (apiKey === adminKey) {
      await next();
      return;
    }

    // Lookup API key → get org
    const [keyRecord] = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.key, apiKey), eq(apiKeys.enabled, true)))
      .limit(1);

    if (!keyRecord) {
      return c.json({ error: { message: "Invalid API key", type: "authentication_error" } }, 401);
    }

    // If key has no org_id, it's a legacy single-tenant key — pass through
    if (!keyRecord.orgId) {
      await next();
      return;
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, keyRecord.orgId))
      .limit(1);

    if (!org) {
      return c.json({ error: { message: "Organization not found", type: "not_found" } }, 404);
    }

    const tenant: TenantContext = {
      orgId: org.id,
      orgSlug: org.slug,
      plan: org.plan,
      apiKeyId: keyRecord.id,
      routingStrategy: org.defaultRoutingStrategy ?? "balanced",
      routingWeights: (org.routingWeights as { cost: number; quality: number; latency: number }) ?? { cost: 0.4, quality: 0.35, latency: 0.25 },
      preferLocal: org.preferLocal ?? false,
      monthlyTokenBudget: org.monthlyTokenBudget ?? 100000,
      tokensUsedThisMonth: org.tokensUsedThisMonth ?? 0,
      monthlyCostBudgetUsd: Number(org.monthlyCostBudgetUsd ?? 0),
      costUsedThisMonthUsd: Number(org.costUsedThisMonthUsd ?? 0),
      providerKeys: (org.providerKeys as Record<string, string>) ?? {},
    };

    c.set("tenant", tenant);

    // Update last_used_at (async, non-blocking)
    void db
      .update(apiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(apiKeys.id, keyRecord.id));

    await next();
  };
}

export function getTenant(c: Context): TenantContext | null {
  return c.get("tenant") as TenantContext | null ?? null;
}
