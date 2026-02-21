import { Hono, type Context } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { compress } from "hono/compress";
import { nanoid } from "nanoid";
import { Redis } from "ioredis";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
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
import { EmbeddingRequestSchema } from "./gateway/validator.js";
import { RequestTracker } from "./observability/request-tracker.js";
import { createTenantMiddleware } from "./middleware/tenant.js";
import { organizations, orgMembers } from "./db/schema.js";

const { Pool } = pg;
const startedAt = Date.now();

export async function createApp() {
  const app = new Hono();
  const requestTracker = new RequestTracker();

  // Middleware
  app.use("*", cors());
  app.use("*", compress());
  app.use("*", logger());

  // Request ID and response timing middleware
  app.use("*", async (c, next) => {
    const requestId = c.req.header("X-Request-ID") ?? nanoid();
    const start = performance.now();
    requestTracker.track(requestId);
    c.header("X-Request-ID", requestId);
    await next();
    const duration = performance.now() - start;
    c.header("X-Response-Time", `${duration.toFixed(2)}ms`);
    c.header("X-Powered-By", "RouterAI Gateway");
    requestTracker.complete(requestId);
  });

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

  // Tenant resolution middleware (must be after DB init)
  app.use("/v1/*", createTenantMiddleware(db as any));

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
  const budgetEnforcer = new BudgetEnforcer({
    monthlyUsd: env.GLOBAL_MONTHLY_USD_BUDGET,
    monthlyTokens: env.GLOBAL_MONTHLY_TOKEN_BUDGET,
  });
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
    requestTracker,
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

  // Embeddings endpoint (OpenAI-compatible)
  app.post("/v1/embeddings", async (c) => {
    const body = await c.req.json();
    const parseResult = EmbeddingRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return c.json({
        error: { message: "Invalid request body", type: "invalid_request_error", details: parseResult.error.flatten() },
      }, 400);
    }

    const inputs = Array.isArray(parseResult.data.input) ? parseResult.data.input : [parseResult.data.input];
    const embeddings = await Promise.all(inputs.map((text) => embedder.embed(text)));

    return c.json({
      object: "list",
      data: embeddings.map((embedding, index) => ({
        object: "embedding",
        embedding,
        index,
      })),
      model: parseResult.data.model,
      usage: {
        prompt_tokens: inputs.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
        total_tokens: inputs.reduce((acc, t) => acc + Math.ceil(t.length / 4), 0),
      },
    });
  });

  // Health endpoint
  app.get("/health", async (c) => {
    const healthResults = await registry.runHealthChecks();
    const anyHealthy = Array.from(healthResults.values()).some((h) => h.healthy);
    const healthyCount = Array.from(healthResults.values()).filter((h) => h.healthy).length;
    const totalCount = healthResults.size;
    return c.json(
      {
        status: anyHealthy ? "ok" : "degraded",
        version: "2.0.0-saas",
        uptime: Math.floor((Date.now() - startedAt) / 1000),
        activeRequests: requestTracker.getActiveCount(),
        providers: {
          healthy: healthyCount,
          total: totalCount,
          details: Object.fromEntries(healthResults),
        },
        infrastructure: {
          redis: redis !== null,
          postgres: db !== null,
          cache: semanticCache !== null,
        },
        timestamp: new Date().toISOString(),
      },
      anyHealthy ? 200 : 503
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

  // === SaaS Organization API ===
  app.post("/api/org", adminAuth, async (c) => {
    if (!db) return c.json({ error: "Database not available" }, 503);
    const body = await c.req.json() as { name: string; slug: string; ownerId: string };

    const [org] = await (db as any)
      .insert(organizations)
      .values({
        name: body.name,
        slug: body.slug,
        ownerId: body.ownerId,
      })
      .returning();

    // Create owner membership
    await (db as any)
      .insert(orgMembers)
      .values({
        orgId: org.id,
        userId: body.ownerId,
        role: "owner",
      });

    // Create initial API key for the org
    const firstKey = apiKeyManager
      ? await apiKeyManager.createKey({ name: "Default Key", orgId: org.id })
      : null;

    return c.json({ org, apiKey: firstKey }, 201);
  });

  app.get("/api/org/:id", async (c) => {
    if (!db) return c.json({ error: "Database not available" }, 503);
    const id = parseInt(c.req.param("id"), 10);

    const [org] = await (db as any)
      .select()
      .from(organizations)
      .where(eq(organizations.id, id))
      .limit(1);

    if (!org) return c.json({ error: "Organization not found" }, 404);
    return c.json(org);
  });

  // Prometheus metrics
  app.get("/metrics", async (c) => {
    c.header("Content-Type", metricsRegistry.contentType);
    const metrics = await metricsRegistry.metrics();
    return c.text(metrics);
  });

  // Analytics endpoint
  app.get("/api/analytics", (c) => {
    const stats = requestTracker.getStats();
    return c.json({
      ...stats,
      budget: budgetEnforcer.getGlobalUsage(),
    });
  });

  // Analytics summary (last N minutes)
  app.get("/api/analytics/summary", (c) => {
    return c.json(requestTracker.getStats());
  });

  // Root
  app.get("/", (c) => {
    return c.json({
      name: "RouterAI Gateway",
      version: "2.0.0-saas",
      description: "Multi-tenant LLM API Gateway — cost-based routing, semantic caching, per-tenant budgets, multi-provider failover",
      uptime: Math.floor((Date.now() - startedAt) / 1000),
      endpoints: {
        "OpenAI Compatible": {
          chat: "POST /v1/chat/completions",
          embeddings: "POST /v1/embeddings",
          models: "GET /v1/models",
        },
        "Gateway": {
          health: "GET /health",
          metrics: "GET /metrics",
          providers: "GET /api/providers",
          analytics: "GET /api/analytics",
          cache: "GET /api/cache/stats",
          circuitBreakers: "GET /api/circuit-breakers",
          budget: "GET /api/budget",
          benchmarks: "GET /api/benchmarks",
        },
        "Admin (auth required)": {
          keys: "POST/GET/DELETE /api/admin/keys",
          routing: "GET/PUT /api/admin/routing",
          createOrg: "POST /api/org",
        },
      },
      docs: "https://routerai.dev/docs",
    });
  });

  // 404 handler
  app.notFound((c) => {
    return c.json({
      error: {
        message: `Route not found: ${c.req.method} ${c.req.path}`,
        type: "not_found",
        hint: "GET / for available endpoints",
      },
    }, 404);
  });

  // Global error handler
  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({
      error: {
        message: env.NODE_ENV === "production" ? "Internal server error" : err.message,
        type: "server_error",
      },
    }, 500);
  });

  return { app, requestTracker, cleanup: () => {
    registry.stopHealthCheckLoop();
    requestLogger.stopPeriodicFlush();
    redis?.disconnect();
  }};
}
