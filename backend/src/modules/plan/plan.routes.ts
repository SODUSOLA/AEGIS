import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  handleCreatePlan,
  handleListPlans,
  handleGetPlan,
  handleUpdatePlan,
  handleArchivePlan,
} from './plan.controller';

const router = Router();

// All plan routes require API key authentication.
router.use(authMiddleware);

router.post('/', handleCreatePlan);
router.get('/', handleListPlans);
router.get('/:id', handleGetPlan);
router.patch('/:id', handleUpdatePlan);
router.delete('/:id', handleArchivePlan);

export default router;
