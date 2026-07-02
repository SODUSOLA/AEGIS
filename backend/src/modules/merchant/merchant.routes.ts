import { Router } from 'express';
import { handleRegisterMerchant, handleGetMerchantProfile } from './merchant.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

const router = Router();

router.post('/register', handleRegisterMerchant);

router.get('/me', authMiddleware, handleGetMerchantProfile);

export default router;
