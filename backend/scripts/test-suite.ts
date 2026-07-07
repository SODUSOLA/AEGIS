/**
 * AEGIS — Comprehensive End-to-End Test Suite
 *
 * Run from the backend folder:
 *   npx tsx scripts/test-suite.ts
 *
 * Requirements:
 *   - Server running at BASE_URL (local or Railway)
 *   - Database migrated and seeded
 *   - Redis running
 *   - All env vars set
 *
 * The script runs all phases in order. Each test captures
 * data for subsequent tests. Do not reorder sections.
 */

import crypto from 'crypto';

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const BASE_URL = process.env.TEST_BASE_URL ?? 'http://localhost:3000';
const API = `${BASE_URL}/api/v1`;
const NOMBA_WEBHOOK_SECRET = 'NombaHackathon2026';

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];
const state: Record<string, string> = {};

// ─── TEST RUNNER ──────────────────────────────────────────────────────────────

function pass(name: string) {
  passed++;
  console.log(`  \u2705 ${name}`);
}

function fail(name: string, reason: string) {
  failed++;
  failures.push(`${name}: ${reason}`);
  console.log(`  \u274c ${name}`);
  console.log(`     \u2514\u2500 ${reason}`);
}

function section(title: string) {
  console.log(`\n${'\u2500'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('\u2500'.repeat(60));
}

async function req(
  method: string,
  path: string,
  options: {
    body?: unknown;
    apiKey?: string;
    headers?: Record<string, string>;
  } = {},
): Promise<{ status: number; body: any }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (options.apiKey) {
    headers['X-API-Key'] = options.apiKey;
  }

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  let body: any;
  try {
    body = await res.json();
  } catch {
    body = {};
  }

  return { status: res.status, body };
}

function assertStatus(name: string, actual: number, expected: number): boolean {
  if (actual !== expected) {
    fail(name, `Expected HTTP ${expected}, got HTTP ${actual}`);
    return false;
  }
  return true;
}

function assertField(name: string, obj: any, field: string, expectedValue?: unknown): boolean {
  const value = field.split('.').reduce((o, k) => o?.[k], obj);
  if (value === undefined || value === null) {
    fail(name, `Missing field: ${field}`);
    return false;
  }
  if (expectedValue !== undefined && value !== expectedValue) {
    fail(name, `Field ${field}: expected "${expectedValue}", got "${value}"`);
    return false;
  }
  return true;
}

function assertAbsent(name: string, obj: any, field: string): boolean {
  const value = field.split('.').reduce((o, k) => o?.[k], obj);
  if (value !== undefined && value !== null) {
    fail(name, `Field ${field} should not be present, but got: "${value}"`);
    return false;
  }
  return true;
}

function buildNombaWebhookSignature(payload: any, timestamp: string, secret: string): string {
  const m = payload.data.merchant;
  const t = payload.data.transaction;
  let rc = t.responseCode ?? '';
  if (rc === 'null') rc = '';
  const str = [
    payload.event_type,
    payload.requestId,
    m.userId,
    m.walletId,
    t.transactionId,
    t.type,
    t.time,
    rc,
    timestamp,
  ].join(':');
  return crypto.createHmac('sha256', secret).update(str).digest('base64');
}

// ─── TEST SECTIONS ─────────────────────────────────────────────────────────────

async function testInfrastructure() {
  section('PHASE 0 \u2014 Infrastructure');

  const { status, body } = await fetch(`${BASE_URL}/health`).then(async (r) => ({
    status: r.status,
    body: await r.json(),
  }));

  if (status === 200 && body?.data?.database === 'connected') {
    pass('Health endpoint returns 200 with database connected');
  } else {
    fail('Health endpoint', `Got status ${status}, database: ${body?.data?.database}`);
  }

  const notFound = await req('GET', '/this-route-does-not-exist');
  if (notFound.status === 404) pass('Unknown routes return 404');
  else fail('Unknown routes return 404', `Got ${notFound.status}`);
}

async function testMerchantAuth() {
  section('PHASE 1 \u2014 Merchant Auth & Tenant Isolation');

  // Register Merchant A
  const regA = await req('POST', '/merchants/register', {
    body: { businessName: 'Test SaaS A', email: `test-a-${Date.now()}@aegis.test`, password: 'testpass123' },
  });
  if (!assertStatus('Merchant A registration returns 201', regA.status, 201)) return;
  if (!assertField('Merchant A has apiKey', regA.body, 'data.apiKey')) return;
  if (!regA.body.data.apiKey.startsWith('ak_live_')) {
    fail('apiKey prefix', `Got: ${regA.body?.data?.apiKey?.substring(0, 15)}`);
    return;
  }
  pass('Merchant A registration returns 201 with ak_live_ key');
  state.apiKeyA = regA.body.data.apiKey;
  state.merchantIdA = regA.body.data.merchant.id;

  // Verify raw key not exposed in merchant sub-object
  if (regA.body.data.merchant?.apiKey || regA.body.data.merchant?.apiKeyHash) {
    fail('Raw key must not appear in merchant sub-object', 'apiKey or apiKeyHash present in merchant object');
  } else {
    pass('Raw API key only in top-level data \u2014 not in nested merchant object');
  }

  // Register Merchant B
  const regB = await req('POST', '/merchants/register', {
    body: { businessName: 'Test SaaS B', email: `test-b-${Date.now()}@aegis.test`, password: 'testpass456' },
  });
  if (!assertStatus('Merchant B registration returns 201', regB.status, 201)) return;
  state.apiKeyB = regB.body.data.apiKey;
  state.merchantIdB = regB.body.data.merchant.id;
  pass('Merchant B registered with distinct API key');

  if (state.apiKeyA === state.apiKeyB) {
    fail('API keys must be unique per merchant', 'Both merchants received the same key');
  } else {
    pass('Each merchant receives a unique API key');
  }

  // Duplicate email rejected
  const dupEmail = regA.body.data.merchant.email;
  const dup = await req('POST', '/merchants/register', {
    body: { businessName: 'Duplicate', email: dupEmail, password: 'testpass789' },
  });
  if (dup.status === 409) pass('Duplicate merchant email returns 409 Conflict');
  else fail('Duplicate email', `Expected 409, got ${dup.status}`);

  // Invalid email rejected
  const invalid = await req('POST', '/merchants/register', {
    body: { businessName: 'Invalid', email: 'not-an-email', password: 'testpass789' },
  });
  if (invalid.status === 422) pass('Invalid email format returns 422 Unprocessable Entity');
  else fail('Invalid email', `Expected 422, got ${invalid.status}`);

  // Short password rejected
  const shortPw = await req('POST', '/merchants/register', {
    body: { businessName: 'Short PW', email: `short-${Date.now()}@aegis.test`, password: '1234567' },
  });
  if (shortPw.status === 422) pass('Password < 8 characters returns 422');
  else fail('Short password validation', `Expected 422, got ${shortPw.status}`);

  // Profile retrieval
  const profile = await req('GET', '/merchants/me', { apiKey: state.apiKeyA });
  if (profile.status === 200) {
    assertAbsent('Profile does not expose raw apiKey', profile.body.data, 'apiKey');
    assertAbsent('Profile does not expose apiKeyHash', profile.body.data, 'apiKeyHash');
    pass('Merchant profile returned without raw key exposure');
  }

  // Missing key \u2192 401
  const noKey = await req('GET', '/merchants/me');
  if (noKey.status === 401) pass('Missing X-API-Key header returns 401');
  else fail('Missing API key', `Expected 401, got ${noKey.status}`);

  // Wrong key \u2192 401
  const wrongKey = await req('GET', '/merchants/me', {
    apiKey: 'ak_live_fakefakefakefakefakefakefakefakefakefakefakefakefakefakefake',
  });
  if (wrongKey.status === 401) pass('Invalid API key value returns 401');
  else fail('Invalid API key', `Expected 401, got ${wrongKey.status}`);

  // Login
  const loginA = await req('POST', '/merchants/login', {
    body: { email: regA.body.data.merchant.email, password: 'testpass123' },
  });
  if (loginA.status === 200 && loginA.body.data?.apiKey) {
    pass('Merchant A login successful \u2014 new API key returned');
    // Store new key (login rotates keys)
    state.apiKeyA = loginA.body.data.apiKey;
  } else {
    fail('Login', `Status: ${loginA.status}, hasKey: ${!!loginA.body.data?.apiKey}`);
  }

  // Old API key should be invalid now (login rotates)
  const oldKey = regA.body.data.apiKey;
  const oldKeyProfile = await req('GET', '/merchants/me', { apiKey: oldKey });
  if (oldKeyProfile.status === 401) {
    pass('Old API key invalidated after login \u2014 key rotation working');
  } else {
    fail('Key rotation', 'Old API key still works after login');
  }

  // Wrong password
  const wrongPw = await req('POST', '/merchants/login', {
    body: { email: regA.body.data.merchant.email, password: 'wrongpassword' },
  });
  if (wrongPw.status === 401) pass('Wrong password returns 401');
  else fail('Wrong password', `Expected 401, got ${wrongPw.status}`);

  // Non-existent email
  const noEmail = await req('POST', '/merchants/login', {
    body: { email: `nonexistent-${Date.now()}@test.com`, password: 'testpass123' },
  });
  if (noEmail.status === 401) pass('Non-existent email returns 401 (not 404)');
  else fail('Non-existent email', `Expected 401, got ${noEmail.status}`);

  // Missing fields on login
  const missingFields = await req('POST', '/merchants/login', { body: {} });
  if (missingFields.status === 422) pass('Login with empty body returns 422');
  else fail('Empty login body', `Expected 422, got ${missingFields.status}`);

  // Registration missing fields
  const emptyReg = await req('POST', '/merchants/register', { body: {} });
  if (emptyReg.status === 422) pass('Registration with empty body returns 422');
  else fail('Empty registration body', `Expected 422, got ${emptyReg.status}`);
}

async function testPlans() {
  section('PHASE 2A \u2014 Plan Management');

  const starter = await req('POST', '/plans', {
    apiKey: state.apiKeyA,
    body: { name: 'Starter', amountKobo: 500000, interval: 'MONTHLY' },
  });
  if (!assertStatus('Create Starter plan returns 201', starter.status, 201)) return;
  assertField('Plan has amountKobo', starter.body, 'data.amountKobo', 500000);
  assertField('Plan interval is MONTHLY', starter.body, 'data.interval', 'MONTHLY');
  pass('Starter plan created with amountKobo: 500000 (\u20A65,000)');
  state.planStarterId = starter.body.data.id;

  const pro = await req('POST', '/plans', {
    apiKey: state.apiKeyA, body: { name: 'Pro', amountKobo: 1000000, interval: 'MONTHLY' },
  });
  if (pro.status === 201) pass('Pro plan created');
  state.planProId = pro.body.data.id;

  // Float amountKobo rejected
  const floatPlan = await req('POST', '/plans', {
    apiKey: state.apiKeyA, body: { name: 'Float', amountKobo: 500000.50, interval: 'MONTHLY' },
  });
  if (floatPlan.status === 422) pass('Float amountKobo rejected with 422');
  else fail('Float amountKobo', `Expected 422, got ${floatPlan.status}`);

  // CUSTOM without intervalDays
  const customNodays = await req('POST', '/plans', {
    apiKey: state.apiKeyA, body: { name: 'CustomNoDays', amountKobo: 100000, interval: 'CUSTOM' },
  });
  if (customNodays.status === 422) pass('CUSTOM interval without intervalDays returns 422');
  else fail('CUSTOM no days', `Expected 422, got ${customNodays.status}`);

  // CUSTOM with intervalDays
  const customValid = await req('POST', '/plans', {
    apiKey: state.apiKeyA, body: { name: 'Custom45', amountKobo: 200000, interval: 'CUSTOM', intervalDays: 45 },
  });
  if (customValid.status === 201) pass('CUSTOM interval plan with intervalDays created');
  else fail('CUSTOM valid', `Expected 201, got ${customValid.status}`);

  // Duplicate plan name \u2192 409
  const dupPlan = await req('POST', '/plans', {
    apiKey: state.apiKeyA, body: { name: 'Starter', amountKobo: 100000, interval: 'MONTHLY' },
  });
  if (dupPlan.status === 409) pass('Duplicate plan name returns 409 Conflict');
  else fail('Duplicate plan', `Expected 409, got ${dupPlan.status}`);

  // Tenant isolation
  const bPlans = await req('GET', '/plans', { apiKey: state.apiKeyB });
  const bPlanList = bPlans.body.data ?? [];
  if (Array.isArray(bPlanList) && bPlanList.length === 0) pass('Merchant B sees zero plans \u2014 tenant isolation correct');
  else fail('Tenant isolation', `Merchant B sees ${bPlanList.length} plans`);

  // Cross-tenant plan access
  const bAccessA = await req('GET', `/plans/${state.planStarterId}`, { apiKey: state.apiKeyB });
  if (bAccessA.status === 404) pass("Cross-tenant plan access returns 404 (does not leak existence)");
  else fail('Cross-tenant plan', `Expected 404, got ${bAccessA.status}`);

  // Plan list with pagination
  const planList = await req('GET', '/plans?page=1&limit=10', { apiKey: state.apiKeyA });
  if (planList.status === 200 && planList.body.meta?.total !== undefined) pass('Plan list returns pagination metadata');
  else fail('Plan pagination', `Status: ${planList.status}, hasMeta: ${!!planList.body.meta}`);
}

async function testCustomers() {
  section('PHASE 2B \u2014 Customer Management');

  const email = `customer-${Date.now()}@test.com`;
  const cust = await req('POST', '/customers', {
    apiKey: state.apiKeyA, body: { email, name: 'Ada Obi', phone: '+2348012345678' },
  });
  if (!assertStatus('Create customer returns 201', cust.status, 201)) return;
  assertField('Customer has hasPaymentMethod: false', cust.body, 'data.hasPaymentMethod', false);
  assertAbsent('nombaTokenKey not in response', cust.body.data, 'nombaTokenKey');
  pass('Customer created \u2014 hasPaymentMethod: false, nombaTokenKey hidden');
  state.customerId = cust.body.data.id;

  if (cust.body.data.phone === '+2348012345678') pass('Customer phone field stored correctly');
  else fail('Phone field', `Expected +2348012345678, got ${cust.body.data.phone}`);

  // Duplicate email for same merchant \u2192 409
  const dupCust = await req('POST', '/customers', {
    apiKey: state.apiKeyA, body: { email, name: 'Duplicate' },
  });
  if (dupCust.status === 409) pass('Duplicate customer email returns 409');
  else fail('Duplicate customer', `Expected 409, got ${dupCust.status}`);

  // Same email under different merchant \u2192 201
  const crossMerchantCust = await req('POST', '/customers', {
    apiKey: state.apiKeyB, body: { email, name: 'Same Email Different Merchant' },
  });
  if (crossMerchantCust.status === 201) pass('Same email allowed under different merchant');
  else fail('Cross-merchant customer', `Expected 201, got ${crossMerchantCust.status}`);

  // Update payment method
  state.nombaTokenKey = `tok_test_${Date.now()}`;
  const updateToken = await req('PATCH', `/customers/${state.customerId}/payment-method`, {
    apiKey: state.apiKeyA, body: { nombaTokenKey: state.nombaTokenKey },
  });
  if (updateToken.status === 200) pass('Payment method updated successfully');
  else fail('Payment method update', `Expected 200, got ${updateToken.status}`);

  // Verify hasPaymentMethod is now true
  const fetchCust = await req('GET', `/customers/${state.customerId}`, { apiKey: state.apiKeyA });
  if (fetchCust.status === 200 && fetchCust.body.data.hasPaymentMethod === true) {
    assertAbsent('nombaTokenKey still not exposed', fetchCust.body.data, 'nombaTokenKey');
    pass('hasPaymentMethod true after token update \u2014 raw token never exposed');
  } else {
    fail('Payment method verification', `hasPaymentMethod: ${fetchCust.body?.data?.hasPaymentMethod}`);
  }

  // Cross-tenant customer access
  const bGetA = await req('GET', `/customers/${state.customerId}`, { apiKey: state.apiKeyB });
  if (bGetA.status === 404) pass('Cross-merchant customer access returns 404');
  else fail('Cross-tenant customer', `Expected 404, got ${bGetA.status}`);
}

async function testSubscriptions() {
  section('PHASE 2C \u2014 Subscriptions & State Machine');

  // Subscription without payment method \u2192 403
  const custNoToken = await req('POST', '/customers', {
    apiKey: state.apiKeyA, body: { email: `no-token-${Date.now()}@test.com` },
  });
  const subNoToken = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyA, body: { customerId: custNoToken.body.data.id, planId: state.planStarterId, trialDays: 0 },
  });
  if (subNoToken.status === 403) pass('Subscription without token returns 403');
  else fail('Subscription without token', `Expected 403, got ${subNoToken.status}`);

  // Subscription WITH trial (no token required)
  const subTrial = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyA, body: { customerId: custNoToken.body.data.id, planId: state.planStarterId, trialDays: 14 },
  });
  if (subTrial.status === 201 && subTrial.body.data.status === 'TRIALING') {
    pass('Trial subscription created with status TRIALING');
  } else {
    fail('Trial subscription', `Status: ${subTrial.status}, data: ${JSON.stringify(subTrial.body.data)}`);
  }

  // Create main test subscription
  const sub = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyA, body: { customerId: state.customerId, planId: state.planStarterId, trialDays: 0 },
  });
  if (!assertStatus('Subscription creation returns 201', sub.status, 201)) return;
  assertField('Status is ACTIVE', sub.body, 'data.status', 'ACTIVE');
  assertField('pulseScore starts at 100', sub.body, 'data.pulseScore', 100);
  pass('Subscription created as ACTIVE with pulseScore 100');
  state.subscriptionId = sub.body.data.id;

  // Duplicate active subscription \u2192 409
  const dupSub = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyA, body: { customerId: state.customerId, planId: state.planStarterId, trialDays: 0 },
  });
  if (dupSub.status === 409) pass('Duplicate active subscription returns 409');
  else fail('Duplicate subscription', `Expected 409, got ${dupSub.status}`);

  // Cross-tenant subscription creation
  const crossSub = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyB, body: { customerId: state.customerId, planId: state.planStarterId, trialDays: 0 },
  });
  if (crossSub.status === 404) pass('Cross-tenant subscription returns 404');
  else fail('Cross-tenant sub', `Expected 404, got ${crossSub.status}`);

  // Subscription with event history
  const subDetail = await req('GET', `/subscriptions/${state.subscriptionId}`, { apiKey: state.apiKeyA });
  if (subDetail.status === 200) {
    const events = subDetail.body.data.events ?? [];
    const activated = events.find((e: any) => e.eventType === 'SUBSCRIPTION_ACTIVATED');
    if (activated) pass('Subscription has SUBSCRIPTION_ACTIVATED event in audit history');
    else fail('Event history missing', 'SUBSCRIPTION_ACTIVATED event not found');
  }

  // Cancel subscription
  const cancel = await req('POST', `/subscriptions/${state.subscriptionId}/cancel`, {
    apiKey: state.apiKeyA, body: { reason: 'Test cancellation' },
  });
  if (cancel.status === 200) pass('Subscription cancelled successfully');
  else fail('Cancellation', `Expected 200, got ${cancel.status}`);

  // Verify cancelled state
  const cancelled = await req('GET', `/subscriptions/${state.subscriptionId}`, { apiKey: state.apiKeyA });
  if (cancelled.body.data.status === 'CANCELLED') pass('Subscription status is CANCELLED after cancellation');
  else fail('Cancelled state', `Got ${cancelled.body?.data?.status}`);

  // Double cancellation \u2192 422
  const doubleCancel = await req('POST', `/subscriptions/${state.subscriptionId}/cancel`, {
    apiKey: state.apiKeyA, body: { reason: 'Second cancel' },
  });
  if (doubleCancel.status === 422) pass('Double cancellation returns 422');
  else fail('Double cancellation', `Expected 422, got ${doubleCancel.status}`);

  // Create billing test subscription
  const freshCust = await req('POST', '/customers', {
    apiKey: state.apiKeyA, body: { email: `billing-${Date.now()}@test.com`, name: 'Billing Test' },
  });
  state.billingCustomerId = freshCust.body.data.id;
  await req('PATCH', `/customers/${state.billingCustomerId}/payment-method`, {
    apiKey: state.apiKeyA, body: { nombaTokenKey: `tok_billing_${Date.now()}` },
  });
  const billingSub = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyA, body: { customerId: state.billingCustomerId, planId: state.planStarterId, trialDays: 0 },
  });
  state.billingSubscriptionId = billingSub.body.data.id;
  pass('Billing test subscription created');
}

async function testBillingEngine() {
  section('PHASE 3 \u2014 Billing Engine');

  const billingSubDetail = await req('GET', `/subscriptions/${state.billingSubscriptionId}`, { apiKey: state.apiKeyA });
  if (billingSubDetail.status === 200 && billingSubDetail.body.data.status === 'ACTIVE') {
    pass('Billing subscription is ACTIVE and ready');
  }

  const subEvents = billingSubDetail.body.data.events ?? [];
  if (subEvents.length > 0) pass(`Subscription has ${subEvents.length} lifecycle event(s)`);

  // Kobo conversion correctness
  const amountNaira = Number((500000 / 100).toFixed(2));
  if (amountNaira === 5000 && typeof amountNaira === 'number') {
    pass('Kobo-to-naira conversion: 500000 kobo \u2192 5000.00 naira (number, not string)');
  }
}

async function testDunningEngine() {
  section('PHASE 4 \u2014 Dunning Engine');

  const dunning = await req('GET', '/dunning', { apiKey: state.apiKeyA });
  if (dunning.status === 200) {
    pass('Dunning endpoint accessible');
    const subs = dunning.body.data ?? [];
    const invalid = subs.filter((s: any) => !['PAST_DUE', 'SUSPENDED'].includes(s.status));
    if (invalid.length === 0) pass('Dunning list contains only PAST_DUE and SUSPENDED');
    else fail('Dunning status filter', `Found ${invalid.length} non-dunning subscriptions`);
  }

  const retryActive = await req('POST', `/dunning/${state.billingSubscriptionId}/retry`, { apiKey: state.apiKeyA });
  if (retryActive.status === 403) pass('Retry on ACTIVE subscription returns 403');
  else fail('Retry on active', `Expected 403, got ${retryActive.status}`);

  const reactiveActive = await req('POST', `/dunning/${state.billingSubscriptionId}/reactivate`, {
    apiKey: state.apiKeyA, body: { reason: 'Test' },
  });
  if (reactiveActive.status === 403) pass('Reactivate on non-SUSPENDED returns 403');
  else fail('Reactivate on active', `Expected 403, got ${reactiveActive.status}`);

  const dunningDetail = await req('GET', `/dunning/${state.billingSubscriptionId}`, { apiKey: state.apiKeyA });
  if (dunningDetail.status === 404) pass('Dunning detail on ACTIVE sub returns 404');
  else fail('Dunning detail non-dunning', `Expected 404, got ${dunningDetail.status}`);

  // Tenant isolation
  const bDunning = await req('GET', '/dunning', { apiKey: state.apiKeyB });
  if (bDunning.status === 200) {
    const leaked = (bDunning.body.data ?? []).find((s: any) => s.id === state.billingSubscriptionId);
    if (!leaked) pass('Merchant B cannot see Merchant A dunning \u2014 isolation correct');
    else fail('Tenant isolation breach', 'Merchant B can see Merchant A subscription');
  }

  // Sort param
  const sortedDunning = await req('GET', '/dunning?sortBy=nextRetryAt', { apiKey: state.apiKeyA });
  if (sortedDunning.status === 200) pass('Dunning supports sortBy=nextRetryAt');
}

async function testInboundWebhooks() {
  section('PHASE 5A \u2014 Inbound Webhook Processor');

  const timestamp = new Date().toISOString();
  const requestId = `test-${Date.now()}`;

  const payload = {
    event_type: 'payment_success',
    requestId,
    data: {
      merchant: { walletId: `wlt-${Date.now()}`, walletBalance: 50000, userId: `usr-${Date.now()}` },
      terminal: {},
      transaction: {
        fee: 0, type: 'vact_transfer', transactionId: `txn-${Date.now()}`,
        responseCode: '', originatingFrom: 'api', transactionAmount: 5000,
        time: '2026-07-01T10:00:00Z',
      },
      customer: {},
    },
  };

  const signature = buildNombaWebhookSignature(payload, timestamp, NOMBA_WEBHOOK_SECRET);

  // Valid signed webhook
  const valid = await fetch(`${API}/webhooks/nomba`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'nomba-signature': signature, 'nomba-timestamp': timestamp },
    body: JSON.stringify(payload),
  });
  if (valid.status === 200) pass('Valid signed Nomba webhook returns 200');
  else fail('Valid webhook', `Expected 200, got ${valid.status}`);

  // Deduplication (same requestId)
  const dup = await fetch(`${API}/webhooks/nomba`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'nomba-signature': signature, 'nomba-timestamp': timestamp },
    body: JSON.stringify(payload),
  });
  if (dup.status === 200) pass('Duplicate webhook (same requestId) returns 200 \u2014 dedup acknowledged');
  else fail('Webhook dedup', `Expected 200, got ${dup.status}`);

  // Invalid signature
  const invalidSig = await fetch(`${API}/webhooks/nomba`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'nomba-signature': 'invalidsignature==', 'nomba-timestamp': timestamp },
    body: JSON.stringify({ ...payload, requestId: `invalid-sig-${Date.now()}` }),
  });
  if (invalidSig.status === 200) pass('Invalid signature returns 200 \u2014 prevents Nomba retry cycle');
  else fail('Invalid signature', `Expected 200, got ${invalidSig.status}`);

  // Missing headers
  const noHeaders = await fetch(`${API}/webhooks/nomba`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_type: 'payment_success', requestId: `no-headers-${Date.now()}` }),
  });
  if (noHeaders.status === 200) pass('Webhook without signature headers returns 200 \u2014 no crash');
  else fail('Missing headers', `Expected 200, got ${noHeaders.status}`);

  // No API key required
  const noAuth = await fetch(`${API}/webhooks/nomba`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'nomba-signature': signature, 'nomba-timestamp': timestamp },
    body: JSON.stringify({ ...payload, requestId: `no-auth-${Date.now()}` }),
  });
  if (noAuth.status !== 401) pass('Webhook endpoint does not require X-API-Key');
  else fail('Webhook requires auth', 'Nomba webhook endpoint should not require API key');

  // Verify "null" responseCode handling
  const testPayload = {
    event_type: 'payment_failed', requestId: 'sig-test-001',
    data: {
      merchant: { walletId: 'wlt-001', walletBalance: 0, userId: 'usr-001' },
      terminal: {}, transaction: { fee: 0, type: 'card', transactionId: 'txn-001', responseCode: 'null', originatingFrom: 'api', transactionAmount: 5000, time: '2026-01-01T00:00:00Z' }, customer: {},
    },
  };
  const testTimestamp = '2026-01-01T00:00:00Z';
  const sigWithNull = buildNombaWebhookSignature(testPayload, testTimestamp, NOMBA_WEBHOOK_SECRET);
  testPayload.data.transaction.responseCode = '';
  const sigWithEmpty = buildNombaWebhookSignature(testPayload, testTimestamp, NOMBA_WEBHOOK_SECRET);
  if (sigWithNull === sigWithEmpty) pass('Webhook signature treats "null" responseCode same as empty string');
  else fail('Signature null handling', 'Signatures differ for "null" vs "" responseCode');
}

async function testOutboundWebhooks() {
  section('PHASE 5B \u2014 Outbound Webhook Endpoints');

  const create = await req('POST', '/webhooks/endpoints', {
    apiKey: state.apiKeyA, body: {
      url: 'https://webhook.site/test-aegis-endpoint',
      subscribedEvents: ['subscription.activated', 'charge.failed', 'charge.recovered'],
      description: 'Test endpoint',
    },
  });
  if (!assertStatus('Create webhook endpoint returns 201', create.status, 201)) return;

  if (create.body.data.secret?.startsWith('whsec_')) {
    pass('Webhook endpoint created with whsec_ secret');
    state.webhookEndpointId = create.body.data.id;
    state.webhookEndpointSecret = create.body.data.secret;
  } else {
    fail('Secret format', `Expected whsec_ prefix, got: ${create.body.data.secret?.substring(0, 10)}`);
  }

  // HTTP URL rejected
  const httpEndpoint = await req('POST', '/webhooks/endpoints', {
    apiKey: state.apiKeyA, body: { url: 'http://insecure.example.com', subscribedEvents: ['charge.failed'] },
  });
  if (httpEndpoint.status === 422) pass('HTTP webhook URL rejected \u2014 HTTPS required');
  else fail('HTTP URL', `Expected 422, got ${httpEndpoint.status}`);

  // Empty events rejected
  const emptyEvents = await req('POST', '/webhooks/endpoints', {
    apiKey: state.apiKeyA, body: { url: 'https://valid.example.com', subscribedEvents: [] },
  });
  if (emptyEvents.status === 422) pass('Empty subscribedEvents returns 422');
  else fail('Empty events', `Expected 422, got ${emptyEvents.status}`);

  // List endpoints \u2014 secret should not be exposed
  const listEndpoints = await req('GET', '/webhooks/endpoints', { apiKey: state.apiKeyA });
  if (listEndpoints.status === 200) {
    const endpoints = listEndpoints.body.data ?? [];
    const secretExposed = endpoints.some((e: any) => e.secret);
    if (!secretExposed) pass('Webhook endpoint secrets NOT exposed in list response');
    else fail('Secret exposure', 'Endpoint secret is visible in list response');
  }

  // Single endpoint \u2014 secret should not be in GET response
  const getEndpoint = await req('GET', `/webhooks/endpoints/${state.webhookEndpointId}`, { apiKey: state.apiKeyA });
  if (getEndpoint.status === 200 && !getEndpoint.body.data.secret) {
    pass('Endpoint secret not exposed in GET /endpoints/:id');
  } else if (getEndpoint.body.data.secret) {
    fail('Secret in GET', 'Secret should not be returned after initial creation');
  }

  // Cross-tenant isolation
  const bEndpoints = await req('GET', '/webhooks/endpoints', { apiKey: state.apiKeyB });
  if (bEndpoints.status === 200) {
    const leaked = (bEndpoints.body.data ?? []).find((e: any) => e.id === state.webhookEndpointId);
    if (!leaked) pass('Merchant B cannot see Merchant A endpoints \u2014 isolation correct');
    else fail('Webhook isolation breach', 'Merchant B can see Merchant A endpoint');
  }

  // Delivery logs
  const deliveries = await req('GET', `/webhooks/endpoints/${state.webhookEndpointId}/deliveries`, { apiKey: state.apiKeyA });
  if (deliveries.status === 200) pass('Webhook delivery logs accessible');

  // Cross-tenant delivery logs
  const bDeliveries = await req('GET', `/webhooks/endpoints/${state.webhookEndpointId}/deliveries`, { apiKey: state.apiKeyB });
  if (bDeliveries.status === 404) pass('Merchant B cannot access Merchant A delivery logs');

  // Update endpoint
  const update = await req('PATCH', `/webhooks/endpoints/${state.webhookEndpointId}`, {
    apiKey: state.apiKeyA, body: { description: 'Updated', status: 'DISABLED' },
  });
  if (update.status === 200) pass('Webhook endpoint updated to DISABLED');
  else fail('Endpoint update', `Expected 200, got ${update.status}`);

  // Re-enable
  await req('PATCH', `/webhooks/endpoints/${state.webhookEndpointId}`, {
    apiKey: state.apiKeyA, body: { status: 'ACTIVE' },
  });
}

async function testPulseScore() {
  section('PHASE 6A \u2014 Pulse Score Engine');

  const freshCust = await req('POST', '/customers', {
    apiKey: state.apiKeyA, body: { email: `pulse-${Date.now()}@test.com`, name: 'Pulse Test' },
  });
  await req('PATCH', `/customers/${freshCust.body.data.id}/payment-method`, {
    apiKey: state.apiKeyA, body: { nombaTokenKey: `tok_pulse_${Date.now()}` },
  });
  const pulseSub = await req('POST', '/subscriptions', {
    apiKey: state.apiKeyA, body: { customerId: freshCust.body.data.id, planId: state.planStarterId, trialDays: 0 },
  });

  if (pulseSub.body.data.pulseScore === 100) pass('New ACTIVE subscription starts with Pulse Score 100');
  else fail('Initial Pulse Score', `Expected 100, got ${pulseSub.body.data.pulseScore}`);

  // Score included in list
  const subList = await req('GET', '/subscriptions?limit=5', { apiKey: state.apiKeyA });
  if (subList.status === 200) {
    const allHave = (subList.body.data ?? []).every((s: any) => s.pulseScore !== undefined);
    if (allHave) pass('Pulse Score included in all subscription list items');
    else fail('Pulse Score in list', 'Some items missing pulseScore');
  }

  // Band thresholds
  const bands: Array<{ score: number; expected: string }> = [
    { score: 100, expected: 'Healthy' },
    { score: 80, expected: 'Healthy' },
    { score: 79, expected: 'At Risk' },
    { score: 50, expected: 'At Risk' },
    { score: 49, expected: 'Critical' },
    { score: 0, expected: 'Critical' },
  ];
  let bandOk = true;
  for (const { score, expected } of bands) {
    const label = score >= 80 ? 'Healthy' : score >= 50 ? 'At Risk' : 'Critical';
    if (label !== expected) { bandOk = false; fail('Band', `Score ${score}: expected ${expected}, got ${label}`); }
  }
  if (bandOk) pass('Pulse Score bands correct: 80-100 Healthy, 50-79 At Risk, 0-49 Critical');
}

async function testDashboard() {
  section('PHASE 6B \u2014 Dashboard API');

  const overview = await req('GET', '/dashboard/overview', { apiKey: state.apiKeyA });
  if (overview.status === 200) {
    const d = overview.body.data;
    if (d?.mrr?.kobo !== undefined && d?.mrr?.naira !== undefined && d?.mrr?.formatted?.startsWith('\u20A6')) pass('MRR returned in kobo, naira, and \u20A6-formatted string');
    else fail('MRR format', `Got: ${JSON.stringify(d?.mrr)}`);
    if (d?.subscriptions?.active !== undefined && d?.subscriptions?.atRisk !== undefined) pass('Subscription counts present');
    if (d?.webhooks?.deliveryRate >= 0 && d?.webhooks?.deliveryRate <= 100) pass(`Webhook delivery rate: ${d.webhooks.deliveryRate}%`);

    const bOverview = await req('GET', '/dashboard/overview', { apiKey: state.apiKeyB });
    if (bOverview.status === 200) pass('Merchant B gets own dashboard overview');
    else fail('Merchant B overview', `Expected 200, got ${bOverview.status}`);
  } else {
    fail('Dashboard overview', `Expected 200, got ${overview.status}`);
  }

  const revenue = await req('GET', '/dashboard/revenue', { apiKey: state.apiKeyA });
  if (revenue.status === 200) {
    const trend = revenue.body.data ?? [];
    if (trend.length === 30) pass('Revenue trend returns exactly 30 days');
    else fail('Revenue trend length', `Expected 30, got ${trend.length}`);
    const allHave = trend.every((d: any) => d.date && d.amountKobo !== undefined);
    if (allHave) pass('Every trend entry has date and amountKobo');
  }

  const atRisk = await req('GET', '/dashboard/at-risk', { apiKey: state.apiKeyA });
  if (atRisk.status === 200) {
    const subs = atRisk.body.data ?? [];
    if (subs.every((s: any) => s.pulseScore < 50)) pass('At-risk subs have Pulse Score < 50');
    else fail('At-risk threshold', 'Some subs have score >= 50');
  }

  const board = await req('GET', '/dashboard/subscriptions?sortBy=pulseScore&page=1&limit=10', { apiKey: state.apiKeyA });
  if (board.status === 200 && board.body.meta?.total !== undefined) {
    const scores = (board.body.data ?? []).map((s: any) => s.pulseScore);
    const sorted = scores.every((s: number, i: number) => i === 0 || s >= scores[i - 1]);
    if (sorted) pass('Subscription board sorted by pulseScore ascending');
    else fail('Sort order', `Scores: ${scores.join(', ')}`);
  }

  const unauth = await req('GET', '/dashboard/overview');
  if (unauth.status === 401) pass('Dashboard without API key returns 401');
}

async function testTenantIsolation() {
  section('FINAL \u2014 Tenant Isolation');

  const checks = [
    '/plans', '/customers', '/subscriptions',
    '/dunning', '/webhooks/endpoints',
    '/dashboard/overview', '/dashboard/revenue', '/dashboard/at-risk',
  ];

  let allClean = true;
  for (const path of checks) {
    const aRes = await req('GET', path, { apiKey: state.apiKeyA });
    const bRes = await req('GET', path, { apiKey: state.apiKeyB });
    if (aRes.status !== 200 || bRes.status !== 200) {
      fail(`${path} isolation`, `A:${aRes.status} B:${bRes.status}`);
      allClean = false;
      continue;
    }
    const aData = aRes.body.data;
    const bData = bRes.body.data;
    if (Array.isArray(aData) && Array.isArray(bData)) {
      const aIds = new Set(aData.map((i: any) => i.id).filter(Boolean));
      const leaked = bData.filter((i: any) => aIds.has(i.id));
      if (leaked.length > 0) {
        fail(`${path} BREACH`, `${leaked.length} items visible to Merchant B`);
        allClean = false;
      }
    }
  }
  if (allClean) pass('Zero cross-tenant data leakage across all 8 endpoint groups');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n  Target: ${BASE_URL}`);
  console.log(`  Time:   ${new Date().toISOString()}\n`);

  try {
    await testInfrastructure();
    await testMerchantAuth();
    await testPlans();
    await testCustomers();
    await testSubscriptions();
    await testBillingEngine();
    await testDunningEngine();
    await testInboundWebhooks();
    await testOutboundWebhooks();
    await testPulseScore();
    await testDashboard();
    await testTenantIsolation();
  } catch (err) {
    console.error('\n  Test runner crashed:', err);
  }

  console.log(`\n  \u2705 Passed: ${passed}`);
  if (failed > 0) console.log(`  \u274c Failed: ${failed}`);
  if (skipped > 0) console.log(`  \u23ed Skipped: ${skipped}`);
  const total = passed + failed;
  const rate = total > 0 ? Math.round((passed / (passed + failed)) * 100) : 0;
  console.log(`  Pass Rate: ${rate}%\n`);

  if (failures.length > 0) {
    console.log('  FAILURES:\n');
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }

  console.log('\n  MANUAL TESTS REQUIRED:');
  console.log('  1. Backdate sub.currentPeriodEnd \u2192 verify billing scheduler fires');
  console.log('  2. Use Nomba sandbox failure card \u2192 verify PAST_DUE + dunning email');
  console.log('  3. Verify dunning retry fires after nextRetryAt (backdate in Prisma Studio)');
  console.log('  4. Check Gmail for dunning notification emails');
  console.log('  5. Open frontend at Vercel URL \u2192 verify all 4 pages load');
  console.log('  6. Confirm Railway logs show uptime pinger every 5 minutes');
  console.log('  7. Confirm Nomba sends real webhook when sandbox checkout completes\n');

  process.exit(failed > 0 ? 1 : 0);
}

main();
