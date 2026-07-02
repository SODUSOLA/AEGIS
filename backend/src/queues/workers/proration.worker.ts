import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../../db/redis';
import { QUEUE_NAMES, ProrationJobData } from '../queue.definitions';
import { executeCharge } from '../../services/charge.service';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';

export function startProrationWorker(): Worker<ProrationJobData> {
  const prorationWorker = new Worker<ProrationJobData>(
    QUEUE_NAMES.BILLING_PRORATION,
    async (job: Job<ProrationJobData>) => {
      const { subscriptionId, merchantId, adjustmentKobo, newPlanId } = job.data;

      logger.info('Processing proration charge job', {
        jobId: job.id,
        subscriptionId,
        adjustmentKobo,
        newPlanId,
      });

      if (adjustmentKobo <= 0) {
        logger.info('Proration job skipped — no charge required (downgrade or no-op)', {
          subscriptionId,
          adjustmentKobo,
        });
        return;
      }

      await executeCharge({
        subscriptionId,
        merchantId,
        amountKobo: adjustmentKobo,
        chargeType: 'PRORATION',
        retryAttempt: 0,
        description: 'Plan upgrade — prorated adjustment',
      });
    },
    {
      connection: getBullMQConnection() as any,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  prorationWorker.on('completed', (job) => {
    logger.info('Proration job completed', {
      jobId: job.id,
      subscriptionId: job.data.subscriptionId,
    });
  });

  prorationWorker.on('failed', (job, err) => {
    logger.error('Proration job failed', {
      jobId: job?.id,
      subscriptionId: job?.data.subscriptionId,
      error: err.message,
    });
  });

  logger.info('Proration worker started', { concurrency: env.WORKER_CONCURRENCY });
  return prorationWorker;
}
