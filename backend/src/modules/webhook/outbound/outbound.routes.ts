import { Router } from 'express';
import { authMiddleware } from '../../../middleware/auth.middleware';
import {
  handleCreateEndpoint,
  handleListEndpoints,
  handleGetEndpoint,
  handleUpdateEndpoint,
  handleDeleteEndpoint,
  handleListDeliveries,
} from './outbound.controller';

// ─── Outbound Webhook Routes ─────────────────────────

const router = Router();
router.use(authMiddleware);

router.post('/endpoints', handleCreateEndpoint);
router.get('/endpoints', handleListEndpoints);
router.get('/endpoints/:id', handleGetEndpoint);
router.patch('/endpoints/:id', handleUpdateEndpoint);
router.delete('/endpoints/:id', handleDeleteEndpoint);
router.get('/endpoints/:id/deliveries', handleListDeliveries);

export default router;
