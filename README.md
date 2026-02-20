# LLM Gateway

Smart API gateway that routes LLM requests across multiple providers based on cost, latency, capability, and load — with semantic caching, token budgeting, and real-time observability.

```
┌─────────────────────────────────────────────────────┐
│                  Client Applications                  │
│            (OpenAI-compatible API calls)              │
└────────────────────┬──────────────────────────────────┘
                     │ POST /v1/chat/completions
┌────────────────────▼──────────────────────────────────┐
│                 Hono API Gateway                       │
│  ┌──────────┐ ┌──────────┐ ┌────────┐ ┌───────────┐  │
│  │Auth &    │→│Semantic  │→│Router  │→│Provider   │  │
│  │Budget    │ │Cache     │ │Engine  │ │Dispatcher │  │
│  └──────────┘ └──────────┘ └────────┘ └─────┬─────┘  │
│  ┌──────────────────────────────────────────┐│        │
│  │        Fallback Chain + Circuit Breaker   │◄┘       │
│  └──────────────────────────────────────────┘         │
└───┬──────────┬──────────┬──────────┬──────────────────┘
    │          │          │          │
┌───▼───┐ ┌───▼───┐ ┌───▼───┐ ┌───▼───┐
│Ollama │ │OpenAI │ │Claude │ │Groq/  │
│(local)│ │       │ │       │ │Others │
└───────┘ └───────┘ └───────┘ └───────┘
```

## Features

- **OpenAI-compatible API** — drop-in replacement. Change `base_url` to `http://localhost:4000/v1` and everything works
- **Virtual model names** — `model: "auto"` (router decides), `"fast"` (latency-optimized), `"cheap"` (cost-optimized)
- **Smart routing** — complexity classifier analyzes prompts and routes simple queries to cheap/local models, complex ones to capable models
- **Semantic caching** — embeds queries and returns cached responses for semantically similar requests (cosine similarity > 0.95). 20-40% hit rates in real deployments
- **Token budgets** — per-key monthly token and cost limits with 80%/95% alerts and automatic enforcement
- **Rate limiting** — Redis sliding window per-key RPM/TPM limits with `Retry-After` headers
- **Fallback chains** — ordered provider failover on timeout, 5xx, or rate limit errors
- **Circuit breakers** — per-provider circuit breakers prevent cascading failures (closed → open → half-open)
- **Observability** — Prometheus metrics, structured request logs, pre-configured Grafana dashboards
- **Admin dashboard** — Next.js app with real-time monitoring, routing config, API key management, and a playground

## Supported Providers

| Provider | Type | Cost | Notes |
|----------|------|------|-------|
| **Ollama** | Local | Free | Default/preferred, requires local Ollama |
| **Groq** | Cloud | Very low | Fastest inference |
| **Together AI** | Cloud | Low | Good open-source model selection |
| **OpenAI** | Cloud | Medium-High | GPT-4o, GPT-4o-mini |
| **Anthropic** | Cloud | Medium-High | Claude Sonnet/Haiku/Opus |

## Quick Start

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for full stack)
- Ollama running locally (optional but recommended)

### Development (gateway only)

```bash
# Install dependencies
npm install

# Copy env and configure API keys
cp .env.example .env

# Start the gateway (Redis/Postgres optional — runs without them)
npm run dev
```

The gateway starts at `http://localhost:4000`.

### Full Stack (Docker Compose)

```bash
# Set API keys in .env or pass as environment variables
cp .env.example .env

# Start everything
docker compose up -d

# Services:
# Gateway:    http://localhost:4000
# Dashboard:  http://localhost:3000
# Grafana:    http://localhost:3001 (admin/admin)
# Prometheus: http://localhost:9090
```

## Usage

### Send a chat request (OpenAI-compatible)

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

### Use virtual models

```bash
# Let the router decide the best model
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'

# Optimize for speed
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "fast", "messages": [{"role": "user", "content": "Hello"}]}'

# Optimize for cost
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "cheap", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Override routing strategy per-request

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Write a Python web scraper"}],
    "x-routing-strategy": "quality"
  }'
```

### Use with the OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="gw-dev-your-key"  # or any string if auth is disabled
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)
print(response.choices[0].message.content)

# Gateway metadata is in the response
print(response.model_extra.get("x-gateway"))
```

### Streaming

```bash
curl -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Write a haiku"}],
    "stream": true
  }'
```

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | Chat completion (OpenAI-compatible) |
| `GET` | `/v1/models` | List all available models |
| `GET` | `/health` | Provider health status |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/api/providers` | Provider status details |
| `GET` | `/api/cache/stats` | Cache hit/miss stats |
| `POST` | `/api/cache/invalidate` | Clear cache |
| `GET` | `/api/circuit-breakers` | Circuit breaker states |
| `GET` | `/api/budget` | Global budget usage |

### Admin Endpoints (require `Authorization: Bearer <ADMIN_API_KEY>`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/keys` | Create API key |
| `GET` | `/api/admin/keys` | List API keys |
| `DELETE` | `/api/admin/keys/:key` | Revoke API key |
| `GET` | `/api/admin/routing` | Get routing config |
| `PUT` | `/api/admin/routing` | Update routing config |

### Gateway Extensions

The gateway adds `x-gateway` metadata to every response:

```json
{
  "x-gateway": {
    "provider": "ollama",
    "routing_decision": "balanced: llama3.2 (score: 0.87, complexity: simple)",
    "latency_ms": 342,
    "cost_usd": 0,
    "cache_hit": false,
    "fallback_used": false
  }
}
```

Request extensions (prefixed with `x-`):

| Field | Type | Description |
|-------|------|-------------|
| `x-routing-strategy` | `"cost" \| "quality" \| "latency" \| "balanced"` | Override routing strategy |
| `x-prefer-provider` | `string` | Prefer a specific provider |
| `x-cache` | `boolean` | Enable/disable semantic cache (default: true) |
| `x-budget-key` | `string` | API key for budget tracking |

## Routing Strategies

| Strategy | Weights | Best for |
|----------|---------|----------|
| **balanced** | Cost 40%, Quality 35%, Latency 25% | General use |
| **cost** | Cost 80%, Quality 10%, Latency 10% | Budget-sensitive workloads |
| **quality** | Cost 5%, Quality 85%, Latency 10% | Complex reasoning, code gen |
| **latency** | Cost 10%, Quality 10%, Latency 80% | Real-time applications |

The complexity classifier automatically analyzes each prompt for code, math, creative writing, and conversation depth to select the right model tier.

## Tech Stack

- **Runtime:** TypeScript strict mode, Node.js 20+
- **Framework:** Hono
- **Cache:** Redis 7
- **Database:** PostgreSQL 16 + Drizzle ORM
- **Metrics:** Prometheus + Grafana
- **Dashboard:** Next.js 14 + Tailwind CSS + Recharts
- **Validation:** Zod
- **Testing:** Vitest (70 tests)
- **Containerization:** Docker Compose

## Project Structure

```
llm-gateway/
├── src/
│   ├── index.ts              # Entry point
│   ├── server.ts             # Hono app + routes
│   ├── env.ts                # Zod-validated environment config
│   ├── gateway/
│   │   ├── validator.ts      # OpenAI-compatible request/response schemas
│   │   └── handler.ts        # Main request handler (cache → route → execute → log)
│   ├── providers/
│   │   ├── interface.ts      # LLMProvider interface
│   │   ├── registry.ts       # Provider registry + health checks
│   │   ├── ollama.ts         # Ollama adapter
│   │   ├── openai.ts         # OpenAI adapter
│   │   ├── anthropic.ts      # Anthropic Claude adapter
│   │   ├── groq.ts           # Groq adapter
│   │   └── together.ts       # Together AI adapter
│   ├── router/
│   │   ├── router.ts         # Routing engine (score + select)
│   │   ├── classifier.ts     # Prompt complexity classifier
│   │   ├── capabilities.ts   # Model capability/cost profiles
│   │   └── config.ts         # Routing strategy configs
│   ├── cache/
│   │   ├── embedding.ts      # Embedding service (Ollama + fallback)
│   │   ├── semantic-cache.ts # Redis semantic cache
│   │   └── cache-stats.ts    # Hit/miss tracking
│   ├── budget/
│   │   ├── api-keys.ts       # API key CRUD
│   │   ├── budget.ts         # Budget enforcement
│   │   └── rate-limiter.ts   # Sliding window rate limiter
│   ├── reliability/
│   │   ├── fallback.ts       # Fallback chain executor
│   │   ├── circuit-breaker.ts # Circuit breaker state machine
│   │   └── timeout.ts        # Per-provider timeouts
│   ├── observability/
│   │   ├── metrics.ts        # Prometheus metrics
│   │   └── logger.ts         # Structured request logger
│   └── db/
│       ├── schema.ts         # Drizzle schema
│       └── migrate.ts        # Migration runner
├── dashboard/                # Next.js 14 admin dashboard
├── tests/                    # 70 unit tests
├── grafana/                  # Pre-configured Grafana dashboards
├── prometheus/               # Prometheus config
├── docker-compose.yml        # Full stack (6 services)
├── Dockerfile                # Gateway container
└── package.json
```

## Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

## License

MIT
