# AEGIS Backend — Acceptance Test Runbook (Phase 1–5)

## Prerequisites

Ensure the following are in place before running any tests:

- **Docker containers** running PostgreSQL and Redis
- **npm dependencies** installed (`npm install`)
- **Database migrated** (`npm run db:migrate`)
- **`.env` configured** with valid sandbox Nomba credentials (see `.env.example`)
- **SMTP credentials** configured in `.env` for email delivery tests
- **Server running** (`npm run dev` or `npm run build && npm start`)
- **`jq` installed** for JSON parsing (`brew install jq`)

### Quick-start commands

```bash
# Start infra
docker compose up -d postgres redis

# Install and migrate
npm install
npm run db:generate
npm run db:migrate

# Copy and edit .env (fill in Nomba sandbox credentials + SMTP)
cp .env.example .env

# Start dev server
npm run dev
```

### Expected startup logs

When the server starts successfully, you should see these log lines (order may vary slightly):

1. `Database connection established`
2. `Starting AEGIS background workers...`
3. `Billing scheduler worker started`
4. `Renewal worker started`
5. `Proration worker started`
6. `Dunning worker started`
7. `Webhook delivery worker started`
8. `Uptime pinger started`
9. `All background workers started successfully`
10. `AEGIS is running`

Additional logs you may see:
- `Billing cron job registered` (scheduler interval registration)
- `BullMQ Redis connection established`
- `Background workers started`

---

## Part 0 — Infrastructure & Startup

### 0.1 — Health check (unauthenticated)

The `/health` endpoint does **not** require an API key. It verifies the database connection.

```bash
curl -s http://localhost:3000/health | jq .
```

**Expected (200):**
```json
{
  "success": true,
  "message": "AEGIS is healthy",
  "data": {
    "status": "ok",
    "database": "connected",
    "timestamp": "...",
    "version": "1.0.0"
  }
}
```

### 0.2 — Verify Docker processes

```bash
docker ps --format "table {{.Names}}\t{{.Status}}"
```

**Expected:** `postgres` and `redis` containers both showing `Up` status.

### 0.3 — TypeScript typecheck

```bash
npx tsc --noEmit
```

**Expected:** exits with code 0, no output (or only compiler messages about `tsx`-related things — no type errors).

### 0.4 — Health check fails when DB is down

Stop the postgres container temporarily to verify the degraded response:

```bash
docker stop aegis-postgres  # or whatever your postgres container is called
sleep 2
curl -s http://localhost:3000/health | jq .
docker start aegis-postgres
```

**Expected (503):**
```json
{
  "success": false,
  "message": "Service unavailable",
  "data": {
    "status": "degraded",
    "database": "disconnected"
  }
}
```

---

## Part 1 — Merchant Auth

### 1.1 — Register a merchant

Store the returned API key — it will **only be shown once**.

```bash
REGISTER_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Acme Corp",
    "email": "admin@acme.com"
  }')

echo "$REGISTER_RESULT" | jq .

# Extract the raw API key — this is the only time you'll see it
API_KEY=$(echo "$REGISTER_RESULT" | jq -r '.data.apiKey')
echo "API_KEY=$API_KEY"

# Also extract merchant ID
MERCHANT_ID=$(echo "$REGISTER_RESULT" | jq -r '.data.merchant.id')
echo "MERCHANT_ID=$MERCHANT_ID"
```

**Expected (201):** Response includes `data.merchant` (id, businessName, email, apiKeyPreview, webhookSecret, status, createdAt) and `data.apiKey` (a string like `ak_live_<64 hex chars>`).

> **Note:** Replace `{API_KEY}` and `{MERCHANT_ID}` in subsequent commands with the values from this step.

### 1.2 — Health check **without** API key → 401

(While the `/health` endpoint itself is public, this simulates a protected route call without a key.)

```bash
curl -s http://localhost:3000/api/v1/merchants/me | jq .
```

**Expected (401):**
```json
{
  "success": false,
  "message": "Missing or invalid X-API-Key header"
}
```

### 1.3 — Health check **with** valid API key → 200

Actually, the *real* health check is unauthenticated. Test auth by fetching the merchant profile:

```bash
curl -s http://localhost:3000/api/v1/merchants/me \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):**
```json
{
  "success": true,
  "message": "Merchant profile retrieved",
  "data": {
    "id": "MERCHANT_ID",
    "businessName": "Acme Corp",
    "email": "admin@acme.com",
    "apiKeyPreview": "ak_live_...abcd",
    "status": "ACTIVE",
    ...
  }
}
```

### 1.4 — Register a second merchant (for multi-tenant testing)

```bash
curl -s -X POST http://localhost:3000/api/v1/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Beta Inc",
    "email": "admin@beta.com"
  }' | jq .
```

Store the second API key as `API_KEY_2` for isolation tests.

---

## Part 2 — Plans, Customers, Subscriptions

All commands in this section require the `X-API-Key` header. Ensure `$API_KEY` is set from Part 1.

```bash
# Verify it is set
echo "Using API_KEY=$API_KEY"
```

### 2.1 — Create a plan (MONTHLY)

```bash
PLAN_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/plans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Pro Monthly",
    "description": "Pro plan with all features",
    "amountKobo": 100000,
    "currency": "NGN",
    "interval": "MONTHLY"
  }')

echo "$PLAN_RESULT" | jq .
PLAN_ID=$(echo "$PLAN_RESULT" | jq -r '.data.id')
echo "PLAN_ID=$PLAN_ID"
```

**Expected (201):** Plan object with id, name, amountKobo, interval, etc.

### 2.2 — Create a second plan (WEEKLY — for proration testing)

```bash
PLAN2_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/plans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Starter Weekly",
    "description": "Weekly starter plan",
    "amountKobo": 20000,
    "currency": "NGN",
    "interval": "WEEKLY"
  }')

echo "$PLAN2_RESULT" | jq .
PLAN2_ID=$(echo "$PLAN2_RESULT" | jq -r '.data.id')
echo "PLAN2_ID=$PLAN2_ID"
```

### 2.3 — Create a CUSTOM interval plan (for rapid renewal testing)

```bash
PLAN3_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/plans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Test Daily",
    "description": "1-day interval for testing renewal",
    "amountKobo": 5000,
    "currency": "NGN",
    "interval": "CUSTOM",
    "intervalDays": 1
  }')

echo "$PLAN3_RESULT" | jq .
PLAN3_ID=$(echo "$PLAN3_RESULT" | jq -r '.data.id')
echo "PLAN3_ID=$PLAN3_ID"
```

### 2.4 — List plans (with pagination)

```bash
curl -s "http://localhost:3000/api/v1/plans?page=1&limit=10" \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** `data.plans` array with pagination `meta`.

Filter by active only:
```bash
curl -s "http://localhost:3000/api/v1/plans?isActive=true&page=1&limit=10" \
  -H "X-API-Key: $API_KEY" | jq .
```

### 2.5 — Get plan by ID

```bash
curl -s http://localhost:3000/api/v1/plans/$PLAN_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** Plan with `_count.subscriptions` showing active subscription count.

### 2.6 — Update plan

```bash
curl -s -X PATCH http://localhost:3000/api/v1/plans/$PLAN_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "description": "Updated Pro plan with more features",
    "isActive": true
  }' | jq .
```

**Expected (200):** Updated plan object.

### 2.7 — Create a customer (with Nomba token)

In sandbox, you can use the dummy Nomba token key format:
- For a **successful charge**: `tok_test_ok`
- For an **expired card**: `tok_test_expired`
- For **insufficient funds**: `tok_test_insufficient`

```bash
CUSTOMER_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "john@example.com",
    "name": "John Doe",
    "nombaTokenKey": "tok_test_ok",
    "metadata": {
      "source": "runbook-test",
      "referrer": "direct"
    }
  }')

echo "$CUSTOMER_RESULT" | jq .
CUSTOMER_ID=$(echo "$CUSTOMER_RESULT" | jq -r '.data.id')
echo "CUSTOMER_ID=$CUSTOMER_ID"
```

**Expected (201):** Customer object with `hasPaymentMethod: true`.

### 2.8 — Create a second customer (no payment method — for error testing)

```bash
CUSTOMER2_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "jane@example.com",
    "name": "Jane Doe"
  }')

echo "$CUSTOMER2_RESULT" | jq .
CUSTOMER2_ID=$(echo "$CUSTOMER2_RESULT" | jq -r '.data.id')
echo "CUSTOMER2_ID=$CUSTOMER2_ID"
```

**Expected:** `hasPaymentMethod: false`.

### 2.9 — List customers

```bash
curl -s "http://localhost:3000/api/v1/customers?page=1&limit=10" \
  -H "X-API-Key: $API_KEY" | jq .
```

Filter by customers with a payment method:
```bash
curl -s "http://localhost:3000/api/v1/customers?hasToken=true&page=1&limit=10" \
  -H "X-API-Key: $API_KEY" | jq .
```

### 2.10 — Create a subscription (no trial — ACTIVE immediately)

> **Note:** Replace `{CUSTOMER_ID}` and `{PLAN3_ID}` with actual values from above.

```bash
SUB_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_ID"'",
    "planId": "'"$PLAN3_ID"'",
    "trialDays": 0
  }')

echo "$SUB_RESULT" | jq .
SUB_ID=$(echo "$SUB_RESULT" | jq -r '.data.id')
echo "SUB_ID=$SUB_ID"
```

**Expected (201):** Subscription with `status: "ACTIVE"`, `currentPeriodStart`, `currentPeriodEnd` (= ~1 day later on CUSTOM/1-day plan).

### 2.11 — Create a subscription with a trial

```bash
SUB_TRIAL_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_ID"'",
    "planId": "'"$PLAN_ID"'",
    "trialDays": 7
  }')

echo "$SUB_TRIAL_RESULT" | jq .
SUB_TRIAL_ID=$(echo "$SUB_TRIAL_RESULT" | jq -r '.data.id')
echo "SUB_TRIAL_ID=$SUB_TRIAL_ID"
```

**Expected:** Subscription with `status: "TRIALING"`, `trialStart`, `trialEnd` set.

### 2.12 — Get subscription details

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** Full subscription object including `plan`, `customer`, and `events` (last 20).

### 2.13 — List subscriptions (with filters)

```bash
curl -s "http://localhost:3000/api/v1/subscriptions?page=1&limit=10&status=ACTIVE" \
  -H "X-API-Key: $API_KEY" | jq .
```

Filter by customer:
```bash
curl -s "http://localhost:3000/api/v1/subscriptions?customerId=$CUSTOMER_ID" \
  -H "X-API-Key: $API_KEY" | jq .
```

### 2.14 — Cancel a subscription

```bash
curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_TRIAL_ID/cancel \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "reason": "Testing cancellation flow"
  }' | jq .
```

**Expected (200):** `{ "success": true, "message": "Subscription cancelled successfully." }`

Verify the status:
```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_TRIAL_ID \
  -H "X-API-Key: $API_KEY" | jq '.data.status'
# → "CANCELLED"
```

### 2.15 — Attempt duplicate cancellation → 422

```bash
curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_TRIAL_ID/cancel \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"reason": "trying again"}' | jq .
```

**Expected (422):** `"message": "Subscription is already terminated."`

---

## Part 3 — Billing Scheduler & Nomba Charges

### 3.1 — Verify scheduler logs

Tail the server logs and confirm you see:

```
Billing cron job registered  { intervalSeconds: 10 }
```

(If `SCHEDULER_INTERVAL_SECONDS=10` in your `.env`.)

Every `SCHEDULER_INTERVAL_SECONDS`, the scheduler scans for due subscriptions:

```
Billing scheduler triggered — scanning for due subscriptions
Scheduler: no due subscriptions found
```

### 3.2 — Backdate a subscription to trigger renewal

We need a subscription whose `currentPeriodEnd` is in the past. Use `psql` or `prisma studio` to manually backdate the test subscription created earlier:

```bash
# Get current period end
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_ID \
  -H "X-API-Key: $API_KEY" | jq '.data.currentPeriodEnd'
```

Backdate it using `psql` (adjust connection string from your `.env` `DATABASE_URL`):

```bash
psql "$DATABASE_URL" -c "
  UPDATE subscriptions
  SET current_period_end = NOW() - INTERVAL '1 minute',
      current_period_start = NOW() - INTERVAL '2 days'
  WHERE id = '$SUB_ID';
"
```

Or use Prisma Studio for a visual approach:

```bash
npm run db:studio
# Then navigate to subscriptions table and manually edit currentPeriodEnd
```

### 3.3 — Wait for scheduler tick

If `SCHEDULER_INTERVAL_SECONDS=10`, wait up to 10 seconds. Watch the server logs:

```
Billing scheduler triggered — scanning for due subscriptions
Scheduler: found 1 due subscriptions — enqueuing
Scheduler: enqueued 1 renewal jobs
```

Then the renewal worker picks it up:

```
Processing renewal charge job  { subscriptionId: "...", ... }
Initiating Nomba tokenized charge  { ... }
Nomba charge response received  { success: true, ... }
Charge succeeded  { subscriptionId: "...", transactionId: "...", ... }
Renewal job completed  { jobId: "...", subscriptionId: "..." }
```

### 3.4 — Verify transaction created (PENDING)

```bash
# List transactions for this subscription via the subscription detail
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_ID \
  -H "X-API-Key: $API_KEY" | jq '.data.events[:3]'
```

For direct transaction verification, query the database:

```bash
psql "$DATABASE_URL" -c "
  SELECT id, amount_kobo, status, charge_type, retry_attempt, created_at
  FROM transactions
  WHERE subscription_id = '$SUB_ID'
  ORDER BY created_at DESC;
"
```

**Expected:** A transaction with `status = 'PENDING'` initially, then `status = 'SUCCESS'` or `status = 'FAILED'` after Nomba processes the charge.

### 3.5 — Verify Nomba auth succeeds (Redis token cache)

Connect to Redis and check the cached Nomba access token:

```bash
redis-cli
```

In the redis-cli:

```
> KEYS nomba:*
1) "nomba:access_token"
2) "nomba:refresh_token"
> GET nomba:access_token
"eyJhbGciOiJSUzI1NiIs..."
> TTL nomba:access_token
(integer) 3500
> QUIT
```

**Expected:** `nomba:access_token` key exists with a JWT-ish string, TTL > 60 seconds.

### 3.6 — Verify Nomba charge succeeds

Check the server logs for:

```
Nomba charge response received  { orderReference: "...", success: true, code: "00" }
```

Or query the transaction directly:

```bash
psql "$DATABASE_URL" -c "
  SELECT id, status, amount_kobo, nomba_reference, charge_type, created_at
  FROM transactions
  WHERE subscription_id = '$SUB_ID'
    AND charge_type = 'RENEWAL'
  ORDER BY created_at DESC
  LIMIT 1;
"
```

**Expected:** `status = 'SUCCESS'` and `nomba_reference` is populated.

### 3.7 — Verify transaction updated to SUCCESS

```bash
psql "$DATABASE_URL" -c "
  SELECT id, status, nomba_reference, failure_reason
  FROM transactions
  WHERE subscription_id = '$SUB_ID'
  ORDER BY created_at DESC
  LIMIT 3;
"
```

**Expected:** The most recent RENEWAL transaction has `status = 'SUCCESS'` and a non-null `nomba_reference`.

### 3.8 — Verify subscription period advanced

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_ID \
  -H "X-API-Key: $API_KEY" | jq '.data | {currentPeriodStart, currentPeriodEnd, status, retryCount}'
```

**Expected:**
- `currentPeriodStart` ≈ the time the charge succeeded
- `currentPeriodEnd` = `currentPeriodStart + interval days`
- `retryCount` = 0
- `status` = "ACTIVE"

### 3.9 — Proration on plan change

First, make sure the subscription is ACTIVE:

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_ID \
  -H "X-API-Key: $API_KEY" | jq '.data.status'
```

If not ACTIVE (e.g., if you cancelled it), create a fresh one:

```bash
SUB_PRORATION=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_ID"'",
    "planId": "'"$PLAN2_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')
echo "SUB_PRORATION=$SUB_PRORATION"
```

Now change to a more expensive plan (PLAN_ID = Pro Monthly at 100000 NGN, PLAN2_ID = Starter Weekly at 20000 NGN):

```bash
# Upgrade: Starter Weekly → Pro Monthly
PRORATION_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_PRORATION/change-plan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "newPlanId": "'"$PLAN_ID"'"
  }')

echo "$PRORATION_RESULT" | jq .
```

**Expected:** Response includes proration adjustment:
```json
{
  "success": true,
  "message": "Plan upgraded. A prorated charge of ₦X.XX will be applied.",
  "data": {
    "subscription": { "id": "...", "planId": "...", "status": "ACTIVE" },
    "proration": {
      "adjustmentKobo": 12345,
      "requiresCharge": true,
      "requiresCredit": false,
      "breakdown": { ... }
    }
  }
}
```

The proration worker will process the charge asynchronously. Check logs for:

```
Processing proration charge job  { ... }
Proration job completed  { ... }
```

Now test a downgrade:

```bash
# Downgrade back to Starter Weekly
curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_PRORATION/change-plan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "newPlanId": "'"$PLAN2_ID"'"
  }' | jq .
```

**Expected:**
```json
{
  "success": true,
  "message": "Plan downgraded. A credit of ₦X.XX will be applied to your next billing cycle."
}
```

### 3.10 — Verify dunning retry mechanism

Use a customer with a token that simulates failure (e.g., `tok_test_insufficient`):

```bash
# Create customer with failing token
CUSTOMER_FAIL=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "fail@example.com",
    "name": "Failing Customer",
    "nombaTokenKey": "tok_test_insufficient"
  }' | jq -r '.data.id')
echo "CUSTOMER_FAIL=$CUSTOMER_FAIL"

# Create a subscription with the short-interval plan
SUB_FAIL=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_FAIL"'",
    "planId": "'"$PLAN3_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')
echo "SUB_FAIL=$SUB_FAIL"

# Backdate it
psql "$DATABASE_URL" -c "
  UPDATE subscriptions
  SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE id = '$SUB_FAIL';
"
```

Wait for the scheduler to pick it up. Check logs for:

```
Charge attempt started  { chargeType: "RENEWAL", ... }
Nomba charge response received  { success: false, code: "INSUFFICIENT_FUNDS" }
Dunning retry scheduled  { nextRetryAttempt: 1, delayHours: 1, ... }
```

The dunning queue schedules retries at 1h, 24h, and 72h delays. After a permanent failure (EXPIRED_CARD, INVALID_CARD), the subscription is marked as `PAST_DUE` and dunning is skipped.

Verify the subscription state:

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_FAIL \
  -H "X-API-Key: $API_KEY" | jq '.data | {status, retryCount, lastFailureReason, nextRetryAt}'
```

**Expected:** `status: "PAST_DUE"`, `retryCount: 1`, `lastFailureReason: "INSUFFICIENT_FUNDS"`, `nextRetryAt` set to ~1 hour from now.

---

## Part 4 — Dunning Engine & Notification Service

The dunning engine handles failed recurring charges with a retry schedule (1h, 24h, 72h). It sends email notifications to customers at each stage: dunning started, retry scheduled, payment recovered, card update required, and subscription suspended.

### 4.1 — Create a customer with phone number

```bash
CUSTOMER_DUN=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "dunning-test@example.com",
    "name": "Dunning Test",
    "phone": "+2348012345678",
    "nombaTokenKey": "tok_test_insufficient"
  }' | jq -r '.data.id')
echo "CUSTOMER_DUN=$CUSTOMER_DUN"
```

**Expected:** Customer object includes `phone` field, `hasPaymentMethod: true`.

### 4.2 — Create a failing subscription and trigger dunning

```bash
# Create subscription with short interval (CUSTOM/1-day plan from 2.3)
SUB_DUN=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_DUN"'",
    "planId": "'"$PLAN3_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')
echo "SUB_DUN=$SUB_DUN"

# Backdate it past the period end
psql "$DATABASE_URL" -c "
  UPDATE subscriptions
  SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE id = '$SUB_DUN';
"
```

Wait for the scheduler tick. Expected logs:

```
Charge attempt started  { chargeType: "RENEWAL", ... }
Nomba charge response received  { success: false, code: "INSUFFICIENT_FUNDS" }
Dunning retry scheduled  { nextRetryAttempt: 1, delayHours: 1, ... }
```

The charge worker marks it PAST_DUE and enqueues a dunning retry job.

### 4.3 — Verify dunning API — list PAST_DUE subscriptions

```bash
curl -s "http://localhost:3000/api/v1/dunning?page=1&limit=10" \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** Response includes PAST_DUE and SUSPENDED subscriptions with pagination `meta`.

### 4.4 — Get dunning detail for a subscription

```bash
curl -s http://localhost:3000/api/v1/dunning/$SUB_DUN \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** Subscription detail with `events` (last 30), current status, retry count.

### 4.5 — Manual retry a dunning subscription

When the subscription is PAST_DUE with a non-expired token, you can trigger a manual retry:

```bash
curl -s -X POST http://localhost:3000/api/v1/dunning/$SUB_DUN/retry \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (202):**
```json
{
  "success": true,
  "message": "Manual retry enqueued for subscription SUB_DUN",
  "data": {
    "jobId": "...",
    "subscriptionId": "SUB_DUN",
    "retryAttempt": 2
  }
}
```

### 4.6 — Permanent failure transitions to SUSPENDED

Create a customer with an expired card token:

```bash
CUSTOMER_EXP=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "expired@example.com",
    "name": "Expired Card",
    "phone": "+2348012345678",
    "nombaTokenKey": "tok_test_expired"
  }' | jq -r '.data.id')

SUB_EXP=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_EXP"'",
    "planId": "'"$PLAN3_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')

psql "$DATABASE_URL" -c "
  UPDATE subscriptions
  SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE id = '$SUB_EXP';
"
```

Wait for scheduler. Expected logs:

```
Charge attempt started  { chargeType: "RENEWAL", ... }
Nomba charge response received  { success: false, code: "EXPIRED_CARD" }
Permanent card failure — escalating to SUSPENDED
```

Verify:

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_EXP \
  -H "X-API-Key: $API_KEY" | jq '.data | {status, retryCount, lastFailureReason}'
```

**Expected:** `status: "SUSPENDED"`, `retryCount: 99`, `lastFailureReason: "EXPIRED_CARD"`.

### 4.7 — Reactivate a SUSPENDED subscription

After the customer updates their card, the merchant can reactivate:

```bash
# First update payment method
curl -s -X PATCH http://localhost:3000/api/v1/customers/$CUSTOMER_EXP/payment-method \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"nombaTokenKey": "tok_test_ok"}' | jq .

# Then reactivate
curl -s -X POST http://localhost:3000/api/v1/dunning/$SUB_EXP/reactivate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{}' | jq .
```

**Expected (200):**
```json
{
  "success": true,
  "message": "Subscription reactivated. A new billing period has started.",
  "data": {
    "subscription": { "id": "...", "status": "ACTIVE", ... }
  }
}
```

### 4.8 — Verify Nomba webhook signature verification

Send a test webhook with proper signature headers:

```bash
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
SECRET="NombaHackathon2026"
PAYLOAD='{"event_type":"payment_success","requestId":"test-verify-001","data":{"merchant":{"walletId":"wlt-001","walletBalance":5000,"userId":"usr-001"},"terminal":{},"transaction":{"fee":0,"type":"vact_transfer","transactionId":"txn-001","responseCode":"","originatingFrom":"api","transactionAmount":5000,"time":"2026-07-06T10:00:00Z"},"customer":{},"order":{"orderId":"ord-001","orderReference":"test-ref-001","amount":5000,"currency":"NGN","isTokenizedCardPayment":"true","paymentMethod":"card"}}}'

SIG=$(node -e "
const crypto = require('crypto');
const p = JSON.parse(process.env.PAYLOAD);
const t = p.data.transaction, m = p.data.merchant;
let rc = t.responseCode || ''; if (rc === 'null') rc = '';
const s = [p.event_type,p.requestId,m.userId,m.walletId,t.transactionId,t.type,t.time,rc,'$TIMESTAMP'].join(':');
console.log(crypto.createHmac('sha256','$SECRET').update(s).digest('base64'));
" PAYLOAD="$PAYLOAD")

curl -s -X POST http://localhost:3000/api/v1/webhooks/nomba \
  -H "Content-Type: application/json" \
  -H "nomba-signature: $SIG" \
  -H "nomba-timestamp: $TIMESTAMP" \
  -d "$PAYLOAD" | jq .
```

**Expected (200):** `{ "received": true }`

Server logs should show: `Nomba webhook verified and received`.

Without valid signature, the webhook is still acknowledged but not processed:

```bash
curl -s -X POST http://localhost:3000/api/v1/webhooks/nomba \
  -H "Content-Type: application/json" \
  -H "nomba-signature: invalid" \
  -H "nomba-timestamp: 2026-07-06T00:00:00Z" \
  -d '{"event_type":"payment_success","requestId":"test-bad-sig","data":{}}' | jq .
```

**Expected:** Still 200, but log shows `Nomba webhook signature verification failed`.

---

## Part 5 — Inbound Webhook Processor & Outbound Webhook Delivery

### 5.1 — Verify inbound webhook deduplication

Send the same valid webhook twice. The second should be deduplicated:

```bash
# Use the same payload and signature from 4.8
curl -s -X POST http://localhost:3000/api/v1/webhooks/nomba \
  -H "Content-Type: application/json" \
  -H "nomba-signature: $SIG" \
  -H "nomba-timestamp: $TIMESTAMP" \
  -d "$PAYLOAD" | jq .
```

**Second call expected:** Log shows `Nomba webhook deduplicated — already processed`.

### 5.2 — Token capture via payment_success webhook

Send a webhook with `isTokenizedCardPayment: "true"` and `tokenizedCardData`:

```bash
CAPTURE_PAYLOAD='{
  "event_type": "payment_success",
  "requestId": "capture-test-001",
  "data": {
    "merchant": {"walletId": "wlt-001", "walletBalance": 5000, "userId": "usr-001"},
    "terminal": {},
    "transaction": {
      "fee": 0, "type": "vact_transfer", "transactionId": "txn-capture-001",
      "responseCode": "", "originatingFrom": "api",
      "transactionAmount": 5000, "time": "2026-07-06T10:00:00Z"
    },
    "customer": {},
    "order": {
      "orderId": "ord-capture-001",
      "orderReference": "CAPTURE_'$CUSTOMER_ID'",
      "amount": 5000, "currency": "NGN",
      "isTokenizedCardPayment": "true", "paymentMethod": "card"
    },
    "tokenizedCardData": {
      "tokenKey": "tok_captured_from_webhook",
      "customerEmail": "john@example.com",
      "cardType": "Verve",
      "cardPan": "506099********0003",
      "tokenExpirationDate": "12/27"
    }
  }
}'

# Create a PENDING transaction first so the webhook has something to reconcile
psql "$DATABASE_URL" -c "
  INSERT INTO transactions (id, merchant_id, subscription_id, amount_kobo, currency, status, idempotency_key, charge_type, created_at, updated_at)
  VALUES (gen_random_uuid()::text, '$MERCHANT_ID', '$SUB_ID', 5000, 'NGN', 'PENDING', 'CAPTURE_$CUSTOMER_ID', 'INITIAL', NOW(), NOW());
"

T2=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
CAPTURE_SIG=$(node -e "
const crypto = require('crypto');
const p = JSON.parse(process.env.PAYLOAD);
const t = p.data.transaction, m = p.data.merchant;
let rc = t.responseCode || ''; if (rc === 'null') rc = '';
const s = [p.event_type,p.requestId,m.userId,m.walletId,t.transactionId,t.type,t.time,rc,'$T2'].join(':');
console.log(crypto.createHmac('sha256','$SECRET').update(s).digest('base64'));
" PAYLOAD="$CAPTURE_PAYLOAD")

curl -s -X POST http://localhost:3000/api/v1/webhooks/nomba \
  -H "Content-Type: application/json" \
  -H "nomba-signature: $CAPTURE_SIG" \
  -H "nomba-timestamp: $T2" \
  -d "$CAPTURE_PAYLOAD" | jq .
```

**Expected:** Log shows `tokenKey captured and stored from payment_success webhook`. Verify:

```bash
curl -s http://localhost:3000/api/v1/customers/$CUSTOMER_ID \
  -H "X-API-Key: $API_KEY" | jq '.data | {email, hasPaymentMethod}'
```

### 5.3 — Create a webhook endpoint (outbound)

```bash
# Use a webhook.site URL for testing
ENDPOINT_URL="https://webhook.site/your-unique-url"

ENDPOINT_RESULT=$(curl -s -X POST http://localhost:3000/api/v1/webhooks/endpoints \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "'"$ENDPOINT_URL"'",
    "subscribedEvents": ["subscription.activated", "charge.recovered", "charge.failed"],
    "description": "Test endpoint from runbook"
  }')

echo "$ENDPOINT_RESULT" | jq .
ENDPOINT_ID=$(echo "$ENDPOINT_RESULT" | jq -r '.data.id')
ENDPOINT_SECRET=$(echo "$ENDPOINT_RESULT" | jq -r '.data.secret')
echo "ENDPOINT_ID=$ENDPOINT_ID"
echo "ENDPOINT_SECRET=$ENDPOINT_SECRET"
```

**Expected (201):** Endpoint object with `secret` starting with `whsec_`. The `_note` warns it will not be shown again.

### 5.4 — List webhook endpoints

```bash
curl -s http://localhost:3000/api/v1/webhooks/endpoints \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** Endpoints list — `secret` field absent.

### 5.5 — Get webhook endpoint detail

```bash
curl -s http://localhost:3000/api/v1/webhooks/endpoints/$ENDPOINT_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected:** Single endpoint object, no `secret` field visible.

### 5.6 — Non-HTTPS endpoint rejected

```bash
curl -s -X POST http://localhost:3000/api/v1/webhooks/endpoints \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "http://insecure.example.com", "subscribedEvents": ["charge.failed"]}' | jq .
```

**Expected (422):** Validation error — HTTPS required.

### 5.7 — Update endpoint (subscribe to all events)

```bash
curl -s -X PATCH http://localhost:3000/api/v1/webhooks/endpoints/$ENDPOINT_ID \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "subscribedEvents": ["subscription.activated", "subscription.past_due", "subscription.suspended", "subscription.cancelled", "subscription.expired", "charge.succeeded", "charge.failed", "charge.recovered", "dunning.started", "plan.changed"]
  }' | jq .
```

**Expected (200):** Updated endpoint with all 10 event types.

### 5.8 — Verify outbound delivery on state change

Create a subscription that triggers `SUBSCRIPTION_ACTIVATED`:

```bash
SUB_WEBHOOK=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_ID"'",
    "planId": "'"$PLAN2_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')
echo "SUB_WEBHOOK=$SUB_WEBHOOK"
```

Check logs for:
```
Outbound webhook delivery enqueued  { deliveryId: "del_...", eventId: "evt_...", aegisEventType: "subscription.activated", ... }
Webhook delivery attempt completed  { deliveryId: "...", endpointUrl: "...", responseStatus: 200, success: true, ... }
```

Verify delivery record:

```bash
curl -s "http://localhost:3000/api/v1/webhooks/endpoints/$ENDPOINT_ID/deliveries" \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected:** Delivery with `status: "DELIVERED"`, `eventType: "subscription.activated"`, `attemptCount: 1`.

### 5.9 — Verify signature on delivered payload (self-test)

Using the endpoint secret from creation and the raw body from webhook.site:

```bash
node -e "
const crypto = require('crypto');
const secret = '$ENDPOINT_SECRET';
const rawBody = 'PASTE_RAW_BODY_FROM_WEBHOOK_SITE';
const header = 'PASTE_X_AEGIS_SIGNATURE_HEADER';
const computed = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
console.log('Computed:', computed);
console.log('Received:', header);
console.log('Match:', crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(header)));
"
```

**Expected:** Prints `Match: true`.

### 5.10 — Failed delivery retry test

Create another endpoint pointing to a URL that returns 500 (use webhook.site custom response):

```bash
ENDPOINT_FAIL=$(curl -s -X POST http://localhost:3000/api/v1/webhooks/endpoints \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://webhook.site/your-failing-url",
    "subscribedEvents": ["subscription.activated"]
  }' | jq -r '.data.id')

# Trigger another subscription
SUB_FAIL_WEB=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_ID"'",
    "planId": "'"$PLAN2_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')
```

Check logs for retry sequence:
- First attempt fails → status becomes `RETRYING`
- After delay, second attempt fires
- After 4 total attempts → status becomes `FAILED`

### 5.11 — Delete webhook endpoint

```bash
curl -s -X DELETE http://localhost:3000/api/v1/webhooks/endpoints/$ENDPOINT_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (200):** `{ "success": true, "message": "Webhook endpoint deleted" }`

Verify deletion:

```bash
curl -s http://localhost:3000/api/v1/webhooks/endpoints/$ENDPOINT_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (404):** `{ "success": false, "message": "Webhook endpoint not found" }`

### 5.12 — Verify uptime pinger is running

Check the server logs at startup:
```
Uptime pinger started  { intervalSeconds: 300, url: "http://localhost:3000/health" }
```

After startup, every 300 seconds (configurable via `UPTIME_PING_INTERVAL_SECONDS`):

```
Uptime ping success  { url: "http://localhost:3000/health", status: 200 }
```

---

## Part 6 — Graceful Shutdown & Restart

### 6.1 — SIGTERM handling

Find the server process and send SIGTERM:

```bash
# Get the PID (if running via npm run dev, it's typically the node/tsx process)
ps aux | grep "tsx\|node.*aegis" | grep -v grep

# Replace {PID} with the actual process ID
kill -SIGTERM {PID}
```

**Expected logs (in order):**

```
SIGTERM received — shutting down gracefully
HTTP server closed
Stopping all background workers...
All workers stopped
All BullMQ queues closed
Graceful shutdown complete
```

### 6.2 — Worker drain

To test that in-flight jobs complete during shutdown, start a subscription that's due for renewal, send SIGTERM while the charge is processing, and verify the transaction reaches a terminal state (`SUCCESS` or `FAILED`).

### 6.3 — Restart state recovery

```bash
npm run dev
```

On restart, the cron job deregisters old repeatable jobs and re-registers:

```
Billing cron job registered  { intervalSeconds: 10 }
```

Any subscriptions that became due during downtime will be picked up on the next scheduler tick.

---

## Part 7 — Error Scenarios

### 7.1 — Invalid API key

```bash
curl -s http://localhost:3000/api/v1/plans \
  -H "X-API-Key: ak_live_0000000000000000000000000000000000000000000000000000000000000000" | jq .
```

**Expected (401):**
```json
{
  "success": false,
  "message": "Invalid or expired API key"
}
```

### 7.2 — Missing API key header

```bash
curl -s http://localhost:3000/api/v1/plans | jq .
```

**Expected (401):**
```json
{
  "success": false,
  "message": "Missing or invalid X-API-Key header"
}
```

### 7.3 — Invalid API key format (not starting with ak_live_ or ak_test_)

```bash
curl -s http://localhost:3000/api/v1/plans \
  -H "X-API-Key: invalid-key-format" | jq .
```

**Expected (401):**
```json
{
  "success": false,
  "message": "Invalid API key format"
}
```

### 7.4 — Duplicate merchant email

```bash
curl -s -X POST http://localhost:3000/api/v1/merchants/register \
  -H "Content-Type: application/json" \
  -d '{
    "businessName": "Acme Corp Clone",
    "email": "admin@acme.com"
  }' | jq .
```

**Expected (409):**
```json
{
  "success": false,
  "message": "A merchant account with this email already exists."
}
```

### 7.5 — Duplicate customer email (within same merchant)

```bash
curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "john@example.com",
    "name": "John Doe Duplicate"
  }' | jq .
```

**Expected (409):**
```json
{
  "success": false,
  "message": "A customer with email \"john@example.com\" already exists in your account."
}
```

### 7.6 — Subscription not found

```bash
curl -s http://localhost:3000/api/v1/subscriptions/nonexistent-id-12345 \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (404):**
```json
{
  "success": false,
  "message": "Subscription not found"
}
```

### 7.7 — Plan not found

```bash
curl -s http://localhost:3000/api/v1/plans/nonexistent-plan-id \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (404):**
```json
{
  "success": false,
  "message": "Plan not found"
}
```

### 7.8 — Duplicate plan name

```bash
curl -s -X POST http://localhost:3000/api/v1/plans \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "name": "Pro Monthly",
    "amountKobo": 50000,
    "interval": "MONTHLY"
  }' | jq .
```

**Expected (409):**
```json
{
  "success": false,
  "message": "A plan named \"Pro Monthly\" already exists. Plan names must be unique."
}
```

### 7.9 — Create subscription without payment method and no trial

```bash
curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER2_ID"'",
    "planId": "'"$PLAN_ID"'",
    "trialDays": 0
  }' | jq .
```

**Expected (403):**
```json
{
  "success": false,
  "message": "This customer has no payment method on file. Add a Nomba token key via PATCH /customers/:id/payment-method, or create this subscription with trialDays > 0."
}
```

### 7.10 — Plan change on non-ACTIVE subscription

```bash
# Cancel the subscription first
curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_ID/cancel \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{"reason": "testing"}' | jq .

# Attempt plan change
curl -s -X POST http://localhost:3000/api/v1/subscriptions/$SUB_ID/change-plan \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "newPlanId": "'"$PLAN2_ID"'"
  }' | jq .
```

**Expected (403):**
```json
{
  "success": false,
  "message": "Plan changes are only allowed on ACTIVE subscriptions. Current status is: CANCELLED"
}
```

### 7.11 — Nomba auth failure (invalid credentials)

Temporarily set invalid Nomba credentials in `.env` and restart:

```bash
# In .env, set:
# NOMBA_CLIENT_ID=invalid
# NOMBA_CLIENT_SECRET=invalid

# Restart server, then trigger a charge
```

**Expected log:** `"Nomba auth failed: HTTP 401"`

And the charge attempt will fail with a network/timeout error on the `chargeTokenizedCard` catch block, returning:
```json
{
  "success": false,
  "failureCode": "TIMEOUT",
  "failureMessage": "Charge request timed out — Nigerian network issue or Nomba outage"
}
```

### 7.12 — Expired card (permanent failure — SUSPENDED)

```bash
# Create customer with expired card token
CUSTOMER_EXPIRED=$(curl -s -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "email": "expired@example.com",
    "name": "Expired Card Customer",
    "nombaTokenKey": "tok_test_expired"
  }' | jq -r '.data.id')

SUB_EXPIRED=$(curl -s -X POST http://localhost:3000/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "customerId": "'"$CUSTOMER_EXPIRED"'",
    "planId": "'"$PLAN3_ID"'",
    "trialDays": 0
  }' | jq -r '.data.id')

# Backdate
psql "$DATABASE_URL" -c "
  UPDATE subscriptions
  SET current_period_end = NOW() - INTERVAL '1 minute'
  WHERE id = '$SUB_EXPIRED';
"
```

Wait for scheduler tick. Expected logs:

```
Charge attempt started  { chargeType: "RENEWAL", ... }
Nomba charge response received  { success: false, code: "EXPIRED_CARD" }
Permanent card failure — escalating to SUSPENDED
```

Verify subscription state:

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_EXPIRED \
  -H "X-API-Key: $API_KEY" | jq '.data | {status, retryCount, lastFailureReason}'
```

**Expected:** `status: "SUSPENDED"`, `retryCount: 99`, `lastFailureReason: "EXPIRED_CARD"`. The subscription is suspended and an `update_card` email is sent.

### 7.13 — Route not found (404)

```bash
curl -s http://localhost:3000/api/v1/nonexistent-route \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (404):**
```json
{
  "success": false,
  "message": "Route not found"
}
```

### 7.14 — Archive plan with active subscriptions

```bash
curl -s -X DELETE http://localhost:3000/api/v1/plans/$PLAN_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (403):**
```json
{
  "success": false,
  "message": "Cannot archive plan \"Pro Monthly\" — it has N active subscription(s). Migrate customers to a new plan before archiving."
}
```

### 7.15 — Delete customer with active subscriptions

```bash
curl -s -X DELETE http://localhost:3000/api/v1/customers/$CUSTOMER_ID \
  -H "X-API-Key: $API_KEY" | jq .
```

**Expected (403):**
```json
{
  "success": false,
  "message": "Cannot delete customer — they have N active subscription(s). Cancel all subscriptions before deleting the customer."
}
```

---

## Appendix — Quick Reference

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | HTTP server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `API_KEY_SALT` | — | 64-char hex for API key hashing |
| `NOMBA_BASE_URL` | `https://api.nomba.com/v1` | Nomba API base URL |
| `NOMBA_CLIENT_ID` | — | Nomba OAuth client ID |
| `NOMBA_CLIENT_SECRET` | — | Nomba OAuth client secret |
| `NOMBA_ACCOUNT_ID` | — | Nomba account ID |
| `NOMBA_SUB_ACCOUNT_ID` | — | Nomba sub-account for scoped operations |
| `NOMBA_WEBHOOK_SECRET` | — | Shared secret for webhook HMAC verification |
| `SCHEDULER_INTERVAL_SECONDS` | `60` | Billing scheduler tick interval |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |
| `SMTP_HOST` | — | SMTP server hostname |
| `SMTP_PORT` | `587` | SMTP server port |
| `SMTP_SECURE` | `false` | Use TLS for SMTP |
| `SMTP_USER` | — | SMTP authentication username |
| `SMTP_PASS` | — | SMTP authentication password |
| `SMTP_FROM` | — | Default from-address for emails |
| `APP_BASE_URL` | `http://localhost:3000` | Public URL (used for Nomba callbackUrl + uptime pinger) |
| `WEBHOOK_MAX_DELIVERY_ATTEMPTS` | `4` | Max outbound webhook retries |
| `UPTIME_PING_INTERVAL_SECONDS` | `300` | Self-ping interval for Railway keepalive |

### API Endpoints Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/health` | No | Health check |
| `POST` | `/api/v1/merchants/register` | No | Register merchant |
| `GET` | `/api/v1/merchants/me` | Yes | Get merchant profile |
| `POST` | `/api/v1/plans` | Yes | Create plan |
| `GET` | `/api/v1/plans` | Yes | List plans |
| `GET` | `/api/v1/plans/:id` | Yes | Get plan |
| `PATCH` | `/api/v1/plans/:id` | Yes | Update plan |
| `DELETE` | `/api/v1/plans/:id` | Yes | Archive plan |
| `POST` | `/api/v1/customers` | Yes | Create customer |
| `GET` | `/api/v1/customers` | Yes | List customers |
| `GET` | `/api/v1/customers/:id` | Yes | Get customer |
| `PATCH` | `/api/v1/customers/:id` | Yes | Update customer |
| `PATCH` | `/api/v1/customers/:id/payment-method` | Yes | Update payment method |
| `DELETE` | `/api/v1/customers/:id` | Yes | Delete customer |
| `POST` | `/api/v1/subscriptions` | Yes | Create subscription |
| `GET` | `/api/v1/subscriptions` | Yes | List subscriptions |
| `GET` | `/api/v1/subscriptions/:id` | Yes | Get subscription |
| `POST` | `/api/v1/subscriptions/:id/cancel` | Yes | Cancel subscription |
| `POST` | `/api/v1/subscriptions/:id/change-plan` | Yes | Change subscription plan |
| `GET` | `/api/v1/dunning` | Yes | List dunning (PAST_DUE / SUSPENDED) subscriptions |
| `GET` | `/api/v1/dunning/:id` | Yes | Get dunning detail with events |
| `POST` | `/api/v1/dunning/:id/retry` | Yes | Trigger manual dunning retry |
| `POST` | `/api/v1/dunning/:id/reactivate` | Yes | Reactivate SUSPENDED subscription |
| `POST` | `/api/v1/webhooks/nomba` | No | Inbound Nomba webhook receiver |
| `POST` | `/api/v1/webhooks/endpoints` | Yes | Register outbound webhook endpoint |
| `GET` | `/api/v1/webhooks/endpoints` | Yes | List webhook endpoints |
| `GET` | `/api/v1/webhooks/endpoints/:id` | Yes | Get endpoint detail |
| `PATCH` | `/api/v1/webhooks/endpoints/:id` | Yes | Update endpoint |
| `DELETE` | `/api/v1/webhooks/endpoints/:id` | Yes | Delete endpoint |
| `GET` | `/api/v1/webhooks/endpoints/:id/deliveries` | Yes | List delivery logs for endpoint |

### State Machine Transitions

```
TRIALING  → ACTIVE, PAST_DUE, CANCELLED, EXPIRED
ACTIVE    → PAST_DUE, CANCELLED, EXPIRED
PAST_DUE  → ACTIVE, SUSPENDED, CANCELLED
SUSPENDED → ACTIVE, CANCELLED
CANCELLED → (terminal)
EXPIRED   → (terminal)
```

### Dunning Retry Schedule

| Attempt | Delay | Action |
|---|---|---|
| 1 | 1 hour | Retry charge, send `retry_scheduled` email |
| 2 | 24 hours | Retry charge, send `retry_scheduled` email |
| 3 | 72 hours | Retry charge, send `retry_scheduled` email |
| 4+ | — | Max retries reached, subscription → `SUSPENDED`, send `subscription_suspended` email |

Permanent failures (`EXPIRED_CARD`, `INVALID_CARD`) bypass the retry schedule entirely — subscription goes directly to `SUSPENDED` and an `update_card` email is sent.

### Outbound Webhook Delivery Retry Schedule

| Attempt | Delay | Action |
|---|---|---|
| 1 | 0s (immediate) | First delivery attempt |
| 2 | 5 minutes | Retry |
| 3 | 30 minutes | Retry |
| 4 | 2 hours | Final attempt, then mark `FAILED` |
