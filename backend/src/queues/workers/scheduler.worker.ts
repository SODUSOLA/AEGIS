import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../../db/redis';
import { getSchedulerQueue, getRenewalQueue } from '../queue.registry';
import { QUEUE_NAMES, JOB_NAMES } from '../queue.definitions';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

// ─── Scheduler Worker ───────────────────────────────

const BATCH_SIZE = 100;

/** Start the billing scheduler worker. Scans for due subscriptions and enqueues renewal jobs. */
export function startSchedulerWorker(): Worker {
  const schedulerWorker = new Worker(
    QUEUE_NAMES.BILLING_SCHEDULER,
    async (_job: Job) => {
      logger.info('Billing scheduler triggered — scanning for due subscriptions');

      const now = new Date();

      // Fetch ACTIVE/TRIALING subscriptions whose period has ended
      const dueSubscriptions = await prisma.subscription.findMany({
        where: {
          isDeleted: false,
          status: { in: ['ACTIVE', 'TRIALING'] },
          currentPeriodEnd: { lte: now },
        },
        select: {
          id: true,
          merchantId: true,
          status: true,
          currentPeriodEnd: true,
        },
        take: BATCH_SIZE,
        orderBy: { currentPeriodEnd: 'asc' },
      });

      if (dueSubscriptions.length === 0) {
        logger.info('Scheduler: no due subscriptions found');
        return;
      }

      logger.info(`Scheduler: found ${dueSubscriptions.length} due subscriptions — enqueuing`);

      const renewalQueue = getRenewalQueue();

      await renewalQueue.addBulk(
        dueSubscriptions.map((sub) => ({
          name: JOB_NAMES.PROCESS_RENEWAL_CHARGE,
          data: {
            subscriptionId: sub.id,
            merchantId: sub.merchantId,
          },
          opts: {
            jobId: `renewal-${sub.id}-${sub.currentPeriodEnd.getTime()}`,
            attempts: 2,
            backoff: { type: 'exponential', delay: 5000 },
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 500 },
          },
        })),
      );

      logger.info(`Scheduler: enqueued ${dueSubscriptions.length} renewal jobs`);
    },
    {
      connection: getBullMQConnection() as any,
      concurrency: 1,
    },
  );

  schedulerWorker.on('failed', (job, err) => {
    logger.error('Scheduler worker job failed', {
      jobId: job?.id,
      error: err.message,
      stack: err.stack,
    });
  });

  logger.info('Billing scheduler worker started');
  return schedulerWorker;
}

// ─── Cron Registration ──────────────────────────────

/** Register the recurring cron job that triggers the scheduler at a configurable interval. */
export async function registerBillingCronJob(): Promise<void> {
  const schedulerQueue = getSchedulerQueue();

  const intervalSeconds = env.SCHEDULER_INTERVAL_SECONDS;

  // Remove any previously registered repeatable jobs to avoid duplicates on restart
  const existingRepeatables = await schedulerQueue.getRepeatableJobs();
  for (const job of existingRepeatables) {
    await schedulerQueue.removeRepeatableByKey(job.key);
  }

  await schedulerQueue.add(
    JOB_NAMES.EVALUATE_DUE_SUBSCRIPTIONS,
    {},
    {
      repeat: {
        every: intervalSeconds * 1000,
      },
      removeOnComplete: { count: 50 },
      removeOnFail: { count: 100 },
    },
  );

  logger.info('Billing cron job registered', {
    intervalSeconds,
    nextRunApprox: new Date(Date.now() + intervalSeconds * 1000).toISOString(),
  });
}
