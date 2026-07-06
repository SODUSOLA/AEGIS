import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../../db/redis';
import { QUEUE_NAMES, DunningJobData } from '../queue.definitions';
import { executeCharge } from '../../services/charge.service';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import {
  sendDunningStartedEmail,
  sendRetryScheduledEmail,
  sendUpdateCardEmail,
} from '../../services/notification.service';

// ─── Dunning Worker ─────────────────────────────────

/** Retry delay schedule in hours between consecutive dunning attempts. */
const RETRY_DELAYS_HOURS = [1, 24, 72];

/** Start the dunning worker. Attempts to charge a PAST_DUE subscription and sends notifications. */
export function startDunningWorker(): Worker<DunningJobData> {
  const dunningWorker = new Worker<DunningJobData>(
    QUEUE_NAMES.BILLING_DUNNING,
    async (job: Job<DunningJobData>) => {
      const { subscriptionId, merchantId, retryAttempt } = job.data;

      logger.info('Processing dunning retry job', {
        jobId: job.id,
        subscriptionId,
        merchantId,
        retryAttempt,
      });

      const subscription = await prisma.subscription.findFirst({
        where: { id: subscriptionId, merchantId, isDeleted: false },
        select: {
          id: true,
          status: true,
          retryCount: true,
          lastFailureReason: true,
          plan: { select: { amountKobo: true, name: true } },
          customer: {
            select: {
              id: true,
              email: true,
              name: true,
              phone: true,
              nombaTokenKey: true,
            },
          },
        },
      });

      if (!subscription) {
        logger.warn('Dunning job skipped — subscription not found', { subscriptionId });
        return;
      }

      if (subscription.status !== 'PAST_DUE') {
        logger.info('Dunning job skipped — subscription no longer PAST_DUE', {
          subscriptionId,
          currentStatus: subscription.status,
        });
        return;
      }

      // No payment method — notify customer and give up
      if (!subscription.customer.nombaTokenKey) {
        logger.warn('Dunning job skipped — no payment method on file', { subscriptionId });
        await sendUpdateCardEmail({
          customerEmail: subscription.customer.email,
          customerName: subscription.customer.name ?? undefined,
          planName: subscription.plan.name,
          failureReason: subscription.lastFailureReason ?? 'UNKNOWN',
        });
        return;
      }

      // Send notifications before attempting the charge
      try {
        if (retryAttempt === 1) {
          await sendDunningStartedEmail({
            customerEmail: subscription.customer.email,
            customerName: subscription.customer.name ?? undefined,
            planName: subscription.plan.name,
            amountKobo: subscription.plan.amountKobo,
            nextRetryHours: RETRY_DELAYS_HOURS[0],
          });
        } else {
          const nextDelayHours = RETRY_DELAYS_HOURS[retryAttempt] ?? null;
          if (nextDelayHours) {
            await sendRetryScheduledEmail({
              customerEmail: subscription.customer.email,
              customerName: subscription.customer.name ?? undefined,
              planName: subscription.plan.name,
              amountKobo: subscription.plan.amountKobo,
              attemptNumber: retryAttempt,
              nextRetryHours: nextDelayHours,
            });
          }
        }
      } catch (emailErr) {
        logger.warn('Pre-charge notification failed — continuing with charge', {
          subscriptionId,
          error: emailErr,
        });
      }

      await executeCharge({
        subscriptionId,
        merchantId,
        amountKobo: subscription.plan.amountKobo,
        chargeType: 'RETRY',
        retryAttempt,
        description: `Dunning retry attempt ${retryAttempt} — ${subscription.plan.name}`,
      });

      logger.info('Dunning retry job completed', {
        jobId: job.id,
        subscriptionId,
        retryAttempt,
      });
    },
    {
      connection: getBullMQConnection() as any,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  dunningWorker.on('completed', (job) => {
    logger.info('Dunning worker job completed', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
      retryAttempt: job.data.retryAttempt,
    });
  });

  dunningWorker.on('failed', (job, err) => {
    logger.error('Dunning worker job failed', {
      jobId: job?.id,
      subscriptionId: job?.data.subscriptionId,
      retryAttempt: job?.data.retryAttempt,
      error: err.message,
    });
  });

  logger.info('Dunning worker started', { concurrency: env.WORKER_CONCURRENCY });
  return dunningWorker;
}
