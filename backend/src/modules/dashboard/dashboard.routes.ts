import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  handleGetOverview,
  handleGetRevenueTrend,
  handleGetAtRisk,
  handleGetSubscriptionBoard,
} from './dashboard.controller';

// ─── Dashboard Routes ───────────────────────────────

const router = Router();
router.use(authMiddleware);

router.get('/overview', handleGetOverview);
router.get('/revenue', handleGetRevenueTrend);
router.get('/at-risk', handleGetAtRisk);
router.get('/subscriptions', handleGetSubscriptionBoard);

export default router;
