// src/modules/webhook/webhook.routes.ts  (new file)
import { Router, Request, Response } from 'express';
import { logger } from '../../lib/logger';

const router = Router();

/**
 * POST /api/v1/webhooks/nomba
 * Stub endpoint — accepts and acknowledges all Nomba webhook deliveries.
 * Full signature verification and processing built in Phase 5.
 */
router.post('/nomba', (req: Request, res: Response) => {
    logger.info('Nomba webhook received (stub)', {
        eventType: req.body?.event_type,
        requestId: req.body?.requestId,
    });
    res.status(200).json({ received: true });
});

export default router;