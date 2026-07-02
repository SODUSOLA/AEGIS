import { Worker } from 'bullmq';
import { startSchedulerWorker, registerBillingCronJob } from '../queues/workers/scheduler.worker';
import { startRenewalWorker } from '../queues/workers/renewal.worker';
import { startProrationWorker } from '../queues/workers/proration.worker';
import { logger } from '../lib/logger';

let _workers: Worker[] = [];

export async function startAllWorkers(): Promise<void> {
  logger.info('Starting AEGIS background workers...');

  try {
    const schedulerWorker = startSchedulerWorker();
    const renewalWorker = startRenewalWorker();
    const prorationWorker = startProrationWorker();

    _workers = [schedulerWorker, renewalWorker, prorationWorker];

    await registerBillingCronJob();

    logger.info('All background workers started successfully', {
      workerCount: _workers.length,
    });
  } catch (error) {
    logger.error('Failed to start workers', { error });
    throw error;
  }
}

export async function stopAllWorkers(): Promise<void> {
  logger.info('Stopping all background workers...');

  await Promise.allSettled(
    _workers.map((worker) =>
      worker.close().catch((err) =>
        logger.error('Error closing worker', { worker: worker.name, err: String(err) }),
      ),
    ),
  );

  logger.info('All workers stopped');
}
