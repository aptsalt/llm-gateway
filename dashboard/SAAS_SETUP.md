# RouterAI SaaS Dashboard Setup

This dashboard has been transformed into a full SaaS application with authentication, multi-tenancy, and billing.

## New Features

### Authentication
- Email/password signup and login
- GitHub OAuth integration
- Protected routes with automatic redirect
- Session management via Supabase

### Organization Management
- Multi-tenant architecture
- Organization creation during signup
- Member invitations and role management
- Organization settings and configuration

### API Key Management
- Create multiple API keys per organization
- Environment labels (production, staging, development)
- Key visibility toggle and clipboard copy
- Revoke keys with confirmation

### Usage Analytics
- Token usage by provider (stacked area chart)
- Cost breakdown with percentages
- Model usage distribution
- Cache performance metrics
- Date range filtering

### Billing
- Plan comparison (Free, Pro, Enterprise)
- Usage tracking against limits
- Stripe integration (payment methods, portal)
- Billing history

### Dashboard Pages
- `/dashboard` - Overview with key metrics
- `/dashboard/keys` - API key management
- `/dashboard/usage` - Usage analytics
- `/dashboard/routing` - Routing configuration
- `/dashboard/providers` - Provider management
- `/dashboard/cache` - Cache statistics
- `/dashboard/logs` - Request logs
- `/dashboard/billing` - Billing and plans
- `/dashboard/settings` - Organization settings

## Setup Instructions

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Set Up Supabase

1. Create a Supabase project at https://supabase.com
2. Create the following tables:

**organizations**
```sql
create table organizations (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  slug text unique not null,
  owner_id uuid references auth.users not null,
  created_at timestamptz default now()
);
```

**api_keys**
```sql
create table api_keys (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  key text unique not null,
  organization_slug text references organizations(slug) on delete cascade,
  environment text check (environment in ('production', 'staging', 'development')),
  created_at timestamptz default now(),
  last_used_at timestamptz
);
```

**organization_members**
```sql
create table organization_members (
  id uuid default gen_random_uuid() primary key,
  organization_slug text references organizations(slug) on delete cascade,
  user_id uuid references auth.users on delete cascade,
  role text check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  unique(organization_slug, user_id)
);
```

3. Enable GitHub OAuth in Supabase Auth settings

### 3. Configure Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Update with your values:

```env
NEXT_PUBLIC_GATEWAY_URL=http://localhost:4000
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run the Dashboard

```bash
npm run dev
```

Visit http://localhost:3000

## Architecture

### Route Structure

```
app/
├── (auth)/              # Auth pages (no sidebar)
│   ├── login/
│   └── signup/
├── (dashboard)/         # Dashboard pages (with sidebar)
│   └── dashboard/
│       ├── page.tsx     # Overview
│       ├── keys/
│       ├── usage/
│       ├── routing/
│       ├── providers/
│       ├── cache/
│       ├── logs/
│       ├── billing/
│       └── settings/
└── page.tsx            # Root redirect
```

### Auth Flow

1. User visits `/`
2. Check if authenticated via Supabase
3. If yes: redirect to `/dashboard`
4. If no: redirect to `/login`

### Data Flow

- Auth state managed by Supabase Auth
- Organization context stored in Supabase tables
- Gateway API calls use NEXT_PUBLIC_GATEWAY_URL
- API keys sent via Authorization header

## UI Components

All UI components are built with Tailwind CSS in dark theme:

- Button, Input, Badge, Select, Slider, Tabs
- Dialog (modal)
- Table
- Card (from existing dashboard)

## Mock Data

Currently using mock data for:
- API keys
- Usage analytics
- Logs
- Billing history

Replace with real API calls once backend endpoints are ready.

## Next Steps

1. Connect Supabase tables to dashboard
2. Implement backend API endpoints for:
   - Organization CRUD
   - API key generation/validation
   - Usage tracking
   - Billing webhooks (Stripe)
3. Add row-level security (RLS) policies in Supabase
4. Set up Stripe for billing
5. Add email notifications (Supabase Functions)
6. Implement team collaboration features

## Development Notes

- Using Next.js 14 App Router
- Client components use "use client" directive
- Dark theme enforced (bg-zinc-950, text-zinc-100)
- Icons from lucide-react
- Charts from Recharts
- Toasts from sonner

## Deployment

The dashboard can be deployed to Vercel:

```bash
vercel --prod
```

Make sure to set environment variables in Vercel project settings.
