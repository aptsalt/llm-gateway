# LLM Gateway

> Intelligent multi-provider LLM gateway with cost-optimized routing, semantic caching, automated benchmarking, and real-time observability. Drop-in OpenAI API replacement.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7_strict-blue?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4.6-orange?logo=hono&logoColor=white)](https://hono.dev)
[![Tests](https://img.shields.io/badge/Tests-111%20passing-brightgreen)](tests/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org)

```
                         ┌────────────────────────────┐
                         │     Client Applications     │
                         │   (OpenAI SDK / curl / any) │
                         └──────────┬─────────────────┘
                                    │
                          POST /v1/chat/completions
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                        LLM Gateway (Hono)                              │
│                                                                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │  Auth &   │→│ Semantic   │→│  Router   │→│  Fallback Chain      │  │
│  │  Budget   │  │  Cache     │  │  Engine   │  │  + Circuit Breakers  │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────┬───────────┘  │
│                                                         │              │
│  ┌──────────────────────────────────────────────────────┘              │
│  │                                                                     │
│  ▼          ▼           ▼           ▼           ▼                      │
│ Ollama    OpenAI    Anthropic     Groq      Together                   │
│ (local)   (cloud)   (cloud)     (cloud)    (cloud)                    │
│                                                                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │Prometheus│  │ PostgreSQL │  │  Redis    │  │  Benchmark Suite     │  │
│  │ Metrics  │  │   Logs     │  │  Cache    │  │  (14 tasks)          │  │
│  └──────────┘  └───────────┘  └──────────┘  └──────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## The Problem

Most teams deploying LLMs either:
- **Pick one provider** and miss cost savings from cheaper models that can handle simple queries
- **Hardcode routing logic** that breaks when providers go down
- **Have no visibility** into per-request costs, latency, or cache hit rates
- **Can't compare models** objectively — decisions are based on vibes, not data

## The Solution

LLM Gateway sits between your app and LLM providers. One API, intelligent routing, full observability.

| Feature | What It Does |
|---------|-------------|
| **Smart Routing** | Classifies prompt complexity, routes to optimal model |
| **Semantic Caching** | Similar queries hit cache (cosine similarity 0.95) |
| **Circuit Breakers** | Auto-failover when providers go down |
| **Budget Control** | Per-key monthly token/USD limits with alerts |
| **Benchmarking** | 14 tasks, 4 scoring strategies — data-driven model selection |
| **OpenAI Compatible** | Change `base_url` and you're done |

---

## Quick Start

### Minimal (no Docker)

```bash
git clone https://github.com/aptsalt/llm-gateway.git
cd llm-gateway
npm install
cp .env.example .env
npm run dev
# → http://localhost:4000
```

The gateway runs without Redis or PostgreSQL — caching and persistence are gracefully disabled.

### Full Stack (Docker Compose)

```bash
cp .env.example .env
# Add your API keys to .env

docker compose up -d

# Gateway:    http://localhost:4000
# Prometheus: http://localhost:9090
# Grafana:    http://localhost:3001 (admin/admin)
```

### Your First Request

```bash
curl http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "What is 2+2?"}]
  }'
```

The gateway will:
1. Classify the prompt as "simple"
2. Route to the cheapest healthy model (Ollama if running locally)
3. Return an OpenAI-compatible response with routing metadata

---

## Usage

### Virtual Model Names

Instead of hardcoding a specific model, use intent-based routing:

| Model | Behavior |
|-------|----------|
| `auto` | Router analyzes complexity and picks the best model |
| `fast` | Lowest latency available |
| `cheap` | Lowest cost model |
| `quality` | Highest quality model |

```bash
# Let the router decide
curl -X POST localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Hello"}]}'

# Force cheapest model
curl -X POST localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "cheap", "messages": [{"role": "user", "content": "Hello"}]}'
```

### Per-Request Routing Override

```bash
curl -X POST localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "auto",
    "messages": [{"role": "user", "content": "Write a Python web scraper"}],
    "x-routing-strategy": "quality",
    "x-prefer-provider": "anthropic"
  }'
```

### OpenAI Python SDK

```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:4000/v1",
    api_key="gw-dev-your-key"
)

response = client.chat.completions.create(
    model="auto",
    messages=[{"role": "user", "content": "Explain quantum computing"}]
)

print(response.choices[0].message.content)

# Routing metadata
gateway = response.model_extra.get("x-gateway")
print(f"Provider: {gateway['provider']}, Cost: ${gateway['cost_usd']:.6f}")
```

### Streaming

```bash
curl -sN localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model": "auto", "messages": [{"role": "user", "content": "Write a haiku"}], "stream": true}'
```

### Embeddings

```bash
curl -X POST localhost:4000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "nomic-embed-text", "input": "Hello world"}'
```

---

## Supported Providers

| Provider | Type | Cost | Speed | Quality | Models |
|----------|------|------|-------|---------|--------|
| **Ollama** | Local GPU | Free | Medium | Varies | llama3.2, qwen2.5-coder |
| **Groq** | Cloud | Very Low | Very Fast | Good | llama-3.3-70b, llama-3.1-8b |
| **Together AI** | Cloud | Low | Fast | Good | Llama-3.3-70B, Mixtral, Qwen |
| **OpenAI** | Cloud | Medium-High | Medium | Excellent | gpt-4o, gpt-4o-mini |
| **Anthropic** | Cloud | Medium-High | Medium | Excellent | claude-sonnet-4, claude-haiku |

---

## Routing Strategies

| Strategy | Weights | Use Case |
|----------|---------|----------|
| **balanced** | Cost 40%, Quality 35%, Latency 25% | General purpose |
| **cost** | Cost 80%, Quality 10%, Latency 10% | Budget-sensitive workloads |
| **quality** | Cost 5%, Quality 85%, Latency 10% | Complex reasoning, code generation |
| **latency** | Cost 10%, Quality 10%, Latency 80% | Real-time / interactive apps |

### How Routing Works

1. **Classify** — The prompt classifier detects code, math, creative writing, and conversation depth
2. **Score** — Each healthy model is scored: `cost × weight + quality × weight + latency × weight`
3. **Prefer Local** — If an Ollama model scores within 70% of the best, it wins (configurable)
4. **Fallback** — If primary fails, the fallback chain tries alternatives with exponential backoff

---

## Benchmarking

14 standardized tasks across 5 categories:

| Category | Tasks | Scoring |
|----------|-------|---------|
| **Knowledge (MMLU)** | Physics, Biology, CS, Calculus, History | Keyword matching |
| **Code Generation** | FizzBuzz, Linked List, Binary Search | Contains + structure |
| **Summarization** | Article summary, Bullet extraction | Length + composite |
| **Reasoning** | Logic puzzle, Word problem | Contains (exact match) |
| **Instruction Following** | JSON output, Numbered list | Format validation |

```bash
# Run benchmarks
curl -X POST localhost:4000/api/benchmarks/run

# Check progress
curl localhost:4000/api/benchmarks/status

# Get results
curl localhost:4000/api/benchmarks/results
```

---

## API Reference

### OpenAI-Compatible Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/chat/completions` | Chat completion (streaming supported) |
| `POST` | `/v1/embeddings` | Generate embeddings |
| `GET` | `/v1/models` | List available models |

### Gateway Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health status with provider details |
| `GET` | `/metrics` | Prometheus metrics |
| `GET` | `/api/providers` | Provider status and latency |
| `GET` | `/api/analytics` | Request analytics and cost breakdown |
| `GET` | `/api/cache/stats` | Cache hit/miss statistics |
| `POST` | `/api/cache/invalidate` | Clear semantic cache |
| `GET` | `/api/circuit-breakers` | Circuit breaker states |
| `GET` | `/api/budget` | Global budget usage |
| `GET` | `/api/benchmarks` | Available benchmark tasks |
| `POST` | `/api/benchmarks/run` | Start benchmark run |
| `GET` | `/api/benchmarks/status` | Benchmark progress |
| `GET` | `/api/benchmarks/results` | Latest benchmark results |

### Admin Endpoints (require `Authorization: Bearer <ADMIN_API_KEY>`)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/keys` | Create API key with budget |
| `GET` | `/api/admin/keys` | List all API keys |
| `DELETE` | `/api/admin/keys/:key` | Revoke API key |
| `GET` | `/api/admin/routing` | Get routing configuration |
| `PUT` | `/api/admin/routing` | Update routing strategy/weights |

### Response Headers

Every response includes gateway metadata:

| Header | Description |
|--------|-------------|
| `X-Request-ID` | Unique request identifier for tracing |
| `X-Response-Time` | Total response time in ms |
| `X-Powered-By` | `llm-gateway` |

### Response Body Metadata

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

### Request Extensions

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `x-routing-strategy` | `cost \| quality \| latency \| balanced` | `balanced` | Override routing |
| `x-prefer-provider` | `string` | — | Prefer a specific provider |
| `x-cache` | `boolean` | `true` | Enable/disable semantic cache |
| `x-budget-key` | `string` | — | API key for budget tracking |

---

## Project Structure

```
llm-gateway/
├── src/
│   ├── index.ts                 # Entry point, startup banner, graceful shutdown
│   ├── server.ts                # Hono app, routes, middleware, DI
│   ├── env.ts                   # Zod-validated environment config
│   ├── gateway/
│   │   ├── handler.ts           # Request pipeline: auth → cache → route → execute → log
│   │   ├── validator.ts         # OpenAI-compatible Zod schemas
│   │   └── errors.ts            # Structured error codes and types
│   ├── providers/
│   │   ├── interface.ts         # LLMProvider contract
│   │   ├── registry.ts          # Provider discovery + health monitoring
│   │   ├── ollama.ts            # Local GPU inference
│   │   ├── openai.ts            # OpenAI API
│   │   ├── anthropic.ts         # Anthropic Claude
│   │   ├── groq.ts              # Groq (ultra-fast)
│   │   └── together.ts          # Together AI
│   ├── router/
│   │   ├── router.ts            # Scoring engine with provider preference
│   │   ├── classifier.ts        # Prompt complexity classifier
│   │   ├── capabilities.ts      # Model profiles, aliases, latency percentiles
│   │   └── config.ts            # Strategy weight presets
│   ├── cache/
│   │   ├── semantic-cache.ts    # Redis cosine similarity cache
│   │   ├── embedding.ts         # Embedding service + fallback
│   │   └── cache-stats.ts       # Hit/miss tracking
│   ├── budget/
│   │   ├── budget.ts            # Token + cost enforcement with alerts
│   │   ├── api-keys.ts          # Per-key CRUD + budget management
│   │   └── rate-limiter.ts      # Redis sliding window limiter
│   ├── reliability/
│   │   ├── fallback.ts          # Provider failover with exponential backoff
│   │   ├── circuit-breaker.ts   # Per-provider state machine
│   │   └── timeout.ts           # Configurable per-provider timeouts
│   ├── observability/
│   │   ├── metrics.ts           # Prometheus counters + histograms
│   │   ├── logger.ts            # Structured logging + PostgreSQL sink
│   │   └── request-tracker.ts   # In-memory analytics + percentiles
│   ├── benchmark/
│   │   ├── tasks.ts             # 14 benchmark task definitions
│   │   ├── scorer.ts            # 4 scoring strategies
│   │   └── runner.ts            # Async executor with progress tracking
│   └── db/
│       ├── schema.ts            # Drizzle schema (3 tables)
│       └── migrate.ts           # Migration runner
├── tests/                       # 111 tests across 13 suites
├── scripts/
│   └── demo.sh                  # Interactive feature demo
├── docker-compose.yml           # Full stack (gateway + Redis + Postgres + Prometheus + Grafana)
├── Dockerfile                   # Multi-stage production build
└── package.json
```

---

## Testing

```bash
# Run all 111 tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Type checking
npm run lint
```

**Test suites:** Router, classifier, capabilities, circuit breakers, fallback chains, budget enforcement, rate limiting, semantic cache, request validation, benchmark tasks, scoring strategies, error codes, request tracking.

---

## Configuration

### Environment Variables

```bash
# Server
PORT=4000
NODE_ENV=development

# Provider API Keys (at least one recommended)
OLLAMA_URL=http://localhost:11434       # Always enabled
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GROQ_API_KEY=gsk_...
TOGETHER_API_KEY=...

# Infrastructure (optional — runs without)
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/gateway

# Routing
DEFAULT_ROUTING_STRATEGY=balanced       # cost | quality | latency | balanced

# Cache
CACHE_TTL_SECONDS=3600
CACHE_SIMILARITY_THRESHOLD=0.95
CACHE_MAX_ENTRIES=10000

# Budget
GLOBAL_MONTHLY_USD_BUDGET=100           # Optional global limit
GLOBAL_MONTHLY_TOKEN_BUDGET=10000000    # Optional global limit

# Admin
ADMIN_API_KEY=gw-admin-change-me
LOG_LEVEL=info
REDACT_PROMPTS=true
```

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Runtime** | TypeScript 5.7 (strict) | Type safety, no runtime surprises |
| **Framework** | Hono 4.6 | 3-4x faster than Express, zero deps |
| **Cache** | Redis 7 | Semantic cache + rate limiting |
| **Database** | PostgreSQL 16 + Drizzle | Type-safe ORM, audit logs |
| **Metrics** | Prometheus + Grafana | Industry-standard observability |
| **Validation** | Zod | Runtime schema validation |
| **Testing** | Vitest | Fast, ESM-native |
| **Deployment** | Docker Compose | One-command full stack |

---

## Design Decisions

**Why Hono over Express?** — 3-4x faster, built-in TypeScript, middleware composition, zero dependencies. For a gateway where every millisecond matters.

**Why semantic caching?** — Exact-match caching misses rephrased queries. Cosine similarity on embeddings catches "What's 2+2?" and "What is two plus two?" as equivalent, achieving 20-40% cache hit rates.

**Why a complexity classifier?** — A simple "Hello" shouldn't go to GPT-4. Pattern-based classification scores prompts for code, math, and creative content, routing simple queries to 3B local models and saving 60-80% on API costs.

**Why circuit breakers per provider?** — When one provider has an outage, requests fail fast instead of waiting 30s for timeouts. The breaker trips after configurable failures and checks back periodically.

**Why benchmarks in the gateway?** — Results reflect real latency through the actual infrastructure — model loading, network overhead, provider quirks — not synthetic numbers.

**Why exponential backoff on fallback?** — Hammering a recovering provider makes things worse. Progressive delays give providers time to recover while still being responsive.

---

## License

MIT
