import { prisma } from '../db/prisma';
import { getOutboundWebhookQueue } from '../queues/queue.registry';
import { JOB_NAMES } from '../queues/queue.definitions';
import { logger } from '../lib/logger';
import crypto from 'crypto';

// ─── Event Definitions ────────────────────────────────

/** All AEGIS webhook event types that merchant endpoints can subscribe to. */
export const AEGIS_EVENT_TYPES = [
  'subscription.activated',
  'subscription.past_due',
  'subscription.suspended',
  'subscription.cancelled',
  'subscription.expired',
  'charge.succeeded',
  'charge.failed',
  'charge.recovered',
  'dunning.started',
  'plan.changed',
] as const;

export type AegisEventType = (typeof AEGIS_EVENT_TYPES)[number];

// ─── Event Mapping ────────────────────────────────────

/**
 * Maps internal subscription state-machine events to public AEGIS event types.
 * Events mapped to `null` are internal-only and do not trigger webhooks.
 */
const STATE_EVENT_TO_AEGIS_EVENT: Record<string, AegisEventType | null> = {
  SUBSCRIPTION_ACTIVATED:            'subscription.activated',
  TRIAL_ENDED_ACTIVATED:             'subscription.activated',
  RENEWAL_PAYMENT_FAILED:            'subscription.past_due',
  RETRY_PAYMENT_FAILED:              'subscription.past_due',
  DUNNING_EXHAUSTED:                 'subscription.suspended',
  CANCELLED_BY_MERCHANT_OR_CUSTOMER: 'subscription.cancelled',
  CANCELLED_DURING_TRIAL:            'subscription.cancelled',
  CANCELLED_WHILE_PAST_DUE:          'subscription.cancelled',
  CANCELLED_WHILE_SUSPENDED:         'subscription.cancelled',
  SUBSCRIPTION_EXPIRED:              'subscription.expired',
  PAYMENT_RECOVERED:                 'charge.recovered',
  MANUALLY_REACTIVATED:              'subscription.activated',
  PLAN_CHANGED:                      'plan.changed',
  MANUAL_RETRY_TRIGGERED:            null,
  SUBSCRIPTION_TRIALING_STARTED:     null,
};

// ─── Emit Options ─────────────────────────────────────

export interface EmitEventOptions {
  merchantId: string;
  subscriptionId: string;
  stateEventType: string;
  metadata?: Record<string, unknown>;
}

// ─── Public API ───────────────────────────────────────

/**
 * Dispatches a webhook event to all active merchant endpoints subscribed to the
 * mapped AEGIS event type. Creates a delivery record and enqueues each delivery
 * to the outbound webhook queue. Failures are logged but never thrown — the
 * state transition that triggered the event is already committed.
 */
export async function emitWebhookEvent(options: EmitEventOptions): Promise<void> {
  const { merchantId, subscriptionId, stateEventType, metadata } = options;

  // Resolve internal state event → public AEGIS event; skip if null (internal-only)
  const aegisEventType = STATE_EVENT_TO_AEGIS_EVENT[stateEventType];

  if (!aegisEventType) {
    return;
  }

  try {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: {
        id: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        retryCount: true,
        plan: {
          select: { id: true, name: true, amountKobo: true, currency: true, interval: true },
        },
        customer: {
          select: { id: true, email: true, name: true },
        },
      },
    });

    if (!subscription) {
      logger.warn('emitWebhookEvent: subscription not found', { subscriptionId });
      return;
    }

    // Fetch all active endpoints that subscribe to this event type
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        merchantId,
        isDeleted: false,
        status: 'ACTIVE',
        subscribedEvents: { has: aegisEventType },
      },
      select: { id: true, url: true, secret: true },
    });

    if (endpoints.length === 0) {
      logger.debug('No webhook endpoints subscribed to event', {
        merchantId,
        aegisEventType,
      });
      return;
    }

    // Build the shared event payload
    const eventId = `evt_${crypto.randomUUID()}`;
    const eventPayload = {
      id: eventId,
      type: aegisEventType,
      createdAt: new Date().toISOString(),
      data: {
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodStart: subscription.currentPeriodStart,
          currentPeriodEnd: subscription.currentPeriodEnd,
          retryCount: subscription.retryCount,
        },
        plan: subscription.plan,
        customer: subscription.customer,
        ...metadata,
      },
    };

    const queue = getOutboundWebhookQueue();

    // Fan out: one delivery per subscribed endpoint
    for (const endpoint of endpoints) {
      const deliveryId = `del_${crypto.randomUUID()}`;

      await prisma.webhookDelivery.create({
        data: {
          id: deliveryId,
          endpointId: endpoint.id,
          eventId,
          eventType: aegisEventType,
          payload: eventPayload as any,
          status: 'PENDING',
          attemptCount: 0,
        },
      });

      await queue.add(
        JOB_NAMES.DELIVER_WEBHOOK,
        {
          deliveryId,
          endpointId: endpoint.id,
          endpointUrl: endpoint.url,
          endpointSecret: endpoint.secret,
          eventType: aegisEventType,
          payload: eventPayload,
        },
        {
          attempts: 1,
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 500 },
        },
      );

      logger.info('Outbound webhook delivery enqueued', {
        merchantId,
        deliveryId,
        eventId,
        aegisEventType,
        endpointId: endpoint.id,
      });
    }
  } catch (error) {
    logger.error('emitWebhookEvent failed — state transition is unaffected', {
      merchantId,
      subscriptionId,
      aegisEventType,
      error: error instanceof Error ? error.message : 'Unknown',
    });
  }
}
