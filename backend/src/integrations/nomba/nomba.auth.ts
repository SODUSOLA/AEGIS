import { getRedisClient } from '../../db/redis';
import { env } from '../../config/env';
import { logger } from '../../lib/logger';
import { NombaTokenRequest, NombaTokenResponse, NombaRefreshTokenRequest } from './nomba.types';

// ─── Token Cache Keys ─────────────────────────────────

const ACCESS_TOKEN_KEY = 'nomba:access_token';
const REFRESH_TOKEN_KEY = 'nomba:refresh_token';

// ─── Constants ────────────────────────────────────────

/** Seconds subtracted from the real TTL to avoid using a token right at expiry. */
const REFRESH_BUFFER_SECONDS = 300;
const AUTH_TIMEOUT_MS = 15_000;

// ─── Public API ───────────────────────────────────────

/**
 * Returns a valid Nomba access token, trying cache → refresh → client_credentials
 * in that order.
 */
export async function getNombaAccessToken(): Promise<string> {
  const redis = getRedisClient();

  // Fast path: use cached access token if still valid
  const cached = await redis.get(ACCESS_TOKEN_KEY);
  if (cached) return cached;

  // Second path: try to refresh using the stored refresh token
  const refreshToken = await redis.get(REFRESH_TOKEN_KEY);
  if (refreshToken) {
    try {
      return await refreshAccessToken(refreshToken);
    } catch (err) {
      logger.warn('Refresh token failed — falling back to client credentials', { err });
    }
  }

  // Fallback: fresh client-credentials grant
  return await authenticateWithCredentials();
}

// ─── Internal Helpers ─────────────────────────────────

/** Performs a client_credentials OAuth2 grant against Nomba's token endpoint. */
async function authenticateWithCredentials(): Promise<string> {
  const redis = getRedisClient();

  const body: NombaTokenRequest = {
    grant_type: 'client_credentials',
    client_id: env.NOMBA_CLIENT_ID,
    client_secret: env.NOMBA_CLIENT_SECRET,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.NOMBA_BASE_URL}/v1/auth/token/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId: env.NOMBA_ACCOUNT_ID,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Nomba auth failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as NombaTokenResponse;

  if (data.code !== '00' || !data.data?.access_token) {
    throw new Error(`Nomba auth rejected: ${data.description}`);
  }

  await cacheTokens(redis, data.data.access_token, data.data.refresh_token, data.data.expiresAt);

  logger.info('Nomba access token obtained via client_credentials');
  return data.data.access_token;
}

/** Uses a stored refresh token to get a new access token without re-entering credentials. */
async function refreshAccessToken(refreshToken: string): Promise<string> {
  const redis = getRedisClient();
  const currentToken = await redis.get(ACCESS_TOKEN_KEY);

  const body: NombaRefreshTokenRequest = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.NOMBA_BASE_URL}/v1/auth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        accountId: env.NOMBA_ACCOUNT_ID,
        ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    throw new Error(`Nomba token refresh failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as NombaTokenResponse;

  if (data.code !== '00' || !data.data?.access_token) {
    throw new Error(`Nomba token refresh rejected: ${data.description}`);
  }

  await cacheTokens(redis, data.data.access_token, data.data.refresh_token, data.data.expiresAt);

  logger.info('Nomba access token refreshed via refresh_token');
  return data.data.access_token;
}

/** Persists tokens to Redis with appropriate TTLs. */
async function cacheTokens(
  redis: ReturnType<typeof getRedisClient>,
  accessToken: string,
  refreshToken: string,
  expiresAt: string,
): Promise<void> {
  const expiryMs = new Date(expiresAt).getTime() - Date.now();
  // Shave off buffer seconds so we never attempt a request with an about-to-expire token
  const ttlSeconds = Math.max(Math.floor(expiryMs / 1000) - REFRESH_BUFFER_SECONDS, 60);

  await Promise.all([
    redis.setex(ACCESS_TOKEN_KEY, ttlSeconds, accessToken),
    redis.setex(REFRESH_TOKEN_KEY, 7 * 24 * 60 * 60, refreshToken),
  ]);

  logger.debug('Nomba tokens cached', { accessTokenTtlSeconds: ttlSeconds });
}

/** Invalidates cached tokens so the next request forces fresh authentication. */
export async function invalidateNombaTokens(): Promise<void> {
  const redis = getRedisClient();
  await Promise.all([redis.del(ACCESS_TOKEN_KEY), redis.del(REFRESH_TOKEN_KEY)]);
  logger.warn('Nomba token cache cleared — will re-authenticate on next request');
}
