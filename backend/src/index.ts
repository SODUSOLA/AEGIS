import { env } from './config/env';
import { createApp } from './app';
import { logger } from './lib/logger';
import { prisma } from './db/prisma';
import { disconnectRedis } from './db/redis';
import { closeAllQueues } from './queues/queue.registry';
import { startAllWorkers, stopAllWorkers } from './startup/workers';

async function bootstrap() {
  try {
    await prisma.$connect();
    logger.info('Database connection established');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    process.exit(1);
  }

  try {
    await startAllWorkers();
    logger.info('Background workers started');
  } catch (error) {
    logger.error('Failed to start background workers', { error });
    process.exit(1);
  }

  const app = createApp();

  const server = app.listen(env.PORT, () => {
    logger.info('AEGIS is running', {
      port: env.PORT,
      environment: env.NODE_ENV,
    });
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);

    server.close(() => {
      logger.info('HTTP server closed');
    });

    await stopAllWorkers();

    await closeAllQueues();

    await disconnectRedis();

    await prisma.$disconnect();

    logger.info('Graceful shutdown complete');
    process.exit(0);
  };

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

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', { reason });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception — shutting down', { error });
    process.exit(1);
  });
}

bootstrap();
