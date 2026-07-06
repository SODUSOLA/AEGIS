import { Router, Request, Response } from 'express';
import { logger } from '../../../lib/logger';
import { env } from '../../../config/env';
import {
  verifyNombaWebhookSignature,
} from '../../../integrations/nomba/nomba.webhook';
import { NombaWebhookPayload } from '../../../integrations/nomba/nomba.types';
import { prisma } from '../../../db/prisma';
import { processNombaWebhook } from './inbound.processor';

const router = Router();

router.post('/nomba', async (req: Request, res: Response) => {
  const nombaSignature = req.headers['nomba-signature'] as string;
  const nombaTimestamp = req.headers['nomba-timestamp'] as string;
  const requestId = req.body?.requestId as string;

  if (!nombaSignature || !nombaTimestamp) {
    logger.warn('Nomba webhook missing required headers', {
      hasSignature: !!nombaSignature,
      hasTimestamp: !!nombaTimestamp,
    });
    res.status(200).json({ received: true });
    return;
  }

  const payload = req.body as NombaWebhookPayload;

  const isValid = verifyNombaWebhookSignature(
    payload,
    nombaSignature,
    nombaTimestamp,
    env.NOMBA_WEBHOOK_SECRET,
  );

  if (!isValid) {
    logger.warn('Nomba webhook signature verification failed', {
      eventType: payload?.event_type,
      requestId: payload?.requestId,
    });
    res.status(200).json({ received: true });
    return;
  }

  if (requestId) {
    try {
      const existing = await prisma.inboundWebhookLog.findUnique({
        where: { nombaEventId: requestId },
        select: { id: true, processed: true },
      });

      if (existing) {
        logger.info('Nomba webhook deduplicated — already processed', {
          requestId,
          previouslyProcessed: existing.processed,
        });
        res.status(200).json({ received: true });
        return;
      }

      await prisma.inboundWebhookLog.create({
        data: {
          nombaEventId: requestId,
          eventType: payload.event_type,
          payload: payload as any,
          processed: false,
        },
      });
    } catch (logError) {
      logger.error('Failed to write InboundWebhookLog — processing anyway', {
        requestId,
        error: logError,
      });
    }
  }

  res.status(200).json({ received: true });

  setImmediate(async () => {
    try {
      await processNombaWebhook(payload);

      if (requestId) {
        await prisma.inboundWebhookLog.update({
          where: { nombaEventId: requestId },
          data: { processed: true, processedAt: new Date() },
        });
      }
    } catch (processingError) {
      logger.error('Nomba webhook processing failed', {
        eventType: payload.event_type,
        requestId: payload.requestId,
        error: processingError instanceof Error
          ? processingError.message
          : 'Unknown error',
      });

      if (requestId) {
        try {
          await prisma.inboundWebhookLog.update({
            where: { nombaEventId: requestId },
            data: {
              processed: false,
              error: processingError instanceof Error
                ? processingError.message
                : 'Unknown processing error',
            },
          });
        } catch (_) {}
      }
    }
  });
});

export default router;
