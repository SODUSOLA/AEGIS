import { Router } from 'express';
import { handleRegisterMerchant, handleGetMerchantProfile } from './merchant.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

// ─── Router ────────────────────────────────────────

const router = Router();

/** POST /register — open registration (no auth required). */
router.post('/register', handleRegisterMerchant);

/** GET /me — fetch own profile (requires API key authentication). */
router.get('/me', authMiddleware, handleGetMerchantProfile);

export default router;
