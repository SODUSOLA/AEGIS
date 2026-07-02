# AEGIS Backend — Acceptance Test Runbook (Phase 1–3)

## Prerequisites

Ensure the following are in place before running any tests:

- **Docker containers** running PostgreSQL and Redis
- **npm dependencies** installed (`npm install`)
- **Database migrated** (`npm run db:migrate`)
- **`.env` configured** with valid sandbox Nomba credentials (see `.env.example`)
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

# Copy and edit .env (fill in Nomba sandbox credentials)
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
6. `All background workers started successfully`
7. `AEGIS is running`

Additional logs you may see:
- `Billing cron job registered` (scheduler interval registration)
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

## Part 4 — Graceful Shutdown & Restart

### 4.1 — SIGTERM handling

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

### 4.2 — Worker drain

To test that in-flight jobs complete during shutdown, start a subscription that's due for renewal, send SIGTERM while the charge is processing, and verify the transaction reaches a terminal state (`SUCCESS` or `FAILED`).

### 4.3 — Restart state recovery

```bash
npm run dev
```

On restart, the cron job deregisters old repeatable jobs and re-registers:

```
Billing cron job registered  { intervalSeconds: 10 }
```

Any subscriptions that became due during downtime will be picked up on the next scheduler tick.

---

## Part 5 — Error Scenarios

### 5.1 — Invalid API key

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

### 5.2 — Missing API key header

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

### 5.3 — Invalid API key format (not starting with ak_live_ or ak_test_)

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

### 5.4 — Duplicate merchant email

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

### 5.5 — Duplicate customer email (within same merchant)

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

### 5.6 — Subscription not found

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

### 5.7 — Plan not found

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

### 5.8 — Duplicate plan name

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

### 5.9 — Create subscription without payment method and no trial

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

### 5.10 — Plan change on non-ACTIVE subscription

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

### 5.11 — Nomba auth failure (invalid credentials)

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

### 5.12 — Expired card (permanent failure)

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
Permanent card failure — skipping dunning, escalating to SUSPENDED
```

Verify subscription state:

```bash
curl -s http://localhost:3000/api/v1/subscriptions/$SUB_EXPIRED \
  -H "X-API-Key: $API_KEY" | jq '.data | {status, retryCount, lastFailureReason}'
```

**Expected:** `status: "PAST_DUE"`, `retryCount: 99`, `lastFailureReason: "EXPIRED_CARD"` (the subscription is marked PAST_DUE and retries are exhausted — no dunning scheduled).

### 5.13 — Route not found (404)

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

### 5.14 — Archive plan with active subscriptions

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

### 5.15 — Delete customer with active subscriptions

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
| `SCHEDULER_INTERVAL_SECONDS` | `60` | Billing scheduler tick interval |
| `WORKER_CONCURRENCY` | `5` | BullMQ worker concurrency |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

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
| 1 | 1 hour | Retry charge |
| 2 | 24 hours | Retry charge |
| 3 | 72 hours | Retry charge |
| 4+ | — | Max retries reached, no further action |

Permanent failures (`EXPIRED_CARD`, `INVALID_CARD`) skip dunning entirely.
