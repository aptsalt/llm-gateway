import { z } from "zod";

export const MessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

export const ChatRequestSchema = z.object({
  model: z.string(),
  messages: z.array(MessageSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  n: z.number().int().min(1).max(1).default(1),
  // Gateway extensions
  "x-routing-strategy": z.enum(["cost", "quality", "latency", "balanced"]).optional(),
  "x-prefer-provider": z.string().optional(),
  "x-cache": z.boolean().default(true),
  "x-budget-key": z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatChoiceSchema = z.object({
  index: z.number(),
  message: MessageSchema,
  finish_reason: z.enum(["stop", "length", "content_filter"]).nullable(),
});

export const UsageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
  total_tokens: z.number(),
});

export const GatewayMetadataSchema = z.object({
  provider: z.string(),
  routing_decision: z.string(),
  latency_ms: z.number(),
  cost_usd: z.number(),
  cache_hit: z.boolean(),
  fallback_used: z.boolean(),
});

export const ChatResponseSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion"),
  created: z.number(),
  model: z.string(),
  choices: z.array(ChatChoiceSchema),
  usage: UsageSchema,
  "x-gateway": GatewayMetadataSchema,
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;

export const EmbeddingRequestSchema = z.object({
  model: z.string(),
  input: z.union([z.string(), z.array(z.string())]),
  encoding_format: z.enum(["float", "base64"]).optional(),
});

export type EmbeddingRequest = z.infer<typeof EmbeddingRequestSchema>;

export const StreamChunkSchema = z.object({
  id: z.string(),
  object: z.literal("chat.completion.chunk"),
  created: z.number(),
  model: z.string(),
  choices: z.array(
    z.object({
      index: z.number(),
      delta: z.object({
        role: z.enum(["system", "user", "assistant"]).optional(),
        content: z.string().optional(),
      }),
      finish_reason: z.enum(["stop", "length", "content_filter"]).nullable(),
    })
  ),
});

export type StreamChunk = z.infer<typeof StreamChunkSchema>;
