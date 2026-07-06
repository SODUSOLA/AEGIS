# AEGIS Backend

Subscription infrastructure engine for Nomba — recurring billing with automated payment orchestration via the Nomba API.

## Architecture

```bash
src/
├── config/         Environment & constants
├── db/             Prisma & Redis clients
├── integrations/   Nomba auth, client, webhooks
├── lib/            Billing utils, proration, pagination
├── middleware/      Auth, validation, error handling
├── modules/        Route handlers (merchant, plan, customer, subscription)
├── queues/         BullMQ definitions, registry, workers
├── services/       Charge execution & failure classification
├── startup/        Worker lifecycle
└── index.ts        Entry point
```

## Prerequisites

- Node.js 20+
- Docker (PostgreSQL + Redis)
- Nomba sandbox account

## Setup

```bash
cp .env.example .env     # fill in your values
npm install
docker compose up -d      # starts postgres + redis
npx prisma migrate dev    # run migrations
npm run dev               # starts with tsx watch
```

## Key flows

- **Scheduler** runs every 60s, enqueues due renewals to BullMQ
- **Renewal worker** charges via Nomba tokenized-card-payment, advances periods on success
- **Proration worker** handles mid-cycle plan change charges
- **Failure classifier** maps Nomba response codes to `FailureReason` enums
- **Dunning** retries 1h → 24h → 72h on retriable failures, then suspends

## Test
See [runbook](./runbook.md) for the full Phase 1–3 acceptance test suite.

## DB Architecture design

See [Database Architecture design board here...](https://miro.com/app/board/uXjVHON9WGI=/?moveToWidget=3458764676929668528&cot=10)

