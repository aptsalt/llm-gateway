import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://gateway:gateway@localhost:5432/gateway"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  TOGETHER_API_KEY: z.string().optional(),
  OLLAMA_URL: z.string().default("http://localhost:11434"),
  ADMIN_API_KEY: z.string().default("gw-admin-change-me"),
  ENABLE_METRICS: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REDACT_PROMPTS: z.coerce.boolean().default(true),
  // Cache configuration
  CACHE_TTL_SECONDS: z.coerce.number().default(3600),
  CACHE_SIMILARITY_THRESHOLD: z.coerce.number().min(0).max(1).default(0.95),
  CACHE_MAX_ENTRIES: z.coerce.number().default(10000),
  // Budget defaults
  GLOBAL_MONTHLY_USD_BUDGET: z.coerce.number().optional(),
  GLOBAL_MONTHLY_TOKEN_BUDGET: z.coerce.number().optional(),
  // Routing
  DEFAULT_ROUTING_STRATEGY: z.enum(["cost", "quality", "latency", "balanced"]).default("balanced"),
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
