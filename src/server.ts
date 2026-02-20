import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { Redis } from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

import { env } from "./env.js";
import { ProviderRegistry } from "./providers/registry.js";
import { OllamaProvider } from "./providers/ollama.js";
import { OpenAIProvider } from "./providers/openai.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GroqProvider } from "./providers/groq.js";
import { TogetherProvider } from "./providers/together.js";
import { Router } from "./router/router.js";
import { DEFAULT_ROUTING_CONFIG } from "./router/config.js";
import { FallbackChain } from "./reliability/fallback.js";
import { CircuitBreakerManager } from "./reliability/circuit-breaker.js";
import { EmbeddingService } from "./cache/embedding.js";
import { SemanticCache } from "./cache/semantic-cache.js";
import { CacheStats } from "./cache/cache-stats.js";
import { BudgetEnforcer } from "./budget/budget.js";
import { ApiKeyManager } from "./budget/api-keys.js";
import { RateLimiter } from "./budget/rate-limiter.js";
import { RequestLogger } from "./observability/logger.js";
import { metricsRegistry } from "./observability/metrics.js";
import { createChatHandler, type HandlerDeps } from "./gateway/handler.js";
import { BenchmarkRunner } from "./benchmark/runner.js";
import { ALL_BENCHMARK_TASKS, CATEGORIES } from "./benchmark/tasks.js";

const { Pool } = pg;

export async function createApp() {
  const app = new Hono();

  // Middleware
  app.use("*", cors());
  app.use("*", logger());

  // Initialize infrastructure
  let redis: Redis | null = null;
  let db: ReturnType<typeof drizzle> | null = null;

  try {
    redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 5000),
      lazyConnect: true,
    });
    await redis.connect();
    console.log("Redis connected");
  } catch (error) {
    console.warn("Redis not available, running without cache/rate-limiting:", error);
    redis = null;
  }

  try {
    const pool = new Pool({ connectionString: env.DATABASE_URL });
    db = drizzle(pool);
    console.log("PostgreSQL connected");
  } catch (error) {
    console.warn("PostgreSQL not available, running without persistence:", error);
    db = null;
  }

  // Initialize providers
  const registry = new ProviderRegistry();
  registry.register(new OllamaProvider());
  if (env.OPENAI_API_KEY) registry.register(new OpenAIProvider());
  if (env.ANTHROPIC_API_KEY) registry.register(new AnthropicProvider());
  if (env.GROQ_API_KEY) registry.register(new GroqProvider());
  if (env.TOGETHER_API_KEY) registry.register(new TogetherProvider());

  // Start health check loop
  registry.startHealthCheckLoop(30000);

  // Initialize router
  const router = new Router(registry, DEFAULT_ROUTING_CONFIG);

  // Initialize reliability
  const circuitBreakers = new CircuitBreakerManager();
  const fallbackChain = new FallbackChain(registry, circuitBreakers);

  // Initialize cache
  const embedder = new EmbeddingService();
  const semanticCache = redis ? new SemanticCache(redis, embedder) : null;
  const cacheStats = redis ? new CacheStats(redis) : null;

  // Initialize budget
  const budgetEnforcer = new BudgetEnforcer();
  const apiKeyManager = db ? new ApiKeyManager(db as any) : null;
  const rateLimiter = redis ? new RateLimiter(redis) : null;

  // Initialize logger
  const requestLogger = new RequestLogger(db as any);
  requestLogger.startPeriodicFlush(5000);

  // Build handler dependencies
  const deps: HandlerDeps = {
    registry,
    router,
    fallbackChain,
    semanticCache,
    cacheStats,
    budgetEnforcer,
    apiKeyManager,
    rateLimiter,
    requestLogger,
    routingConfig: DEFAULT_ROUTING_CONFIG,
  };

  // === API Routes ===

  // OpenAI-compatible chat completions
  app.post("/v1/chat/completions", createChatHandler(deps));

  // List models
  app.get("/v1/models", async (c) => {
    const models = await registry.getAllModels();
    return c.json({
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        object: "model",
        created: Math.floor(Date.now() / 1000),
        owned_by: m.provider,
        permission: [],
        root: m.id,
        parent: null,
      })),
    });
  });

  // Health endpoint
  app.get("/health", async (c) => {
    const healthResults = await registry.runHealthChecks();
    const allHealthy = Array.from(healthResults.values()).some((h) => h.healthy);
    return c.json(
      {
        status: allHealthy ? "ok" : "degraded",
        providers: Object.fromEntries(healthResults),
        timestamp: new Date().toISOString(),
      },
      allHealthy ? 200 : 503
    );
  });

  // Provider status
  app.get("/api/providers", (c) => {
    return c.json(registry.getProvidersStatus());
  });

  // Cache stats
  app.get("/api/cache/stats", async (c) => {
    if (!cacheStats) {
      return c.json({ error: "Cache not available" }, 503);
    }
    const stats = await cacheStats.getStats();
    const cacheInfo = semanticCache ? await semanticCache.getStats() : null;
    return c.json({ ...stats, totalEntries: cacheInfo?.totalEntries ?? 0 });
  });

  // Cache invalidation
  app.post("/api/cache/invalidate", async (c) => {
    if (!semanticCache) {
      return c.json({ error: "Cache not available" }, 503);
    }
    const body = await c.req.json().catch(() => ({}));
    const pattern = (body as { pattern?: string }).pattern;
    const removed = await semanticCache.invalidate(pattern);
    return c.json({ removed });
  });

  // Circuit breaker status
  app.get("/api/circuit-breakers", (c) => {
    const stats = circuitBreakers.getAllStats();
    return c.json(Object.fromEntries(stats));
  });

  // Budget status
  app.get("/api/budget", (c) => {
    return c.json(budgetEnforcer.getGlobalUsage());
  });

  // === Benchmark API ===
  const benchmarkRunner = new BenchmarkRunner(registry);

  app.get("/api/benchmarks", (c) => {
    return c.json({
      categories: CATEGORIES,
      totalTasks: ALL_BENCHMARK_TASKS.length,
      tasks: ALL_BENCHMARK_TASKS.map((t) => ({
        id: t.id,
        category: t.category,
        name: t.name,
        scoring: t.scoring,
      })),
    });
  });

  app.get("/api/benchmarks/status", (c) => {
    return c.json(benchmarkRunner.getStatus());
  });

  app.get("/api/benchmarks/results", (c) => {
    return c.json(benchmarkRunner.getLatestResults());
  });

  app.post("/api/benchmarks/run", async (c) => {
    if (benchmarkRunner.isRunning()) {
      return c.json({ error: "Benchmark already running", status: benchmarkRunner.getStatus() }, 409);
    }

    const body = await c.req.json().catch(() => ({}));
    const config = body as { models?: string[]; categories?: string[] };

    // Run benchmark in background
    benchmarkRunner.run(config).catch((err) => {
      console.error("Benchmark run failed:", err);
    });

    // Return immediately with status
    return c.json({ message: "Benchmark started", status: benchmarkRunner.getStatus() }, 202);
  });

  // === Admin API (requires admin key) ===
  const adminAuth = async (c: Context, next: () => Promise<void>) => {
    const authHeader = c.req.header("Authorization");
    const key = authHeader?.replace("Bearer ", "");
    if (key !== env.ADMIN_API_KEY) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    await next();
  };

  // API Key management
  app.post("/api/admin/keys", adminAuth, async (c) => {
    if (!apiKeyManager) {
      return c.json({ error: "Database not available" }, 503);
    }
    const body = await c.req.json();
    const record = await apiKeyManager.createKey(body);
    return c.json(record, 201);
  });

  app.get("/api/admin/keys", adminAuth, async (c) => {
    if (!apiKeyManager) {
      return c.json({ error: "Database not available" }, 503);
    }
    const keys = await apiKeyManager.listKeys();
    return c.json(keys);
  });

  app.delete("/api/admin/keys/:key", adminAuth, async (c) => {
    if (!apiKeyManager) {
      return c.json({ error: "Database not available" }, 503);
    }
    const key = c.req.param("key");
    const success = await apiKeyManager.revokeKey(key);
    return c.json({ success });
  });

  // Routing config
  app.get("/api/admin/routing", (c) => {
    return c.json(deps.routingConfig);
  });

  app.put("/api/admin/routing", adminAuth, async (c) => {
    const body = await c.req.json();
    deps.routingConfig = body;
    router.updateConfig(body);
    return c.json({ success: true });
  });

  // Prometheus metrics
  app.get("/metrics", async (c) => {
    c.header("Content-Type", metricsRegistry.contentType);
    const metrics = await metricsRegistry.metrics();
    return c.text(metrics);
  });

  // Root
  app.get("/", (c) => {
    return c.json({
      name: "llm-gateway",
      version: "1.0.0",
      description: "Smart LLM API Gateway",
      endpoints: {
        chat: "POST /v1/chat/completions",
        models: "GET /v1/models",
        health: "GET /health",
        metrics: "GET /metrics",
        admin: "/api/admin/*",
      },
    });
  });

  return { app, cleanup: () => {
    registry.stopHealthCheckLoop();
    requestLogger.stopPeriodicFlush();
    redis?.disconnect();
  }};
}
