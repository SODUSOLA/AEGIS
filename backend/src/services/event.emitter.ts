import { prisma } from '../db/prisma';
import { getOutboundWebhookQueue } from '../queues/queue.registry';
import { JOB_NAMES } from '../queues/queue.definitions';
import { logger } from '../lib/logger';
import crypto from 'crypto';

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

export interface EmitEventOptions {
  merchantId: string;
  subscriptionId: string;
  stateEventType: string;
  metadata?: Record<string, unknown>;
}

export async function emitWebhookEvent(options: EmitEventOptions): Promise<void> {
  const { merchantId, subscriptionId, stateEventType, metadata } = options;

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
