import { Worker, Job } from 'bullmq';
import { getBullMQConnection } from '../../db/redis';
import { QUEUE_NAMES } from '../queue.definitions';
import { prisma } from '../../db/prisma';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { buildDeliveryHeaders } from '../../modules/webhook/outbound/outbound.signer';

const RETRY_DELAYS_MS = [
  0,
  5 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
];

interface WebhookDeliveryJobData {
  deliveryId: string;
  endpointId: string;
  endpointUrl: string;
  endpointSecret: string;
  eventType: string;
  payload: Record<string, unknown>;
}

const DELIVERY_TIMEOUT_MS = 10_000;

export function startWebhookDeliveryWorker(): Worker<WebhookDeliveryJobData> {
  const worker = new Worker<WebhookDeliveryJobData>(
    QUEUE_NAMES.WEBHOOK_OUTBOUND,
    async (job: Job<WebhookDeliveryJobData>) => {
      const {
        deliveryId,
        endpointUrl,
        endpointSecret,
        eventType,
        payload,
      } = job.data;

      const delivery = await prisma.webhookDelivery.findUnique({
        where: { id: deliveryId },
        select: { id: true, status: true, attemptCount: true },
      });

      if (!delivery) {
        logger.warn('Delivery job skipped — delivery record not found', { deliveryId });
        return;
      }

      if (delivery.status === 'DELIVERED') {
        logger.info('Delivery job skipped — already delivered', { deliveryId });
        return;
      }

      const rawBody = JSON.stringify(payload);
      const headers = buildDeliveryHeaders(rawBody, endpointSecret, eventType, deliveryId);

      const attemptNumber = delivery.attemptCount + 1;

      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: attemptNumber > 1 ? 'RETRYING' : 'PENDING',
          attemptCount: attemptNumber,
          lastAttemptedAt: new Date(),
        },
      });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      let responseStatus: number | null = null;
      let responseBody: string | null = null;
      let deliverySucceeded = false;

      try {
        const response = await fetch(endpointUrl, {
          method: 'POST',
          headers,
          body: rawBody,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        responseStatus = response.status;
        responseBody = await response.text().catch(() => null);

        deliverySucceeded = response.status >= 200 && response.status < 300;

        logger.info('Webhook delivery attempt completed', {
          deliveryId,
          endpointUrl,
          responseStatus,
          success: deliverySucceeded,
          attemptNumber,
        });
      } catch (fetchError) {
        clearTimeout(timeoutId);
        const message = fetchError instanceof Error ? fetchError.message : 'Network error';
        responseBody = message;

        logger.warn('Webhook delivery attempt failed — network error', {
          deliveryId,
          endpointUrl,
          error: message,
          attemptNumber,
        });
      }

      if (deliverySucceeded) {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'DELIVERED',
            responseStatus,
            responseBody: responseBody?.substring(0, 500) ?? null,
          },
        });
        return;
      }

      const maxAttempts = env.WEBHOOK_MAX_DELIVERY_ATTEMPTS;

      if (attemptNumber < maxAttempts) {
        const delayMs = RETRY_DELAYS_MS[attemptNumber] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
        const nextAttemptAt = new Date(Date.now() + delayMs);

        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'RETRYING',
            responseStatus,
            responseBody: responseBody?.substring(0, 500) ?? null,
            nextAttemptAt,
          },
        });

        const { getOutboundWebhookQueue } = await import('../queue.registry');
        await getOutboundWebhookQueue().add(
          'deliver-webhook',
          job.data,
          {
            delay: delayMs,
            attempts: 1,
            removeOnComplete: { count: 1000 },
            removeOnFail: { count: 500 },
          },
        );

        logger.info('Webhook delivery retry scheduled', {
          deliveryId,
          attemptNumber,
          nextAttemptAt: nextAttemptAt.toISOString(),
          delayMs,
        });
      } else {
        await prisma.webhookDelivery.update({
          where: { id: deliveryId },
          data: {
            status: 'FAILED',
            responseStatus,
            responseBody: responseBody?.substring(0, 500) ?? null,
            nextAttemptAt: null,
          },
        });

        logger.warn('Webhook delivery permanently failed after max attempts', {
          deliveryId,
          endpointUrl,
          totalAttempts: attemptNumber,
        });
      }
    },
    {
      connection: getBullMQConnection() as any,
      concurrency: env.WORKER_CONCURRENCY,
    },
  );

  worker.on('failed', (job, err) => {
    logger.error('Webhook delivery worker job threw unexpectedly', {
      jobId: job?.id,
      deliveryId: job?.data.deliveryId,
      error: err.message,
    });
  });

  logger.info('Webhook delivery worker started');
  return worker;
}
