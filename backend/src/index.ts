import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './db/prisma';
import { disconnectRedis } from './db/redis';
import { closeAllQueues } from './queues/queue.registry';
import { startAllWorkers, stopAllWorkers } from './startup/workers';
import { closeEmailTransporter } from './integrations/email/email.client';

/**
 * Application entry point.
 * 1. Connects to the database
 * 2. Starts background workers
 * 3. Boots the HTTP server
 * 4. Registers graceful shutdown handlers
 */
async function bootstrap() {
  // ─── Database ──────────────────────────────────────
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    process.exit(1);
  }

  // ─── Workers ───────────────────────────────────────
  try {
    await startAllWorkers();
    logger.info('Background workers started');
  } catch (error) {
    logger.warn('Background workers failed to start — API server will still run', { error });
  }

  // ─── HTTP Server ───────────────────────────────────
  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info('AEGIS is running', {
      port: env.PORT,
      environment: env.NODE_ENV,
    });
  });

  // ─── Graceful Shutdown ─────────────────────────────
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(() => {
      logger.info('HTTP server closed');
    });

    await stopAllWorkers();

    await closeAllQueues();

    closeEmailTransporter();

    await disconnectRedis();

    await prisma.$disconnect();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

  // Force-kill if graceful shutdown takes longer than 30 seconds
  const forceKillAfterMs = 30_000;

  process.on('SIGTERM', async () => {
    await shutdown('SIGTERM');
    setTimeout(() => {
      logger.error('Force kill after graceful shutdown timeout');
      process.exit(1);
    }, forceKillAfterMs);
  });

  process.on('SIGINT', async () => {
    await shutdown('SIGINT');
    setTimeout(() => process.exit(1), forceKillAfterMs);
  });

  // Catch unhandled promise rejections (log only, don't crash)
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
  });

  // Uncaught exceptions — crash and let the process manager restart
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception — shutting down', { error });
    process.exit(1);
  });
}

bootstrap();
