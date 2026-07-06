import { env } from '../config/env';
import { logger } from '../lib/logger';

let _pingerInterval: NodeJS.Timeout | null = null;

/**
 * Starts a periodic self-ping to the /health endpoint.
 * Ensures the service stays warm and provides early warning if the server becomes unreachable.
 */
export function startUptimePinger(): void {
  const intervalMs = env.UPTIME_PING_INTERVAL_SECONDS * 1000;
  const healthUrl = `${env.APP_BASE_URL}/health`;

  _pingerInterval = setInterval(async () => {
    try {
      const res = await fetch(healthUrl, { method: 'GET' });
      if (res.ok) {
        logger.debug('Uptime ping success', { url: healthUrl, status: res.status });
      } else {
        logger.warn('Uptime ping returned non-OK status', {
          url: healthUrl,
          status: res.status,
        });
      }
    } catch (error) {
      logger.warn('Uptime ping failed', {
        url: healthUrl,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }
  }, intervalMs);

  logger.info('Uptime pinger started', {
    url: healthUrl,
    intervalSeconds: env.UPTIME_PING_INTERVAL_SECONDS,
  });
}

/** Stops the periodic pinger. Safe to call even if it was never started. */
export function stopUptimePinger(): void {
  if (_pingerInterval) {
    clearInterval(_pingerInterval);
    _pingerInterval = null;
    logger.info('Uptime pinger stopped');
  }
}
