import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../../db/redis';
import { QUEUE_NAMES, RenewalJobData } from '../queue.definitions';
import { executeCharge } from '../../services/charge.service';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { calculatePeriodEnd } from '../../lib/billing.utils';

export function startRenewalWorker(): Worker<RenewalJobData> {
  const renewalWorker = new Worker<RenewalJobData>(
    QUEUE_NAMES.BILLING_RENEWAL,
    async (job: Job<RenewalJobData>) => {
      const { subscriptionId, merchantId } = job.data;

      logger.info('Processing renewal charge job', {
        jobId: job.id,
        subscriptionId,
        merchantId,
        attempt: job.attemptsMade,
      });

      const subscription = await prisma.subscription.findFirst({
        where: { id: subscriptionId, merchantId, isDeleted: false },
        select: {
          id: true,
          status: true,
          balanceCreditKobo: true,
          plan: {
            select: { amountKobo: true, name: true, interval: true, intervalDays: true },
          },
        },
      });

      if (!subscription) {
        logger.warn('Renewal job skipped — subscription not found', {
          subscriptionId,
          jobId: job.id,
        });
        return;
      }

      const isStillBillable = ['ACTIVE', 'TRIALING'].includes(subscription.status);
      if (!isStillBillable) {
        logger.info('Renewal job skipped — subscription no longer in billable state', {
          subscriptionId,
          status: subscription.status,
        });
        return;
      }

      const rawAmountKobo = subscription.plan.amountKobo;
      const creditKobo = subscription.balanceCreditKobo ?? 0;
      const chargeAmountKobo = Math.max(0, rawAmountKobo - creditKobo);

      if (chargeAmountKobo === 0 && creditKobo > 0) {
        logger.info('Renewal covered by existing credit balance — skipping Nomba charge', {
          subscriptionId,
          creditKobo,
        });

        const now = new Date();

        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            currentPeriodStart: now,
            currentPeriodEnd: calculatePeriodEnd(
              now,
              subscription.plan.interval as any,
              subscription.plan.intervalDays,
            ),
            balanceCreditKobo: creditKobo - rawAmountKobo,
            retryCount: 0,
            nextRetryAt: null,
          },
        });

        return;
      }

      await executeCharge({
        subscriptionId,
        merchantId,
        amountKobo: chargeAmountKobo,
        chargeType: 'RENEWAL',
        retryAttempt: 0,
        description: `Subscription renewal — ${subscription.plan.name}`,
      });

      if (creditKobo > 0) {
        await prisma.subscription.update({
          where: { id: subscriptionId },
          data: { balanceCreditKobo: 0 },
        });
      }
    },
    {
      connection: getBullMQConnection() as any,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  renewalWorker.on('completed', (job) => {
    logger.info('Renewal job completed', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
    });
  });

  renewalWorker.on('failed', (job, err) => {
    logger.error('Renewal job failed', {
      jobId: job?.id,
      subscriptionId: job?.data.subscriptionId,
      attempt: job?.attemptsMade,
      error: err.message,
    });
  });

  logger.info('Renewal worker started', { concurrency: env.WORKER_CONCURRENCY });
  return renewalWorker;
}
