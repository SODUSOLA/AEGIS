import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  handleListDunning,
  handleGetDunningDetail,
  handleManualRetry,
  handleManualReactivate,
} from './dunning.controller';

// ─── Dunning Routes ──────────────────────────────────

const router = Router();
router.use(authMiddleware);

router.get('/', handleListDunning);
router.get('/:subscriptionId', handleGetDunningDetail);
router.post('/:subscriptionId/retry', handleManualRetry);
router.post('/:subscriptionId/reactivate', handleManualReactivate);

export default router;
