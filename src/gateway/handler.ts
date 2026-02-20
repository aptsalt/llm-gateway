import { nanoid } from "nanoid";
import type { Context } from "hono";
import type { ProviderRegistry } from "../providers/registry.js";
import type { Router, RoutingDecision } from "../router/router.js";
import type { FallbackChain } from "../reliability/fallback.js";
import type { SemanticCache } from "../cache/semantic-cache.js";
import type { CacheStats } from "../cache/cache-stats.js";
import type { BudgetEnforcer } from "../budget/budget.js";
import type { ApiKeyManager } from "../budget/api-keys.js";
import type { RateLimiter } from "../budget/rate-limiter.js";
import type { RequestLogger } from "../observability/logger.js";
import type { RequestTracker } from "../observability/request-tracker.js";
import { ChatRequestSchema, type ChatResponse, type StreamChunk } from "./validator.js";
import { recordRequest } from "../observability/metrics.js";
import { ErrorCode, gatewayError } from "./errors.js";
import type { RoutingConfig } from "../router/config.js";
import { capabilityMap } from "../router/capabilities.js";

export interface HandlerDeps {
  registry: ProviderRegistry;
  router: Router;
  fallbackChain: FallbackChain;
  semanticCache: SemanticCache | null;
  cacheStats: CacheStats | null;
  budgetEnforcer: BudgetEnforcer;
  apiKeyManager: ApiKeyManager | null;
  rateLimiter: RateLimiter | null;
  requestLogger: RequestLogger;
  requestTracker?: RequestTracker;
  routingConfig: RoutingConfig;
}

export function createChatHandler(deps: HandlerDeps) {
  return async (c: Context) => {
    const requestId = nanoid();
    const startTime = Date.now();

    try {
      // Parse and validate request
      const body = await c.req.json();
      const parseResult = ChatRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return c.json(
          gatewayError("Invalid request body", ErrorCode.INVALID_REQUEST, parseResult.error.flatten()),
          400
        );
      }
      const request = parseResult.data;

      // Auth & budget check
      const apiKeyHeader = c.req.header("Authorization")?.replace("Bearer ", "") ?? request["x-budget-key"];
      let apiKeyRecord = null;

      if (apiKeyHeader && deps.apiKeyManager) {
        apiKeyRecord = await deps.apiKeyManager.validateKey(apiKeyHeader);
        if (!apiKeyRecord) {
          return c.json(gatewayError("Invalid API key", ErrorCode.AUTHENTICATION), 401);
        }

        // Budget check
        const budgetCheck = deps.budgetEnforcer.checkBudget(apiKeyRecord);
        if (!budgetCheck.allowed) {
          return c.json(
            gatewayError(budgetCheck.reason ?? "Budget exceeded", ErrorCode.BUDGET_EXCEEDED),
            429
          );
        }

        // Rate limit check
        if (deps.rateLimiter && apiKeyRecord.rateLimitRpm) {
          const rateResult = await deps.rateLimiter.checkRequestRate(
            apiKeyRecord.id.toString(),
            apiKeyRecord.rateLimitRpm
          );
          if (!rateResult.allowed) {
            c.header("Retry-After", Math.ceil((rateResult.retryAfterMs ?? 60000) / 1000).toString());
            c.header("X-RateLimit-Limit", String(apiKeyRecord.rateLimitRpm));
            c.header("X-RateLimit-Remaining", String(rateResult.remaining ?? 0));
            c.header("X-RateLimit-Reset", String(Math.ceil((rateResult.resetInMs ?? 60000) / 1000)));
            return c.json(gatewayError("Rate limit exceeded", ErrorCode.RATE_LIMITED), 429);
          }
        }
      }

      // Semantic cache lookup
      if (request["x-cache"] && deps.semanticCache && !request.stream) {
        const queryText = request.messages.map((m) => m.content).join("\n");
        const cachedResponse = await deps.semanticCache.lookup(queryText, request.model);
        if (cachedResponse) {
          deps.cacheStats?.recordHit(request.model, cachedResponse["x-gateway"].cost_usd);
          const latencyMs = Date.now() - startTime;

          recordRequest({
            provider: cachedResponse["x-gateway"].provider,
            model: cachedResponse.model,
            status: 200,
            strategy: "cache",
            latencyMs,
            promptTokens: cachedResponse.usage.prompt_tokens,
            completionTokens: cachedResponse.usage.completion_tokens,
            costUsd: 0,
            cacheHit: true,
          });

          deps.requestLogger.log({
            requestId,
            apiKeyId: apiKeyRecord?.id,
            modelRequested: request.model,
            modelUsed: cachedResponse.model,
            provider: cachedResponse["x-gateway"].provider,
            routingStrategy: "cache",
            promptTokens: cachedResponse.usage.prompt_tokens,
            completionTokens: cachedResponse.usage.completion_tokens,
            totalTokens: cachedResponse.usage.total_tokens,
            latencyMs,
            costUsd: 0,
            cacheHit: true,
            fallbackUsed: false,
            statusCode: 200,
          });

          return c.json({ ...cachedResponse, id: requestId });
        }
        deps.cacheStats?.recordMiss(request.model);
      }

      // Route the request
      const decision = deps.router.route(request);

      // Handle streaming
      if (request.stream) {
        return handleStreamRequest(c, request, decision, deps, requestId, startTime, apiKeyRecord);
      }

      // Execute with fallback
      const fallbackResult = await deps.fallbackChain.execute(
        request,
        decision.provider,
        deps.routingConfig.fallbackChain
      );

      const { result, provider, fallbackUsed } = fallbackResult;
      const latencyMs = Date.now() - startTime;

      // Calculate cost
      const costEstimate = provider.estimateCost(request);
      const costUsd =
        (result.usage.promptTokens / 1000) *
          (capabilityMap.getProfile(provider.id, result.model)?.costPer1kInput ?? costEstimate.estimatedCostUsd / 2) +
        (result.usage.completionTokens / 1000) *
          (capabilityMap.getProfile(provider.id, result.model)?.costPer1kOutput ?? costEstimate.estimatedCostUsd / 2);

      // Build response
      const response: ChatResponse = {
        id: requestId,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: result.content },
            finish_reason: result.finishReason,
          },
        ],
        usage: {
          prompt_tokens: result.usage.promptTokens,
          completion_tokens: result.usage.completionTokens,
          total_tokens: result.usage.totalTokens,
        },
        "x-gateway": {
          provider: provider.id,
          routing_decision: decision.reasoning,
          latency_ms: latencyMs,
          cost_usd: costUsd,
          cache_hit: false,
          fallback_used: fallbackUsed,
        },
      };

      // Store in cache
      if (request["x-cache"] && deps.semanticCache && !request.stream) {
        const queryText = request.messages.map((m) => m.content).join("\n");
        void deps.semanticCache.store(queryText, request.model, response);
      }

      // Record usage
      if (apiKeyRecord && deps.apiKeyManager) {
        void deps.apiKeyManager.recordUsage(apiKeyRecord.id, result.usage.totalTokens, costUsd);
      }
      deps.budgetEnforcer.recordGlobalUsage(result.usage.totalTokens, costUsd);

      // Record metrics
      recordRequest({
        provider: provider.id,
        model: result.model,
        status: 200,
        strategy: decision.strategy,
        latencyMs,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        costUsd,
        cacheHit: false,
      });

      deps.requestLogger.log({
        requestId,
        apiKeyId: apiKeyRecord?.id,
        modelRequested: request.model,
        modelUsed: result.model,
        provider: provider.id,
        routingStrategy: decision.strategy,
        routingDecision: decision.reasoning,
        promptTokens: result.usage.promptTokens,
        completionTokens: result.usage.completionTokens,
        totalTokens: result.usage.totalTokens,
        latencyMs,
        costUsd,
        cacheHit: false,
        fallbackUsed,
        statusCode: 200,
      });

      // Update latency metrics
      capabilityMap.updateLatency(provider.id, result.model, latencyMs);

      return c.json(response);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const message = error instanceof Error ? error.message : "Internal server error";
      const isProviderError = message.includes("All providers failed");
      const errorType = isProviderError ? ErrorCode.ALL_PROVIDERS_FAILED : ErrorCode.SERVER_ERROR;
      const statusCode = isProviderError ? 502 : 500;

      deps.requestLogger.log({
        requestId,
        modelRequested: "unknown",
        modelUsed: "none",
        provider: "none",
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        latencyMs,
        costUsd: 0,
        cacheHit: false,
        fallbackUsed: false,
        statusCode,
        errorMessage: message,
      });

      return c.json(gatewayError(message, errorType), statusCode);
    }
  };
}

async function handleStreamRequest(
  c: Context,
  request: ReturnType<typeof ChatRequestSchema.parse>,
  decision: RoutingDecision,
  deps: HandlerDeps,
  requestId: string,
  startTime: number,
  apiKeyRecord: { id: number } | null
) {
  c.header("Content-Type", "text/event-stream");
  c.header("Cache-Control", "no-cache");
  c.header("Connection", "keep-alive");

  const provider = decision.provider;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let totalContent = "";

      try {
        const iterable = provider.chatStream(request);
        for await (const chunk of iterable) {
          totalContent += chunk.content;

          const sseChunk: StreamChunk = {
            id: requestId,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: request.model,
            choices: [
              {
                index: 0,
                delta: { content: chunk.content },
                finish_reason: chunk.finishReason,
              },
            ],
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(sseChunk)}\n\n`));
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();

        // Record metrics after stream completes
        const latencyMs = Date.now() - startTime;
        const estimatedTokens = Math.ceil(totalContent.length / 4);
        const costEstimate = provider.estimateCost(request);

        recordRequest({
          provider: provider.id,
          model: request.model,
          status: 200,
          strategy: decision.strategy,
          latencyMs,
          promptTokens: costEstimate.estimatedInputTokens,
          completionTokens: estimatedTokens,
          costUsd: costEstimate.estimatedCostUsd,
          cacheHit: false,
        });

        deps.requestLogger.log({
          requestId,
          apiKeyId: apiKeyRecord?.id,
          modelRequested: request.model,
          modelUsed: request.model,
          provider: provider.id,
          routingStrategy: decision.strategy,
          routingDecision: decision.reasoning,
          promptTokens: costEstimate.estimatedInputTokens,
          completionTokens: estimatedTokens,
          totalTokens: costEstimate.estimatedInputTokens + estimatedTokens,
          latencyMs,
          costUsd: costEstimate.estimatedCostUsd,
          cacheHit: false,
          fallbackUsed: false,
          statusCode: 200,
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Stream error";
        const errorChunk = { error: { message: errorMessage, type: "stream_error" } };
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

