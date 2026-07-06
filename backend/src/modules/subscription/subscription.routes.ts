import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  handleCreateSubscription,
  handleListSubscriptions,
  handleGetSubscription,
  handleCancelSubscription,
  handleChangePlan,
} from './subscription.controller';

const router = Router();

// All subscription routes require API key authentication.
router.use(authMiddleware);

router.post('/', handleCreateSubscription);
router.get('/', handleListSubscriptions);
router.get('/:id', handleGetSubscription);
router.post('/:id/cancel', handleCancelSubscription);
router.post('/:id/change-plan', handleChangePlan);

export default router;
