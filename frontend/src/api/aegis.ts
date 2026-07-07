export interface Metric {
  label: string;
  value: string;
  trend: string;
  trendColor: string;
  direction: "up" | "down";
  sublabel?: string;
}

export interface StateBreakdown {
  status: string;
  count: number;
  color: string;
}

export interface ActivityEvent {
  type: string;
  color: string;
  customer: string;
  time: string;
}

export interface Transaction {
  customer: string;
  plan: string;
  amount: string;
  status: string;
  time: string;
}

export interface AtRiskSubscription {
  id: string;
  customer: string;
  plan: string;
  pulseScore: number;
  status: string;
  nextRetry: string;
  attempt: number;
  maxAttempts: number;
}

export interface RevenuePoint {
  date: string;
  revenue: number;
  recovered: number;
  failed: number;
}

export interface DunningSubscription {
  id: string;
  customer: string;
  plan: string;
  reason: string;
  attempt: number;
  maxAttempts: number;
  nextRetry: string;
  status: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
}

export interface WebhookDelivery {
  id: string;
  url: string;
  event: string;
  attempts: string;
  lastAttempted: string;
  status: "delivered" | "failed" | "retrying";
  payload: object;
}

export interface Subscription {
  id: string;
  customer: string;
  plan: string;
  amount: number;
  status: string;
  pulseScore: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  nextCharge: string;
  retryCount: number;
  maxRetries: number;
  createdAt: string;
}

export interface SubscriptionListResponse {
  subscriptions: Subscription[];
  total: number;
  page: number;
  pageSize: number;
}

const API_BASE = import.meta.env.VITE_AEGIS_API_URL || 'http://localhost:3001/api/v1';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const apiKey = typeof window !== 'undefined' ? localStorage.getItem('aegis-api-key') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (apiKey) headers['X-API-Key'] = apiKey;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  const json = await res.json();

  if (!res.ok) {
    throw new Error(json.message || `Request failed with status ${res.status}`);
  }

  return json.data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function randomBetween(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const NAMES = [
  "adebayo@gmail.com", "chioma@techcorp.ng", "emeka@startup.io",
  "funke@media.ng", "tunde@saas.com", "ngozi@fintech.ng",
  "kelechi@retail.ng", "yemi@logistics.io", "amina@health.ng",
  "dayo@edu.ng", "zainab@media.io", "ifeanyi@services.ng",
  "titi@fashion.ng", "uche@energy.ng", "bola@agency.com",
];

const PLANS = ["Starter", "Premium", "Enterprise"];
const STATUSES = ["ACTIVE", "TRIALING", "PAST_DUE", "SUSPENDED", "CANCELLED", "EXPIRED"];
const REASONS = ["Insufficient Funds", "Expired Card", "Network Timeout", "Card Declined"];
const EVENTS = [
  "charge.succeeded", "charge.failed", "charge.recovered",
  "subscription.activated", "subscription.past_due",
  "subscription.suspended", "subscription.canceled",
  "dunning.started", "plan.changed",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDateTime(d: Date): string {
  return `${formatDate(d)}, ${formatTime(d)}`;
}

function hoursAgo(n: number): Date {
  const d = new Date();
  d.setHours(d.getHours() - n);
  return d;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function generateTransactions(count: number): Transaction[] {
  return Array.from({ length: count }, (_, i) => {
    const name = pick(NAMES);
    const plan = pick(PLANS);
    const amounts: Record<string, string> = { Starter: "₦2,000", Premium: "₦5,000", Enterprise: "₦15,000" };
    const statuses = ["ACTIVE", "ACTIVE", "ACTIVE", "PAST_DUE", "CANCELLED", "TRIALING"];
    return {
      customer: name,
      plan,
      amount: amounts[plan],
      status: pick(statuses),
      time: formatDateTime(hoursAgo(i * 3 + 1)),
    };
  });
}

function generateAtRisk(): AtRiskSubscription[] {
  return Array.from({ length: randomBetween(2, 5) }, (_, i) => {
    const name = pick(NAMES);
    const plan = pick(PLANS);
    return {
      id: `sub_at_${i + 1}`,
      customer: name,
      plan,
      pulseScore: randomBetween(10, 49),
      status: pick(["PAST_DUE", "SUSPENDED"]),
      nextRetry: formatDateTime(hoursAgo(i * -4)),
      attempt: randomBetween(1, 3),
      maxAttempts: 3,
    };
  });
}

const storedAtRisk = generateAtRisk();
const storedTransactions = generateTransactions(10);

export const aegis = {
  async getOverview() {
    await sleep(200);
    const active = randomBetween(240, 310);
    const mrr = randomBetween(1300000, 1550000);
    const churnRate = (Math.random() * 3 + 1).toFixed(1);
    const failed = randomBetween(12, 25);
    const recovered = randomBetween(8, 18);
    const recoveryPct = Math.round((recovered / (failed + recovered)) * 100);

    return {
      metrics: [
        { label: "Active Subscriptions", value: active.toLocaleString(), trend: `+${randomBetween(5, 15)}%`, trendColor: "#22C55E", direction: "up" as const },
        { label: "MRR", value: `₦${mrr.toLocaleString()}`, trend: `+${randomBetween(3, 12)}%`, trendColor: "#22C55E", direction: "up" as const },
        { label: "Churn Rate", value: `${churnRate}%`, trend: `-${(Math.random() * 0.5 + 0.1).toFixed(1)}%`, trendColor: "#22C55E", direction: "down" as const },
        { label: "Failed Charges", value: failed.toLocaleString(), trend: `+${randomBetween(1, 6)}`, trendColor: "#EF4444", direction: "up" as const, sublabel: "today" },
        { label: "Recovered Charges", value: recovered.toLocaleString(), trend: `${recoveryPct}% recovery`, trendColor: "#94A3B8", direction: "up" as const, sublabel: "today" },
      ],
      stateBreakdown: [
        { status: "ACTIVE", count: active - randomBetween(20, 50), color: "#22C55E" },
        { status: "TRIALING", count: randomBetween(20, 50), color: "#3B82F6" },
        { status: "PAST_DUE", count: randomBetween(5, 18), color: "#EAB308" },
        { status: "SUSPENDED", count: randomBetween(2, 8), color: "#F97316" },
        { status: "CANCELLED", count: randomBetween(5, 15), color: "#EF4444" },
        { status: "EXPIRED", count: randomBetween(1, 6), color: "#6B7280" },
      ],
      activity: [
        { type: "charge.recovered", color: "#22C55E", customer: pick(NAMES), time: "2 mins ago" },
        { type: "subscription.activated", color: "#22C55E", customer: pick(NAMES), time: "5 mins ago" },
        { type: "subscription.past_due", color: "#EAB308", customer: pick(NAMES), time: "12 mins ago" },
        { type: "charge.failed", color: "#EF4444", customer: pick(NAMES), time: "18 mins ago" },
        { type: "subscription.activated", color: "#22C55E", customer: pick(NAMES), time: "31 mins ago" },
        { type: "charge.succeeded", color: "#22C55E", customer: pick(NAMES), time: "45 mins ago" },
      ],
      transactions: storedTransactions,
    };
  },

  async getRevenueTrend() {
    await sleep(150);
    const days = 30;
    const points: RevenuePoint[] = [];
    for (let i = days; i >= 0; i--) {
      const d = daysAgo(i);
      points.push({
        date: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        revenue: randomBetween(40000, 60000),
        recovered: randomBetween(2000, 8000),
        failed: randomBetween(1000, 5000),
      });
    }
    return points;
  },

  async getAtRisk() {
    await sleep(100);
    return storedAtRisk;
  },

  async getDunning() {
    await sleep(200);
    const count = randomBetween(4, 8);
    return Array.from({ length: count }, (_, i) => ({
      id: `dun_${i + 1}`,
      customer: pick(NAMES),
      plan: pick(PLANS),
      reason: pick(REASONS),
      attempt: randomBetween(1, 3),
      maxAttempts: 3,
      nextRetry: i % 3 === 0 ? "—" : formatDateTime(hoursAgo(i * -2)),
      status: i % 3 === 0 ? "SUSPENDED" : "PAST_DUE",
    }));
  },

  async triggerManualRetry(subId: string) {
    await sleep(300);
    return { success: true, message: `Retry triggered for ${subId}` };
  },

  async reactivateSubscription(subId: string) {
    await sleep(300);
    return { success: true, message: `Subscription ${subId} reactivated` };
  },

  async getWebhookEndpoints() {
    await sleep(200);
    const endpoints: WebhookEndpoint[] = [
      {
        id: "ep_1",
        url: "https://api.acme.com/hooks/aegis",
        events: ["charge.succeeded", "charge.failed", "charge.recovered", "subscription.activated"],
        secret: "whsec_9c8f7e6d5a4b3c2d1e0f8a7b6c5d4e3f",
        active: true,
      },
      {
        id: "ep_2",
        url: "https://relay.techcorp.ng/aegis",
        events: ["dunning.started", "subscription.suspended", "plan.changed"],
        secret: "whsec_aa11bb22cc33dd44ee55ff6677889900",
        active: false,
      },
      {
        id: "ep_3",
        url: "https://hooks.startup.io/billing",
        events: ["subscription.activated", "subscription.canceled", "charge.succeeded", "charge.failed"],
        secret: "whsec_11223344556677889900aabbccddeeff",
        active: true,
      },
    ];
    return endpoints;
  },

  async getWebhookDeliveries(endpointId: string) {
    await sleep(150);
    const count = randomBetween(3, 6);
    return Array.from({ length: count }, (_, i) => ({
      id: `del_${i + 1}`,
      url: pick(["https://api.acme.com/hooks/aegis", "https://relay.techcorp.ng/aegis"]),
      event: pick(EVENTS),
      attempts: pick(["Immediate", "Immediate → +5min", "Immediate → +5min → +30min"]),
      lastAttempted: formatDateTime(hoursAgo(i * 12 + 1)),
      status: pick(["delivered", "delivered", "delivered", "retrying", "failed"]) as "delivered" | "failed" | "retrying",
      payload: { id: `evt_${i}`, type: pick(EVENTS), amount: randomBetween(2000, 15000), currency: "NGN" },
    }));
  },

  async createWebhookEndpoint(url: string, events: string[]) {
    await sleep(300);
    return {
      id: `ep_${Date.now()}`,
      url,
      events,
      secret: `whsec_${Math.random().toString(36).slice(2, 20)}`,
      active: true,
    };
  },

  async toggleWebhookEndpoint(id: string, active: boolean) {
    await sleep(200);
    return { success: true };
  },

  async getSubscriptions(params?: {
    status?: string;
    plan?: string;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    page?: number;
    pageSize?: number;
    search?: string;
  }): Promise<SubscriptionListResponse> {
    await sleep(250);
    const {
      status = "All",
      plan = "All",
      sortBy = "createdAt",
      sortDir = "desc",
      page = 1,
      pageSize = 10,
      search = "",
    } = params ?? {};

    const all: Subscription[] = Array.from({ length: 45 }, (_, i) => {
      const name = pick(NAMES);
      const p = pick(PLANS);
      const amounts: Record<string, number> = { Starter: 2000, Premium: 5000, Enterprise: 15000 };
      return {
        id: `sub_${String(i + 1).padStart(2, "0")}`,
        customer: `${i % 2 === 0 ? name : `${pick(NAMES).split("@")[0]}_${i}@${pick(["gmail.com", "outlook.com", "yahoo.com", "tech.ng", "startup.io", "media.ng", "fintech.ng"])}`}`,
        plan: p,
        amount: amounts[p],
        status: pick(STATUSES),
        pulseScore: randomBetween(10, 100),
        currentPeriodStart: formatDate(daysAgo(randomBetween(1, 30))),
        currentPeriodEnd: formatDate(daysAgo(randomBetween(-30, -1))),
        nextCharge: i % 5 === 0 ? "—" : formatDate(hoursAgo(randomBetween(-48, -1))),
        retryCount: randomBetween(0, 3),
        maxRetries: 3,
        createdAt: formatDate(daysAgo(randomBetween(1, 90))),
      };
    });

    let filtered = all;
    if (status !== "All") {
      filtered = filtered.filter((s) => s.status === status);
    }
    if (plan !== "All") {
      filtered = filtered.filter((s) => s.plan === plan);
    }
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter((s) => s.customer.toLowerCase().includes(q));
    }

    const sDir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      if (sortBy === "pulseScore") return (a.pulseScore - b.pulseScore) * sDir;
      if (sortBy === "currentPeriodEnd") return a.currentPeriodEnd.localeCompare(b.currentPeriodEnd) * sDir;
      if (sortBy === "createdAt") return a.createdAt.localeCompare(b.createdAt) * sDir;
      return 0;
    });

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const subscriptions = filtered.slice(start, start + pageSize);

    return { subscriptions, total, page, pageSize };
  },

  // ─── Auth (real API calls) ────────────────────────

  async login(email: string, password: string) {
    return request<{ merchant: Record<string, unknown>; apiKey: string }>('/merchants/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  async register(businessName: string, email: string, password: string) {
    return request<{ merchant: Record<string, unknown>; apiKey: string }>('/merchants/register', {
      method: 'POST',
      body: JSON.stringify({ businessName, email, password }),
    });
  },
};
