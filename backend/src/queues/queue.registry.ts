import { Queue } from 'bullmq';
import { getBullMQConnection } from '../db/redis';
import { QUEUE_NAMES } from './queue.definitions';
import { logger } from '../lib/logger';

// ─── Lazy Singleton References ──────────────────────

let _schedulerQueue: Queue | null = null;
let _renewalQueue: Queue | null = null;
let _proratedChargeQueue: Queue | null = null;
let _dunningQueue: Queue | null = null;
let _outboundWebhookQueue: Queue | null = null;

// ─── Default Job Options ────────────────────────────

const BILLING_JOB_OPTIONS = {
  removeOnComplete: { count: 1000, age: 60 * 60 * 24 * 7 },
  removeOnFail: { count: 2000, age: 60 * 60 * 24 * 30 },
};

// ─── Queue Factory ──────────────────────────────────

function createQueue(name: string): Queue {
  logger.info(`Initializing BullMQ queue: ${name}`);
  return new Queue(name, {
    connection: getBullMQConnection() as any,
    defaultJobOptions: BILLING_JOB_OPTIONS,
  });
}

// ─── Queue Accessors ────────────────────────────────

/** Get or create the billing scheduler queue singleton. */
export function getSchedulerQueue(): Queue {
  if (!_schedulerQueue) _schedulerQueue = createQueue(QUEUE_NAMES.BILLING_SCHEDULER);
  return _schedulerQueue;
}

/** Get or create the billing renewal queue singleton. */
export function getRenewalQueue(): Queue {
  if (!_renewalQueue) _renewalQueue = createQueue(QUEUE_NAMES.BILLING_RENEWAL);
  return _renewalQueue;
}

/** Get or create the billing proration queue singleton. */
export function getProratedChargeQueue(): Queue {
  if (!_proratedChargeQueue)
    _proratedChargeQueue = createQueue(QUEUE_NAMES.BILLING_PRORATION);
  return _proratedChargeQueue;
}

/** Get or create the dunning retry queue singleton. */
export function getDunningQueue(): Queue {
  if (!_dunningQueue) _dunningQueue = createQueue(QUEUE_NAMES.BILLING_DUNNING);
  return _dunningQueue;
}

/** Get or create the outbound webhook delivery queue singleton. */
export function getOutboundWebhookQueue(): Queue {
  if (!_outboundWebhookQueue)
    _outboundWebhookQueue = createQueue(QUEUE_NAMES.WEBHOOK_OUTBOUND);
  return _outboundWebhookQueue;
}

// ─── Shutdown ───────────────────────────────────────

/** Gracefully close all queue connections — used during application shutdown. */
export async function closeAllQueues(): Promise<void> {
  await Promise.allSettled([
    _schedulerQueue?.close(),
    _renewalQueue?.close(),
    _proratedChargeQueue?.close(),
    _dunningQueue?.close(),
    _outboundWebhookQueue?.close(),
  ]);
  logger.info('All BullMQ queues closed');
}
