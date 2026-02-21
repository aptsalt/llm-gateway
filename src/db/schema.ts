import { pgTable, text, integer, real, boolean, timestamp, jsonb, serial, varchar, index, bigint, numeric, date, uniqueIndex } from "drizzle-orm/pg-core";

// ============================================================
// Multi-Tenant Tables
// ============================================================

export const organizations = pgTable("organizations", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  ownerId: varchar("owner_id", { length: 128 }).notNull(),
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  plan: varchar("plan", { length: 32 }).notNull().default("free"),
  monthlyTokenBudget: bigint("monthly_token_budget", { mode: "number" }).default(100000),
  monthlyCostBudgetUsd: numeric("monthly_cost_budget_usd").default("0"),
  tokensUsedThisMonth: bigint("tokens_used_this_month", { mode: "number" }).default(0),
  costUsedThisMonthUsd: numeric("cost_used_this_month_usd").default("0"),
  budgetResetAt: timestamp("budget_reset_at").defaultNow(),
  defaultRoutingStrategy: varchar("default_routing_strategy", { length: 32 }).default("balanced"),
  routingWeights: jsonb("routing_weights").default({ cost: 0.4, quality: 0.35, latency: 0.25 }),
  preferLocal: boolean("prefer_local").default(false),
  providerKeys: jsonb("provider_keys").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("organizations_slug_idx").on(table.slug),
  index("organizations_owner_id_idx").on(table.ownerId),
]);

export const orgMembers = pgTable("org_members", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  userId: varchar("user_id", { length: 128 }).notNull(),
  role: varchar("role", { length: 32 }).notNull().default("member"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("org_members_org_user_idx").on(table.orgId, table.userId),
]);

export const usageDaily = pgTable("usage_daily", {
  id: serial("id").primaryKey(),
  orgId: integer("org_id").notNull().references(() => organizations.id),
  date: date("date").notNull(),
  totalRequests: integer("total_requests").default(0),
  totalTokens: bigint("total_tokens", { mode: "number" }).default(0),
  totalCostUsd: numeric("total_cost_usd").default("0"),
  cacheHits: integer("cache_hits").default(0),
  cacheMisses: integer("cache_misses").default(0),
  providerBreakdown: jsonb("provider_breakdown").default({}),
  modelBreakdown: jsonb("model_breakdown").default({}),
}, (table) => [
  uniqueIndex("usage_daily_org_date_idx").on(table.orgId, table.date),
]);

// ============================================================
// Existing Tables (extended with org_id)
// ============================================================

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  orgId: integer("org_id").references(() => organizations.id),
  environment: varchar("environment", { length: 32 }).default("production"),
  enabled: boolean("enabled").default(true).notNull(),
  monthlyTokenBudget: integer("monthly_token_budget"),
  monthlyCostBudgetUsd: real("monthly_cost_budget_usd"),
  rateLimitRpm: integer("rate_limit_rpm").default(60),
  rateLimitTpm: integer("rate_limit_tpm").default(100000),
  tokensUsedThisMonth: integer("tokens_used_this_month").default(0).notNull(),
  costUsedThisMonthUsd: real("cost_used_this_month_usd").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("api_keys_key_idx").on(table.key),
  index("api_keys_org_id_idx").on(table.orgId),
]);

export const requestLogs = pgTable("request_logs", {
  id: serial("id").primaryKey(),
  requestId: varchar("request_id", { length: 64 }).notNull(),
  apiKeyId: integer("api_key_id"),
  orgId: integer("org_id").references(() => organizations.id),
  modelRequested: varchar("model_requested", { length: 128 }).notNull(),
  modelUsed: varchar("model_used", { length: 128 }).notNull(),
  provider: varchar("provider", { length: 64 }).notNull(),
  routingStrategy: varchar("routing_strategy", { length: 32 }),
  routingDecision: text("routing_decision"),
  promptTokens: integer("prompt_tokens").default(0).notNull(),
  completionTokens: integer("completion_tokens").default(0).notNull(),
  totalTokens: integer("total_tokens").default(0).notNull(),
  latencyMs: integer("latency_ms").default(0).notNull(),
  costUsd: real("cost_usd").default(0).notNull(),
  cacheHit: boolean("cache_hit").default(false).notNull(),
  fallbackUsed: boolean("fallback_used").default(false).notNull(),
  statusCode: integer("status_code").default(200).notNull(),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("request_logs_created_at_idx").on(table.createdAt),
  index("request_logs_api_key_id_idx").on(table.apiKeyId),
  index("request_logs_provider_idx").on(table.provider),
  index("request_logs_org_id_idx").on(table.orgId, table.createdAt),
]);

export const budgetAlerts = pgTable("budget_alerts", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull(),
  orgId: integer("org_id").references(() => organizations.id),
  threshold: real("threshold").notNull(),
  type: varchar("type", { length: 32 }).notNull(),
  triggered: boolean("triggered").default(false).notNull(),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
