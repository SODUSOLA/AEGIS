import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma';
import { successResponse, errorResponse } from '../lib/response';

const router = Router();

/** GET /health — returns 200 with database status, or 503 if the DB is unreachable. */
router.get('/', async (_req: Request, res: Response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json(
      successResponse('AEGIS is healthy', {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      }),
    );
  } catch {
    res.status(503).json(
      errorResponse('Service unavailable', {
        status: 'degraded',
        database: 'disconnected',
      }),
    );
  }
});

export default router;
