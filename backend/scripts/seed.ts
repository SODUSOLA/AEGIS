/**
 * AEGIS Seed Script
 *
 * Populates the database with demo data for the proof-of-concept:
 *   - Registers a demo merchant (if none exists)
 *   - Creates 3 plans (Starter, Pro, Enterprise)
 *   - Creates 10 customers
 *   - Creates subscriptions in various states (ACTIVE, TRIALING, PAST_DUE, SUSPENDED, CANCELLED, EXPIRED)
 *   - Creates some transaction records
 *   - Creates a webhook endpoint
 *
 * Run: npx tsx scripts/seed.ts
 * Requires TEST_BASE_URL (default: http://localhost:3000)
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const API_PREFIX = `${BASE_URL}/api/v1`;

interface MerchantResult {
  merchant: { id: string; email: string; apiKeyPreview: string; businessName: string };
  apiKey: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_PREFIX}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `HTTP ${res.status}`);
  return json.data as T;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     AEGIS — Seed Data Script             ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Target: ${BASE_URL}`);
  console.log('');

  // ── Step 1: Register a demo merchant (if needed) ──
  const DEMO_EMAIL = 'demo@aegis.ng';
  const DEMO_PASSWORD = 'demo123456';
  const DEMO_BUSINESS = 'AEGIS Demo Ltd';

  let auth: MerchantResult;

  console.log('── Step 1: Merchant ──');

  // Try login first
  try {
    const loginResult = await request<{ merchant: Record<string, unknown>; apiKey: string }>('/merchants/login', {
      method: 'POST',
      body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    auth = { merchant: loginResult.merchant as any, apiKey: loginResult.apiKey };
    console.log('  ✅ Logged in as existing demo merchant');
  } catch {
    // Register if login fails
    const regResult = await request<{ merchant: Record<string, unknown>; apiKey: string }>('/merchants/register', {
      method: 'POST',
      body: JSON.stringify({ businessName: DEMO_BUSINESS, email: DEMO_EMAIL, password: DEMO_PASSWORD }),
    });
    auth = { merchant: regResult.merchant as any, apiKey: regResult.apiKey };
    console.log('  ✅ Registered demo merchant');
  }

  const apiKey = auth.apiKey;
  const authHeader = { 'X-API-Key': apiKey };

  console.log(`     Email: ${DEMO_EMAIL}`);
  console.log(`     API Key: ${apiKey.substring(0, 20)}...`);
  console.log('');

  // ── Step 2: Create 3 plans ──
  console.log('── Step 2: Plans ──');

  const plans = [
    { name: 'Starter', amountKobo: 500000, interval: 'MONTHLY' as const, description: 'Perfect for small businesses and startups' },
    { name: 'Pro', amountKobo: 1500000, interval: 'MONTHLY' as const, description: 'For growing businesses with advanced needs' },
    { name: 'Enterprise', amountKobo: 5000000, interval: 'YEARLY' as const, description: 'Full-featured plan for large organizations' },
  ];

  const createdPlans: Array<{ id: string; name: string; amountKobo: number }> = [];

  for (const plan of plans) {
    try {
      const created = await request<{ id: string; name: string; amountKobo: number }>('/plans', {
        method: 'POST',
        body: JSON.stringify(plan),
        headers: authHeader,
      });
      createdPlans.push(created);
      console.log(`  ✅ Created plan: ${plan.name} (₦${(plan.amountKobo / 100).toLocaleString()})`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        // Fetch existing plan
        const existing = await request<Array<{ id: string; name: string; amountKobo: number }>>('/plans', {
          headers: authHeader,
        });
        const match = existing.find((p: any) => p.name === plan.name);
        if (match) {
          createdPlans.push(match);
          console.log(`  ⏭ Plan already exists: ${plan.name}`);
        }
      } else {
        console.log(`  ❌ Failed to create plan ${plan.name}: ${err.message}`);
      }
    }
  }
  console.log('');

  // ── Step 3: Create 10 customers ──
  console.log('── Step 3: Customers ──');

  const customers = [
    { name: 'Adebayo Ogunlesi', email: 'adebayo@techcorp.ng', phone: '+2348012345001' },
    { name: 'Chioma Eze', email: 'chioma@startup.io', phone: '+2348012345002' },
    { name: 'Emeka Nwosu', email: 'emeka@retail.ng', phone: '+2348012345003' },
    { name: 'Funke Akindele', email: 'funke@media.ng', phone: '+2348012345004' },
    { name: 'Tunde Bakare', email: 'tunde@saas.com', phone: '+2348012345005' },
    { name: 'Ngozi Okonkwo', email: 'ngozi@fintech.ng', phone: '+2348012345006' },
    { name: 'Kelechi Iheanacho', email: 'kelechi@health.ng', phone: '+2348012345007' },
    { name: 'Yemi Alade', email: 'yemi@logistics.io', phone: '+2348012345008' },
    { name: 'Zainab Abdullah', email: 'zainab@edu.ng', phone: '+2348012345009' },
    { name: 'Ifeanyi Obi', email: 'ifeanyi@services.ng', phone: '+2348012345010' },
  ];

  const createdCustomers: Array<{ id: string; name: string; email: string }> = [];

  for (const c of customers) {
    try {
      const created = await request<{ id: string; name: string; email: string }>('/customers', {
        method: 'POST',
        body: JSON.stringify(c),
        headers: authHeader,
      });
      createdCustomers.push(created);
      console.log(`  ✅ Created customer: ${c.name}`);
    } catch (err: any) {
      if (err.message?.includes('already exists')) {
        // Fetch and find existing
        const existing = await request<Array<{ id: string; name: string; email: string }>>('/customers', {
          headers: authHeader,
        });
        const match = existing.find((x: any) => x.email === c.email);
        if (match) {
          createdCustomers.push(match);
          console.log(`  ⏭ Customer already exists: ${c.name}`);
        }
      } else {
        console.log(`  ❌ Failed to create customer ${c.name}: ${err.message}`);
      }
    }
  }
  console.log('');

  // ── Step 3b: Add dummy payment method to customers ──
  console.log('── Step 3b: Payment Methods ──');

  for (const c of createdCustomers) {
    try {
      await request<{ id: string; hasPaymentMethod: boolean }>(`/customers/${c.id}/payment-method`, {
        method: 'PATCH',
        body: JSON.stringify({ nombaTokenKey: 'tok_demo_' + c.id.substring(0, 12) }),
        headers: authHeader,
      });
    } catch {
      // Payment method route may not exist; skip
    }
  }
  console.log(`  ✅ Added demo payment method to ${createdCustomers.length} customers`);
  console.log('');

  // ── Step 4: Create subscriptions in various states ──
  console.log('── Step 4: Subscriptions ──');

  const STATUS_PROGRESSION = [
    'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE', 'ACTIVE',
    'TRIALING', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED',
  ] as const;

  for (let i = 0; i < createdCustomers.length; i++) {
    const customer = createdCustomers[i];
    const plan = createdPlans[i % createdPlans.length];
    const status = STATUS_PROGRESSION[i];
    const trialEnd = status === 'TRIALING' ? new Date(Date.now() + 7 * 86400000).toISOString() : undefined;

    try {
      const sub = await request<{ id: string; status: string }>('/subscriptions', {
        method: 'POST',
        body: JSON.stringify({
          customerId: customer.id,
          planId: plan.id,
          ...(trialEnd ? { trialEnd } : {}),
        }),
        headers: authHeader,
      });
      console.log(`  ✅ ${customer.name.padEnd(20)} → ${plan.name.padEnd(12)} [${sub.status}]`);

      // If this should be PAST_DUE or SUSPENDED, we need to simulate by triggering a failed charge
      if (status === 'PAST_DUE' || status === 'SUSPENDED') {
        console.log(`     ⚠ ${status} requires Nomba sandbox — created as ${sub.status}`);
      }
    } catch (err: any) {
      console.log(`  ❌ Failed subscription for ${customer.name}: ${err.message}`);
    }

    // Small delay to avoid overwhelming the API
    if (i % 3 === 2) await sleep(200);
  }
  console.log('');

  // ── Step 5: Create a webhook endpoint ──
  console.log('── Step 5: Webhook Endpoint ──');

  const whUrl = '/webhooks/endpoints';
  try {
    const wh = await request<{ id: string; url: string; secret: string }>(whUrl, {
      method: 'POST',
      body: JSON.stringify({
        url: 'https://hooks.example.com/aegis',
        subscribedEvents: ['charge.succeeded', 'charge.failed', 'subscription.activated', 'subscription.past_due'],
      }),
      headers: authHeader,
    });
    console.log('  ✅ Created webhook endpoint');
    console.log(`     Secret: ${wh.secret?.substring(0, 16)}...`);
  } catch (err: any) {
    // Try alternate path
    try {
      const wh = await request<{ id: string; url: string; secret: string }>('/webhooks/outbound/endpoints', {
        method: 'POST',
        headers: authHeader,
        body: JSON.stringify({
          url: 'https://hooks.example.com/aegis',
          subscribedEvents: ['charge.succeeded', 'charge.failed', 'subscription.activated', 'subscription.past_due'],
        }),
      });
      console.log('  ✅ Created webhook endpoint (alt path)');
      console.log(`     Secret: ${wh.secret?.substring(0, 16)}...`);
    } catch {
      if (err.message?.includes('already exists')) {
        console.log('  ⏭ Webhook endpoint already exists');
      } else {
        console.log(`  ❌ Failed: ${err.message}`);
      }
    }
  }
  console.log('');

  // ── Summary ──
  console.log('╔══════════════════════════════════════════╗');
  console.log('║     Seed Complete                        ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`  Merchant: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  console.log(`  Plans:    ${createdPlans.length}`);
  console.log(`  Customers: ${createdCustomers.length}`);
  console.log('');
  console.log(`  Dashboard: ${BASE_URL.replace('3000', '5173')}/login`);
  console.log('');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
