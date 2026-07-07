import { Router } from 'express';
import { handleRegisterMerchant, handleLoginMerchant, handleGetMerchantProfile } from './merchant.controller';
import { authMiddleware } from '../../middleware/auth.middleware';

// ─── Router ────────────────────────────────────────

const router = Router();

/** POST /register — open registration (no auth required). */
router.post('/register', handleRegisterMerchant);

/** POST /login — authenticate via email + password, returns a fresh API key. */
router.post('/login', handleLoginMerchant);

/** GET /me — fetch own profile (requires API key authentication). */
router.get('/me', authMiddleware, handleGetMerchantProfile);

export default router;
