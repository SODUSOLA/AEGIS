# AEGIS

> The Subscription Reliability Layer for Nomba-Powered Businesses

AEGIS is a managed, multi-tenant subscription infrastructure engine built directly on the Nomba API ecosystem. It sits between Nomba's payment primitives and subscription-based applications — handling the complete billing lifecycle so developers never have to rebuild it from scratch.

Built for the **Nomba x DevCareer Hackathon 2026 — Infrastructure Track**.

---

## The Problem

Nigerian businesses running recurring billing face a fractured stack. Failed charges go unrecovered. Webhook events arrive late or not at all. Engineers spend sprint cycles rebuilding subscription state logic for every new product. Finance teams reconcile manually. There is no standard, reusable billing layer on top of Nomba.

AEGIS is that layer.

---

## What AEGIS Does

- Manages the full subscription lifecycle across six states: `TRIALING` → `ACTIVE` → `PAST_DUE` → `SUSPENDED` → `CANCELLED` → `EXPIRED`
- Executes automated recurring charges via Nomba's tokenized card API on a cron-based schedule
- Recovers failed payments through a 3-step intelligent dunning engine with exponential backoff
- Ingests and deduplicates inbound Nomba webhooks, reconciling against the transaction log for missed events
- Delivers signed outbound webhook events to merchant-registered endpoints with retry-on-failure
- Calculates and executes prorated charges on mid-cycle plan changes in real time
- Serves multiple unrelated merchants on shared infrastructure with strict tenant isolation at the database level

---

## Tech Stack

### Frontend
- React 19 + TypeScript
- TanStack Router (file-based routing with SSR)
- Tailwind CSS v4
- shadcn/ui + Radix UI
- Framer Motion
- Lucide React

### Backend
- Node.js + Express + TypeScript
- PostgreSQL (primary state store via Prisma)
- Redis + BullMQ (job scheduling, dunning queues, webhook delivery)
- Docker + Render (deployment)

### Nomba Integrations
- Checkout API
- Tokenization API
- Charge API
- Transactions API
- Webhooks API

---

## Project Structure

```
AEGIS/
├── frontend/               # Merchant dashboard + landing page
│   ├── src/
│   │   ├── routes/         # TanStack file-based routes
│   │   ├── components/
│   │   │   ├── app/        # AppShell, Sidebar, StatusBadge
│   │   │   ├── auth/       # Auth layout
│   │   │   └── ui/         # shadcn/ui primitives
│   │   ├── hooks/
│   │   └── lib/            # Theme context, utilities
│   ├── bun.lock
│   └── vite.config.ts
│
└── backend/                # AEGIS API
    ├── prisma/
    │   └── schema.prisma
    └── src/
        ├── config/
        ├── db/
        ├── integrations/   # Nomba API clients
        ├── lib/            # Errors, logger, response helpers
        ├── middleware/     # Auth, validation, error handling
        ├── modules/        # Feature modules (plans, subscriptions, customers, webhooks, merchants)
        ├── queues/         # BullMQ job definitions
        ├── routes/         # Route registration
        ├── services/       # Business logic
        └── startup/        # App bootstrap
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh) v1.0+
- Node.js v22+
- PostgreSQL
- Redis

### Frontend

```bash
cd frontend
bun install
bun run dev
```

### Backend

```bash
cd backend
bun install
cp .env.example .env     # fill in your credentials
bun run dev
```

---

## API Reference

All endpoints are prefixed with `/api/v1`. Authentication is required via the `x-api-key` header on all routes except merchant registration.

```
# Merchants
POST   /api/v1/merchants/register
GET    /api/v1/merchants/me

# Plans
POST   /api/v1/plans
GET    /api/v1/plans
GET    /api/v1/plans/:id
PATCH  /api/v1/plans/:id
DELETE /api/v1/plans/:id

# Customers
POST   /api/v1/customers
GET    /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
PATCH  /api/v1/customers/:id/payment-method
DELETE /api/v1/customers/:id

# Subscriptions
POST   /api/v1/subscriptions
GET    /api/v1/subscriptions
GET    /api/v1/subscriptions/:id
POST   /api/v1/subscriptions/:id/cancel
POST   /api/v1/subscriptions/:id/change-plan

# Webhooks
POST   /api/v1/webhooks/nomba

# Health
GET    /health
```

### Authentication

```http
x-api-key: ak_live_...
```

Every merchant receives a scoped API key on registration. Keys follow the format `ak_live_*` for production and `ak_test_*` for sandbox.

---

## Subscription States

| State | Description | Trigger |
|---|---|---|
| `TRIALING` | Free or low-cost trial window | Initial setup with trial params |
| `ACTIVE` | Fully paid and in good standing | Successful payment |
| `PAST_DUE` | Payment failed, dunning in progress | Failed charge |
| `SUSPENDED` | Dunning exhausted, access paused | Max retries reached |
| `CANCELLED` | Explicitly terminated | Manual cancellation |
| `EXPIRED` | Reached natural end date | Fixed-term end |

---

## Dunning & Retry Logic

AEGIS runs a 3-step retry schedule on failed charges:

```
Attempt 1 → Immediate
Attempt 2 → +24 hours
Attempt 3 → +72 hours
```

Failures are classified by type — Insufficient Funds, Expired Card, Network Timeout — and the subscription transitions `ACTIVE → PAST_DUE → SUSPENDED` automatically. Recovery returns the subscription to `ACTIVE` and fires a `charge.recovered` webhook immediately.

---

## Outbound Webhook Events

All outbound payloads are signed with HMAC-SHA256 using a per-merchant secret.

| Event | Trigger |
|---|---|
| `subscription.activated` | Subscription moves to ACTIVE |
| `subscription.past_due` | Charge fails, dunning starts |
| `subscription.suspended` | Max retries reached |
| `subscription.canceled` | Subscription cancelled |
| `charge.succeeded` | Payment confirmed |
| `charge.failed` | Payment rejected |
| `charge.recovered` | Retry succeeds |
| `dunning.started` | First retry attempt triggered |
| `plan.changed` | Mid-cycle plan upgrade/downgrade |

---

## Proration Formula

When a customer changes plans mid-cycle, AEGIS calculates and charges the prorated difference immediately:

```
A_prorated = (A_new - A_old) × (D_remaining / D_total)
```

Where `D_remaining` is the fractional days left in the current billing period and `D_total` is the total days in the cycle.

---

## Environment Variables

```env
# Database
DATABASE_URL=

# Redis
REDIS_URL=

# Nomba
NOMBA_ACCOUNT_ID=
NOMBA_SUB_ACCOUNT_ID=
NOMBA_CLIENT_ID=
NOMBA_PRIVATE_KEY=
NOMBA_WEBHOOK_SECRET=

# App
PORT=3000
NODE_ENV=development
```

---

## Team

Built by **KR38S** for the Nomba x DevCareer Hackathon 2026.

---

## License

Built for the Nomba x DevCareer Hackathon 2026. Demonstration purposes.