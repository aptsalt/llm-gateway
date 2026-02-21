# RouterAI — LLM Gateway SaaS Pivot

> **Status:** Active Development
> **Version:** 0.1.0 (SaaS conversion from v1.1.0 single-tenant gateway)
> **Last Updated:** 2026-02-21

---

## 1. The Pivot

### From → To

```
BEFORE: Open-source LLM gateway          AFTER: Multi-tenant LLM Gateway SaaS
┌─────────────────────────────┐          ┌─────────────────────────────────┐
│  Single admin key            │          │  Organizations + team members    │
│  One set of provider keys    │   ──►    │  Per-tenant provider keys (BYOK) │
│  Global budget               │          │  Per-tenant budgets + billing    │
│  Shared cache                │          │  Isolated cache namespaces       │
│  Mixed logs                  │          │  Scoped analytics per org        │
│  Self-hosted only            │          │  Managed cloud + self-host       │
└─────────────────────────────┘          └─────────────────────────────────┘
```

### Why This Works

1. **Proven core** — 111 tests passing, 5 providers, smart routing, semantic cache
2. **One-line integration** — change `base_url` and you're done (OpenAI-compatible)
3. **Compounding moat** — cache hit rates improve over time → higher retention
4. **High switching cost** — once integrated, leaving means losing cache + analytics history
5. **Clear upsell** — Gateway → RAG → Agents → Full AI platform

---

## 2. Architecture

### Request Flow (Multi-Tenant)

```
                            ┌─────────────────┐
                            │   Client App     │
                            │  (any OpenAI SDK)│
                            └────────┬────────┘
                                     │
                          Authorization: Bearer gw_acme_xxxx
                                     │
                            ┌────────▼────────┐
                            │   Edge Layer     │
                            │   (Fly.io)       │
                            │  TLS + GeoRoute  │
                            └────────┬────────┘
                                     │
                   ┌─────────────────▼─────────────────┐
                   │       API Gateway (Hono 4.6)       │
                   │                                     │
                   │  ┌──────────────────────────────┐  │
                   │  │ 1. Tenant Resolution          │  │
                   │  │    API Key → org_id lookup     │  │
                   │  └──────────────┬───────────────┘  │
                   │                 │                    │
                   │  ┌──────────────▼───────────────┐  │
                   │  │ 2. Rate Limit Check           │  │
                   │  │    Per-tenant RPM/TPM          │  │
                   │  └──────────────┬───────────────┘  │
                   │                 │                    │
                   │  ┌──────────────▼───────────────┐  │
                   │  │ 3. Budget Check               │  │
                   │  │    Per-tenant token/USD limit  │  │
                   │  └──────────────┬───────────────┘  │
                   │                 │                    │
                   │  ┌──────────────▼───────────────┐  │
                   │  │ 4. Semantic Cache             │  │
                   │  │    Namespaced: gw:{org}:{hash}│  │
                   │  │    Hit? → return cached        │  │
                   │  └──────────────┬───────────────┘  │
                   │                 │ miss               │
                   │  ┌──────────────▼───────────────┐  │
                   │  │ 5. Smart Router               │  │
                   │  │    Tenant strategy + weights   │  │
                   │  │    Classify → Score → Select   │  │
                   │  └──────────────┬───────────────┘  │
                   │                 │                    │
                   │  ┌──────────────▼───────────────┐  │
                   │  │ 6. Provider Execution         │  │
                   │  │    Tenant keys → fallback      │  │
                   │  │    Circuit breaker per provider│  │
                   │  └──────────────┬───────────────┘  │
                   │                 │                    │
                   │  ┌──────────────▼───────────────┐  │
                   │  │ 7. Log + Bill + Cache Store   │  │
                   │  │    Async (non-blocking)        │  │
                   │  │    Stripe meter → usage record │  │
                   │  └──────────────────────────────┘  │
                   └─────────────────┬─────────────────┘
                                     │
               ┌─────────────────────┼─────────────────────┐
               │                     │                       │
      ┌────────▼──────┐    ┌────────▼──────┐    ┌──────────▼────────┐
      │   Supabase     │    │   Upstash     │    │   LLM Providers   │
      │   PostgreSQL   │    │   Redis       │    │                    │
      │   + Auth       │    │   (Global)    │    │  Ollama (local)    │
      │                │    │               │    │  Groq (fast)       │
      │  - orgs        │    │  - cache      │    │  Together (cheap)  │
      │  - members     │    │  - rate limit │    │  OpenAI (quality)  │
      │  - api_keys    │    │  - sessions   │    │  Anthropic (qual.) │
      │  - logs        │    │               │    │                    │
      │  - usage_daily │    │               │    │                    │
      └───────────────┘    └───────────────┘    └────────────────────┘
```

### Data Isolation Model

```
Tenant A (acme)                    Tenant B (startup-co)
┌───────────────────────┐          ┌───────────────────────┐
│ API Keys              │          │ API Keys              │
│  gw_acme_prod_xxx     │          │  gw_startup_prod_yyy  │
│  gw_acme_dev_zzz      │          │  gw_startup_dev_www   │
├───────────────────────┤          ├───────────────────────┤
│ Cache Namespace       │          │ Cache Namespace       │
│  gw:cache:acme-id:*   │          │  gw:cache:startup-id:*│
├───────────────────────┤          ├───────────────────────┤
│ Rate Limits           │          │ Rate Limits           │
│  Growth: 600 RPM      │          │  Starter: 120 RPM     │
├───────────────────────┤          ├───────────────────────┤
│ Budget                │          │ Budget                │
│  10M tokens/mo        │          │  1M tokens/mo         │
│  $200 USD/mo cap      │          │  $50 USD/mo cap       │
├───────────────────────┤          ├───────────────────────┤
│ Provider Keys         │          │ Provider Keys         │
│  OpenAI: sk-acme-xxx  │          │  Groq: gsk-startup-yy │
│  Groq: gsk-acme-yyy   │          │  (platform fallback)  │
├───────────────────────┤          ├───────────────────────┤
│ Routing Config        │          │ Routing Config        │
│  Strategy: balanced   │          │  Strategy: cost       │
│  Weights: 40/35/25    │          │  Weights: 80/10/10    │
├───────────────────────┤          ├───────────────────────┤
│ Logs & Analytics      │          │ Logs & Analytics      │
│  Only acme requests   │          │  Only startup requests│
└───────────────────────┘          └───────────────────────┘
         ▲ RLS enforced                     ▲ RLS enforced
```

### Dashboard Architecture

```
┌──────────────────────────────────────────────────────┐
│                  Next.js App (Vercel)                  │
│                                                        │
│  ┌─────────────┐  ┌────────────────────────────────┐  │
│  │  Marketing   │  │        Dashboard (Auth)         │  │
│  │  /           │  │                                  │  │
│  │  /pricing    │  │  /dashboard          Overview    │  │
│  │  /docs       │  │  /dashboard/keys     API Keys   │  │
│  │  /blog       │  │  /dashboard/usage    Analytics   │  │
│  └──────┬──────┘  │  /dashboard/routing  Config      │  │
│         │          │  /dashboard/providers Health     │  │
│         │          │  /dashboard/cache    Cache Stats │  │
│         │          │  /dashboard/billing  Stripe      │  │
│         │          │  /dashboard/settings Org Config  │  │
│         │          │  /dashboard/logs     Req Logs    │  │
│         │          └──────────┬─────────────────────┘  │
│         │                     │                         │
│  ┌──────▼─────────────────────▼────────────────────┐   │
│  │          Supabase Client (Auth + Data)            │   │
│  │  - Auth: signUp, signIn, OAuth, JWT              │   │
│  │  - DB: RLS-scoped queries (org_id automatic)     │   │
│  │  - Realtime: live usage updates (stretch)        │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Pricing & Revenue Model

```
┌────────────────────────────────────────────────────────────────────────┐
│                         RouterAI Pricing Tiers                          │
├──────────┬─────────┬───────────┬──────────────────────────────────────┤
│  Tier    │  Price  │  Tokens   │  Features                            │
├──────────┼─────────┼───────────┼──────────────────────────────────────┤
│  Free    │  $0/mo  │  100K/mo  │  2 providers, basic routing          │
│          │         │           │  Community support                    │
├──────────┼─────────┼───────────┼──────────────────────────────────────┤
│  Starter │  $29/mo │  1M/mo    │  All providers, basic caching        │
│          │         │           │  Email support, 120 RPM              │
├──────────┼─────────┼───────────┼──────────────────────────────────────┤
│  Growth  │  $99/mo │  10M/mo   │  Semantic cache, budget alerts       │
│          │         │           │  Full analytics, 600 RPM             │
├──────────┼─────────┼───────────┼──────────────────────────────────────┤
│  Scale   │  $299/mo│  100M/mo  │  Custom routing, SLA                 │
│          │         │           │  Priority support, 2400 RPM          │
├──────────┼─────────┼───────────┼──────────────────────────────────────┤
│Enterprise│ $999/mo │ Unlimited │  On-prem option, SSO, dedicated      │
│          │         │           │  support, custom SLA                  │
└──────────┴─────────┴───────────┴──────────────────────────────────────┘

Revenue projection (Month 6 target):
  200 Free    ×   $0  =      $0  (funnel)
   50 Starter ×  $29  =  $1,450
   20 Growth  ×  $99  =  $1,980
    5 Scale   × $299  =  $1,495
    0 Enterprise       =      $0
                         ────────
                MRR:     $4,925
```

---

## 4. Competitive Landscape

```
                    Self-Hostable
                         ▲
                         │
              LiteLLM ●  │  ● RouterAI
              (OSS)      │  (OSS core + managed)
                         │
   Basic ────────────────┼────────────────── Advanced
   Features              │                   Features
                         │
             Helicone ●  │  ● Portkey
             (logging)   │  (enterprise)
                         │
                         ▼
                    Managed Only

RouterAI positioning: Top-right quadrant
  - Self-hostable AND managed
  - Advanced features (semantic cache, local GPU, benchmarks)
  - Lower price than Portkey ($29 vs $49 entry)
```

### Feature Comparison

```
                     RouterAI   Portkey   LiteLLM   Helicone
                     ────────   ───────   ───────   ────────
Semantic Cache         ✓          ~         ✗         ✗
Local GPU (Ollama)     ✓          ✗         ✓         ✗
Self-Hostable          ✓          ✗         ✓         ~
Built-in Benchmarks    ✓          ✗         ✗         ✗
Per-Request Cost       ✓          ~         ✗         ~
Circuit Breakers       ✓          ~         ~         ✗
Usage-Based Billing    ✓         N/A       N/A       N/A
OpenAI Drop-In         ✓          ✓         ✓         ✓
Price (entry)         $29        $49       Free      $20
```

---

## 5. Database Schema (Multi-Tenant Extension)

### New Tables

```
organizations                          org_members
┌────────────────────────────┐        ┌────────────────────────┐
│ id          UUID (PK)      │        │ id       UUID (PK)     │
│ name        TEXT            │◄───┐   │ org_id   UUID (FK) ────┤──►
│ slug        TEXT (UNIQUE)   │    │   │ user_id  UUID (FK auth)│
│ owner_id    UUID (FK auth) │    │   │ role     TEXT           │
│ stripe_customer_id    TEXT  │    │   │ created_at TIMESTAMPTZ │
│ stripe_subscription_id TEXT│    │   └────────────────────────┘
│ plan        TEXT            │    │
│ monthly_token_budget  BIGINT│    │   usage_daily
│ monthly_cost_budget   NUMERIC│   │   ┌────────────────────────┐
│ tokens_used_this_month BIGINT│   │   │ id       UUID (PK)     │
│ cost_used_this_month  NUMERIC│   ├──►│ org_id   UUID (FK) ────┤
│ budget_reset_at    TIMESTAMPTZ│  │   │ date     DATE          │
│ default_routing_strategy TEXT│   │   │ total_requests INT     │
│ routing_weights     JSONB   │    │   │ total_tokens   BIGINT  │
│ prefer_local       BOOLEAN  │    │   │ total_cost_usd NUMERIC │
│ provider_keys      JSONB    │    │   │ cache_hits     INT     │
│ created_at       TIMESTAMPTZ│    │   │ cache_misses   INT     │
│ updated_at       TIMESTAMPTZ│    │   │ provider_breakdown JSONB│
└────────────────────────────┘    │   │ model_breakdown    JSONB│
                                   │   │ UNIQUE(org_id, date)   │
                                   │   └────────────────────────┘
                                   │
Existing tables: add org_id FK     │
                                   │
api_keys ──────────────────────────┤
  + org_id       UUID (FK) ────────┤
  + environment  TEXT               │
  + last_used_at TIMESTAMPTZ       │
                                   │
request_logs ──────────────────────┤
  + org_id       UUID (FK) ────────┤
  + INDEX(org_id, created_at)      │
                                   │
budget_alerts ─────────────────────┘
  + org_id       UUID (FK) ────────
```

### RLS Policy Model

```
Every query automatically filtered:

  SELECT * FROM request_logs
  WHERE org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )

Result: Tenant A NEVER sees Tenant B's data.
        No application-level filtering needed.
        Database enforces isolation.
```

---

## 6. Implementation Phases

### Phase 1: Multi-Tenant Core

```
Priority: CRITICAL (foundation for everything)

Changes:
  src/db/schema.ts          Add organizations, org_members, usage_daily tables
                            Add org_id to api_keys, request_logs, budget_alerts

  src/middleware/tenant.ts   NEW — resolve API key → org context
                            Set tenant context on every request

  src/cache/semantic-cache.ts  Namespace keys: gw:cache:{org_id}:{hash}

  src/budget/budget.ts       Scope enforcement to tenant limits
  src/budget/rate-limiter.ts Scope rate limits per org+key
  src/budget/api-keys.ts     Filter by org_id

  src/gateway/handler.ts     Read tenant context from middleware
                            Pass to cache, router, logger

  src/observability/logger.ts  Include org_id in all log entries

  src/server.ts              Wire tenant middleware into pipeline

  tests/*                    Update all 111 tests with tenant context

Validation:
  [ ] API key → org resolution works
  [ ] Cache isolated per tenant
  [ ] Rate limits scoped per tenant
  [ ] Budget enforcement per tenant
  [ ] All 111 existing tests pass
  [ ] New tenant isolation tests pass
```

### Phase 2: Dashboard MVP

```
Priority: HIGH (customer-facing product)

Pages:
  /                     Landing page — hero, features, pricing, CTA
  /login                Supabase Auth (email + GitHub OAuth)
  /signup               Create account → create org → first API key
  /dashboard            Overview — usage chart, cost savings, metrics
  /dashboard/keys       API key CRUD (create, list, revoke, rotate)
  /dashboard/usage      Detailed analytics (by provider, model, day)
  /dashboard/routing    Strategy selector, weight sliders
  /dashboard/providers  Provider health, add API keys
  /dashboard/cache      Hit rates, savings, clear cache
  /dashboard/billing    Plan details, upgrade, Stripe Portal
  /dashboard/settings   Org name, members, preferences
  /dashboard/logs       Paginated request logs with filters

Tech:
  Next.js 14 App Router + Supabase Auth + Tailwind + shadcn/ui + Recharts

API Routes (Next.js):
  /api/auth/*           Supabase auth callbacks
  /api/org              Org CRUD
  /api/keys             API key management
  /api/usage/*          Analytics queries
  /api/routing          Routing config
  /api/providers        Provider config
  /api/cache/*          Cache management
  /api/billing/*        Stripe integration
  /api/logs             Request log queries
```

### Phase 3: Billing

```
Priority: CRITICAL (no revenue without this)

Stripe Integration:
  Products:  5 tiers (Free, Starter, Growth, Scale, Enterprise)
  Meters:    llm_tokens_used (usage-based billing)
  Checkout:  Upgrade flow → Stripe Checkout → webhook → update plan
  Portal:    Self-service billing management
  Webhooks:  checkout.session.completed
             customer.subscription.deleted
             invoice.payment_failed

Flow:
  User signs up (Free) → Uses gateway → Hits limit → Upgrade CTA
       │                                                    │
       ▼                                                    ▼
  Stripe Checkout ──► Webhook ──► Update org.plan ──► Higher limits
       │
       ▼
  Monthly: Stripe Meter records tokens → Invoice → Charge
```

### Phase 4: Polish + Launch (PLANNED — PRP READY)

```
Priority: MEDIUM (execute after Phase 3 validated)

Status: PRP will be generated separately

Items:
  - Landing page optimization (conversion-focused)
  - Interactive API documentation (Stripe-style)
  - Cost savings calculator widget
  - Fly.io edge deployment (multi-region)
  - Upstash Redis (serverless global)
  - Supabase production project
  - Product Hunt launch prep
  - Hacker News Show HN post
  - AI Twitter thread campaign
  - SEO: "save money on LLM API costs"
  - Blog: "How we cut our LLM costs by 60%"
```

---

## 7. Tech Stack (SaaS)

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│  Next.js 14  ·  React 18  ·  Tailwind  ·  shadcn/ui    │
│  Recharts    ·  Supabase Auth (client)                   │
├─────────────────────────────────────────────────────────┤
│                     GATEWAY API                          │
│  Hono 4.6  ·  Node.js 20  ·  TypeScript 5.7 strict     │
│  Zod validation  ·  Drizzle ORM  ·  prom-client         │
├─────────────────────────────────────────────────────────┤
│                     DATA LAYER                           │
│  Supabase PostgreSQL  ·  Drizzle ORM  ·  RLS policies   │
│  Upstash Redis (cache + rate limit)                      │
├─────────────────────────────────────────────────────────┤
│                     BILLING                              │
│  Stripe Checkout  ·  Stripe Meters API  ·  Webhooks     │
│  Customer Portal                                         │
├─────────────────────────────────────────────────────────┤
│                     INFRASTRUCTURE                       │
│  Fly.io (gateway edge)  ·  Vercel (dashboard)           │
│  Prometheus + Grafana  ·  GitHub Actions CI/CD           │
└─────────────────────────────────────────────────────────┘
```

---

## 8. Key Metrics to Track

```
Business Metrics              Technical Metrics
─────────────────             ──────────────────
MRR                           P99 latency (< 300ms)
Free → Paid conversion %      Gateway overhead (< 100ms)
Monthly churn rate             Cache hit rate (target 50%+)
Avg revenue per user           Uptime (99.9% SLA)
Token volume growth            Error rate (< 0.1%)
Cost savings delivered         Provider failover time

North Star Metric: Total $ saved for customers
(directly ties usage to perceived value)
```

---

## 9. Risk Mitigation

```
Risk                          Mitigation
────                          ──────────
Platform key cost blowup      Rate limit platform fallback keys
                              Only for Growth+ plans
                              Monitor per-tenant platform key usage

Cache cold start              Show "cache warming" progress
                              Pre-populate with common patterns
                              Set expectations in onboarding

Latency overhead              Edge deployment (Fly.io)
                              Redis cache for tenant resolution
                              Async logging (never block hot path)

Tenant data leakage           RLS at database level
                              Cache namespace prefix enforcement
                              Integration tests for isolation

Stripe billing mismatch       Reconciliation job daily
                              Usage snapshots in our DB
                              Alert on >10% discrepancy
```

---

## 10. Files Changed / Created

### Phase 1 (Multi-Tenant Core)

```
Modified:
  src/db/schema.ts                 +3 tables, +columns on existing
  src/server.ts                    Wire tenant middleware
  src/gateway/handler.ts           Accept tenant context
  src/cache/semantic-cache.ts      Namespace by org_id
  src/budget/budget.ts             Per-tenant enforcement
  src/budget/rate-limiter.ts       Per-tenant limits
  src/budget/api-keys.ts           org_id scoping
  src/observability/logger.ts      org_id in logs
  src/env.ts                       New env vars (Supabase)
  tests/*                          Tenant context in all tests

Created:
  src/middleware/tenant.ts          Tenant resolution middleware
  src/providers/tenant-registry.ts Per-tenant provider setup
  src/db/migrate-saas.ts           Migration script for new tables
```

### Phase 2 (Dashboard)

```
Created:
  dashboard/src/app/layout.tsx             Auth-aware layout
  dashboard/src/app/page.tsx               Landing page
  dashboard/src/app/login/page.tsx         Auth page
  dashboard/src/app/signup/page.tsx        Onboarding flow
  dashboard/src/app/dashboard/page.tsx     Overview
  dashboard/src/app/dashboard/keys/       API key management
  dashboard/src/app/dashboard/usage/      Analytics
  dashboard/src/app/dashboard/routing/    Config
  dashboard/src/app/dashboard/providers/  Provider health
  dashboard/src/app/dashboard/cache/      Cache stats
  dashboard/src/app/dashboard/billing/    Stripe integration
  dashboard/src/app/dashboard/settings/   Org settings
  dashboard/src/app/dashboard/logs/       Request logs
  dashboard/src/lib/supabase.ts           Supabase client
  dashboard/src/lib/api.ts                Gateway API client (updated)
  dashboard/src/components/               Shared UI components
```

### Phase 3 (Billing)

```
Created:
  src/billing/stripe.ts            Stripe SDK setup
  src/billing/meters.ts            Usage metering
  src/billing/webhooks.ts          Webhook handlers
  src/billing/plans.ts             Plan definitions + limits
  dashboard/src/app/api/billing/   Checkout, portal, webhooks
```

---

*This document is the source of truth for the RouterAI SaaS pivot. All implementation PRPs reference this.*
