import { pgTable, text, integer, real, boolean, timestamp, jsonb, serial, varchar, index } from "drizzle-orm/pg-core";

export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  enabled: boolean("enabled").default(true).notNull(),
  monthlyTokenBudget: integer("monthly_token_budget"),
  monthlyCostBudgetUsd: real("monthly_cost_budget_usd"),
  rateLimitRpm: integer("rate_limit_rpm").default(60),
  rateLimitTpm: integer("rate_limit_tpm").default(100000),
  tokensUsedThisMonth: integer("tokens_used_this_month").default(0).notNull(),
  costUsedThisMonthUsd: real("cost_used_this_month_usd").default(0).notNull(),
  lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
}, (table) => [
  index("api_keys_key_idx").on(table.key),
]);

export const requestLogs = pgTable("request_logs", {
  id: serial("id").primaryKey(),
  requestId: varchar("request_id", { length: 64 }).notNull(),
  apiKeyId: integer("api_key_id"),
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
]);

export const budgetAlerts = pgTable("budget_alerts", {
  id: serial("id").primaryKey(),
  apiKeyId: integer("api_key_id").notNull(),
  threshold: real("threshold").notNull(), // 0.8, 0.95
  type: varchar("type", { length: 32 }).notNull(), // "tokens" | "cost"
  triggered: boolean("triggered").default(false).notNull(),
  triggeredAt: timestamp("triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
