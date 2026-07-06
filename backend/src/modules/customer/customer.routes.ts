import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {
  handleCreateCustomer,
  handleListCustomers,
  handleGetCustomer,
  handleUpdateCustomer,
  handleUpdatePaymentMethod,
  handleDeleteCustomer,
} from './customer.controller';

const router = Router();

// All customer routes require API key authentication.
router.use(authMiddleware);

router.post('/', handleCreateCustomer);
router.get('/', handleListCustomers);
router.get('/:id', handleGetCustomer);
router.patch('/:id', handleUpdateCustomer);
router.patch('/:id/payment-method', handleUpdatePaymentMethod);
router.delete('/:id', handleDeleteCustomer);

export default router;
