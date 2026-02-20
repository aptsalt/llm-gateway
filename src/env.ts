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
});

export type Env = z.infer<typeof envSchema>;

export const env = envSchema.parse(process.env);
