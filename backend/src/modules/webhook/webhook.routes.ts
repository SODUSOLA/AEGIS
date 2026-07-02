import { Router, Request, Response } from 'express';
import { logger } from '../../lib/logger';
import { env } from '../../config/env';
import { verifyNombaWebhookSignature } from '../../integrations/nomba/nomba.webhook';
import { NombaWebhookPayload } from '../../integrations/nomba/nomba.types';

const router = Router();

router.post('/nomba', (req: Request, res: Response) => {
  const nombaSignature = req.headers['nomba-signature'] as string;
  const nombaTimestamp = req.headers['nomba-timestamp'] as string;

  if (!nombaSignature || !nombaTimestamp) {
    logger.warn('Nomba webhook received without required headers', {
      hasSignature: !!nombaSignature,
      hasTimestamp: !!nombaTimestamp,
    });
    return res.status(200).json({ received: true });
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
    return res.status(200).json({ received: true });
  }

  logger.info('Nomba webhook verified and received', {
    eventType: payload.event_type,
    requestId: payload.requestId,
  });

  return res.status(200).json({ received: true });
});

export default router;
