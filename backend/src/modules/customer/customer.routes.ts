import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.middleware';
import {handleCreateCustomer, handleListCustomers, handleGetCustomer, handleUpdateCustomer, handleUpdatePaymentMethod, handleDeleteCustomer} from './customer.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', handleCreateCustomer); // route to create customers
router.get('/', handleListCustomers); // route to list all cutomers
router.get('/:id', handleGetCustomer); // route to gwt single custo,er by id
router.patch('/:id', handleUpdateCustomer); // route to update customer profile
router.patch('/:id/payment-method', handleUpdatePaymentMethod); // route to update cutomer payment method
router.delete('/:id', handleDeleteCustomer); // route to delete customer account (soft-delete)

export default router;
