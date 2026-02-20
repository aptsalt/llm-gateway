import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const requestsTotal = new Counter({
  name: "gateway_requests_total",
  help: "Total number of gateway requests",
  labelNames: ["provider", "model", "status", "routing_strategy"] as const,
  registers: [metricsRegistry],
});

export const tokensTotal = new Counter({
  name: "gateway_tokens_total",
  help: "Total tokens processed",
  labelNames: ["direction", "provider", "model"] as const,
  registers: [metricsRegistry],
});

export const latencyHistogram = new Histogram({
  name: "gateway_latency_seconds",
  help: "Request latency in seconds",
  labelNames: ["provider", "model", "stage"] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
  registers: [metricsRegistry],
});

export const costDollars = new Counter({
  name: "gateway_cost_dollars",
  help: "Total cost in USD",
  labelNames: ["provider", "model"] as const,
  registers: [metricsRegistry],
});

export const cacheHitsTotal = new Counter({
  name: "gateway_cache_hits_total",
  help: "Total cache hits",
  registers: [metricsRegistry],
});

export const cacheMissesTotal = new Counter({
  name: "gateway_cache_misses_total",
  help: "Total cache misses",
  registers: [metricsRegistry],
});

export const circuitBreakerState = new Gauge({
  name: "gateway_circuit_breaker_state",
  help: "Circuit breaker state (0=closed, 1=half-open, 2=open)",
  labelNames: ["provider"] as const,
  registers: [metricsRegistry],
});

export const budgetRemaining = new Gauge({
  name: "gateway_budget_remaining",
  help: "Budget remaining percentage",
  labelNames: ["api_key", "type"] as const,
  registers: [metricsRegistry],
});

export const activeProviders = new Gauge({
  name: "gateway_active_providers",
  help: "Number of active (healthy) providers",
  registers: [metricsRegistry],
});

export function recordRequest(params: {
  provider: string;
  model: string;
  status: number;
  strategy: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  cacheHit: boolean;
}): void {
  requestsTotal.inc({
    provider: params.provider,
    model: params.model,
    status: params.status.toString(),
    routing_strategy: params.strategy,
  });

  tokensTotal.inc(
    { direction: "input", provider: params.provider, model: params.model },
    params.promptTokens
  );
  tokensTotal.inc(
    { direction: "output", provider: params.provider, model: params.model },
    params.completionTokens
  );

  latencyHistogram.observe(
    { provider: params.provider, model: params.model, stage: "total" },
    params.latencyMs / 1000
  );

  costDollars.inc(
    { provider: params.provider, model: params.model },
    params.costUsd
  );

  if (params.cacheHit) {
    cacheHitsTotal.inc();
  } else {
    cacheMissesTotal.inc();
  }
}
