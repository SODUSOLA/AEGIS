import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';
import { logger } from '../lib/logger';

// Hoist PrismaClient onto globalThis in dev to survive hot-reloads
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/** Singleton PrismaClient instance. Logs queries in dev, errors-only in production. */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (env.NODE_ENV === 'development') {
  // Warn when any query exceeds 200 ms
  prisma.$on('query' as never, (e: Record<string, unknown>) => {
    if (Number(e.duration) > 200) {
      logger.warn('Slow Prisma query detected', {
        query: String(e.query),
        duration: `${String(e.duration)}ms`,
      });
    }
  });
}

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
