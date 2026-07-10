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

function subStatusColor(s: string): string {
  switch (s) {
    case 'ACTIVE': return '#22C55E';
    case 'TRIALING': return '#3B82F6';
    case 'PAST_DUE': return '#EAB308';
    case 'SUSPENDED': return '#F97316';
    case 'CANCELLED': return '#EF4444';
    case 'EXPIRED': return '#6B7280';
    default: return '#6B7280';
  }
}

function formatAmountKobo(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function toDateLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function toShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function toTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return toShortDate(iso);
}

export const aegis = {
  async getOverview() {
    const raw = await request<{
      mrr: { kobo: number; naira: string; formatted: string };
      subscriptions: { active: number; atRisk: number; suspended: number };
      charges: { failedToday: number; successToday: number };
      webhooks: { deliveryRate: number; totalLast7Days: number; deliveredLast7Days: number };
    }>('/dashboard/overview');

    return {
      metrics: [
        {
          label: 'Active Subscriptions',
          value: raw.subscriptions.active.toLocaleString(),
          trend: `${raw.subscriptions.active + raw.subscriptions.atRisk + raw.subscriptions.suspended} total`,
          trendColor: '#22C55E',
          direction: 'up' as const,
        },
        {
          label: 'MRR',
          value: raw.mrr.formatted,
          trend: `${raw.subscriptions.active} active subs`,
          trendColor: '#22C55E',
          direction: 'up' as const,
        },
        {
          label: 'Failed Charges',
          value: raw.charges.failedToday.toLocaleString(),
          trend: 'today',
          trendColor: '#EF4444',
          direction: 'up' as const,
          sublabel: 'today',
        },
        {
          label: 'Recovered Charges',
          value: raw.charges.successToday.toLocaleString(),
          trend: `${raw.webhooks.deliveryRate}% delivery rate`,
          trendColor: '#94A3B8',
          direction: 'up' as const,
          sublabel: 'today',
        },
      ],
      stateBreakdown: [
        { status: 'ACTIVE', count: raw.subscriptions.active, color: '#22C55E' },
        { status: 'AT RISK', count: raw.subscriptions.atRisk, color: '#EAB308' },
        { status: 'SUSPENDED', count: raw.subscriptions.suspended, color: '#F97316' },
      ],
      activity: [],
      transactions: [],
    };
  },

  async getRevenueTrend(): Promise<RevenuePoint[]> {
    const raw = await request<{ date: string; amountKobo: number; amountNaira: number }[]>('/dashboard/revenue');
    return raw.map((d) => ({
      date: toShortDate(d.date),
      revenue: d.amountNaira,
      recovered: 0,
      failed: 0,
    }));
  },

  async getAtRisk(): Promise<AtRiskSubscription[]> {
    const raw = await request<{
      id: string; status: string; pulseScore: number;
      retryCount: number; currentPeriodEnd: string;
      plan: { name: string }; customer: { name: string; email: string };
    }[]>('/dashboard/at-risk');

    return raw.map((s) => ({
      id: s.id,
      customer: s.customer.name || s.customer.email,
      plan: s.plan.name,
      pulseScore: s.pulseScore,
      status: s.status,
      nextRetry: toDateLabel(s.currentPeriodEnd),
      attempt: s.retryCount || 0,
      maxAttempts: 4,
    }));
  },

  async getDunning() {
    const raw = await request<{
      id: string; status: string; retryCount: number;
      nextRetryAt: string; lastFailureReason: string | null;
      currentPeriodEnd: string; createdAt: string;
      plan: { name: string; amountKobo: number };
      customer: { name: string; email: string };
    }[]>('/dunning');

    return raw.map((s) => ({
      id: s.id,
      customer: s.customer.name || s.customer.email,
      plan: s.plan.name,
      reason: s.lastFailureReason || 'Unknown',
      attempt: s.retryCount,
      maxAttempts: 4,
      nextRetry: s.nextRetryAt ? toDateLabel(s.nextRetryAt) : '—',
      status: s.status,
    })) as DunningSubscription[];
  },

  async triggerManualRetry(subId: string) {
    return request<{ jobId: string }>(`/dunning/${subId}/retry`, { method: 'POST' });
  },

  async reactivateSubscription(subId: string) {
    return request<{ subscriptionId: string; newPeriodEnd: string }>(
      `/dunning/${subId}/reactivate`,
      { method: 'POST', body: JSON.stringify({ reason: 'Manual reactivation by merchant' }) },
    );
  },

  async getWebhookEndpoints(): Promise<WebhookEndpoint[]> {
    const raw = await request<{
      id: string; url: string; subscribedEvents: string[];
      status: string; description: string | null; createdAt: string;
    }[]>('/webhooks/endpoints');

    return raw.map((ep) => ({
      id: ep.id,
      url: ep.url,
      events: ep.subscribedEvents,
      secret: '',
      active: ep.status === 'ACTIVE',
    }));
  },

  async getWebhookDeliveries(endpointId: string): Promise<WebhookDelivery[]> {
    const raw = await request<{
      id: string; eventType: string; status: string;
      attemptCount: number; lastAttemptedAt: string | null;
      responseStatus: number | null; createdAt: string;
    }[]>(`/webhooks/endpoints/${endpointId}/deliveries`);

    return raw.map((d) => {
      const statusMap: Record<string, 'delivered' | 'failed' | 'retrying'> = {
        DELIVERED: 'delivered', FAILED: 'failed', RETRYING: 'retrying', PENDING: 'retrying',
      };
      const attemptLabel =
        d.attemptCount === 1 ? 'Immediate' :
        d.attemptCount === 2 ? 'Immediate → +5min' :
        d.attemptCount === 3 ? 'Immediate → +5min → +30min' :
        `${d.attemptCount} attempts`;

      return {
        id: d.id,
        url: '',
        event: d.eventType,
        attempts: attemptLabel,
        lastAttempted: d.lastAttemptedAt ? toTimeAgo(d.lastAttemptedAt) : '—',
        status: statusMap[d.status] || 'retrying',
        payload: { eventType: d.eventType, responseStatus: d.responseStatus },
      };
    });
  },

  async createWebhookEndpoint(url: string, events: string[]) {
    return request<{
      id: string; url: string; secret: string;
      subscribedEvents: string[]; status: string;
    }>('/webhooks/endpoints', {
      method: 'POST',
      body: JSON.stringify({ url, subscribedEvents: events }),
    });
  },

  async toggleWebhookEndpoint(id: string, active: boolean) {
    await request<unknown>(`/webhooks/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: active ? 'ACTIVE' : 'DISABLED' }),
    });
  },

  async getSubscriptions(params?: {
    status?: string; plan?: string; sortBy?: string;
    sortDir?: 'asc' | 'desc'; page?: number; pageSize?: number; search?: string;
  }): Promise<SubscriptionListResponse> {
    const {
      status: rawStatus, sortBy = 'createdAt',
      sortDir = 'desc', page = 1, pageSize = 10,
    } = params ?? {};

    const qs = new URLSearchParams();
    qs.set('page', String(page));
    qs.set('limit', String(pageSize));
    if (rawStatus && rawStatus !== 'All') qs.set('status', rawStatus);
    qs.set('sortBy', sortBy === 'currentPeriodEnd' ? 'currentPeriodEnd' : sortBy === 'pulseScore' ? 'pulseScore' : 'createdAt');
    qs.set('sortOrder', sortDir);

    const raw = await request<{
      id: string; status: string; pulseScore: number;
      retryCount: number; currentPeriodEnd: string; createdAt: string;
      plan: { name: string; amountKobo: number; interval: string };
      customer: { name: string; email: string };
    }[]>(`/dashboard/subscriptions?${qs}`);

    const subs: Subscription[] = raw.map((s) => ({
      id: s.id,
      customer: s.customer.name || s.customer.email,
      plan: s.plan.name,
      amount: s.plan.amountKobo,
      status: s.status,
      pulseScore: s.pulseScore,
      currentPeriodStart: '',
      currentPeriodEnd: toDateLabel(s.currentPeriodEnd),
      nextCharge: toDateLabel(s.currentPeriodEnd),
      retryCount: s.retryCount,
      maxRetries: 4,
      createdAt: toDateLabel(s.createdAt),
    }));

    return { subscriptions: subs, total: subs.length, page, pageSize };
  },

  // ─── Plans ──────────────────────────────────────────

  async getPlans() {
    const raw = await request<{
      id: string; name: string; description: string | null;
      amountKobo: number; currency: string; interval: string;
      intervalDays: number | null; isActive: boolean; createdAt: string;
    }[]>('/plans');

    return raw.map((p) => ({
      id: p.id,
      name: p.name,
      amount: p.amountKobo / 100,
      interval: (p.interval === 'WEEKLY' ? 'Weekly' as const :
                 p.interval === 'MONTHLY' ? 'Monthly' as const :
                 p.interval === 'YEARLY' ? 'Yearly' as const : 'Custom' as const),
      subscribers: 0,
      created: toDateLabel(p.createdAt),
    }));
  },

  async createPlan(data: { name: string; amountKobo: number; currency: string; interval: string; intervalDays?: number }) {
    return request<{ id: string; name: string; amountKobo: number; currency: string; interval: string }>('/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // ─── Auth ───────────────────────────────────────────

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
