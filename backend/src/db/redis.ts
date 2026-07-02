import IORedis from 'ioredis';
import { env } from '../config/env';
import { logger } from '../lib/logger';

const redisConnectionOptions = {
  maxRetriesPerRequest: null as null,
  enableReadyCheck: false,
  lazyConnect: false,
};

let _bullMQConnection: IORedis | null = null;
let _generalConnection: IORedis | null = null;

export function getBullMQConnection(): IORedis {
  if (!_bullMQConnection) {
    _bullMQConnection = new IORedis(env.REDIS_URL, redisConnectionOptions);

    _bullMQConnection.on('connect', () => logger.info('BullMQ Redis connection established'));
    _bullMQConnection.on('error', (err) => logger.error('BullMQ Redis connection error', { err }));
  }
  return _bullMQConnection;
}

export function getRedisClient(): IORedis {
  if (!_generalConnection) {
    _generalConnection = new IORedis(env.REDIS_URL, {
      ...redisConnectionOptions,
      maxRetriesPerRequest: 3,
    });

    _generalConnection.on('connect', () => logger.info('General Redis connection established'));
    _generalConnection.on('error', (err) =>
      logger.error('General Redis connection error', { err }),
    );
  }
  return _generalConnection;
}

export async function disconnectRedis(): Promise<void> {
  await Promise.allSettled([
    _bullMQConnection?.quit(),
    _generalConnection?.quit(),
  ]);
}
