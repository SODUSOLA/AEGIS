import crypto from 'crypto';
import { env } from '../../config/env';
import {
  API_KEY_PREFIX,
  API_KEY_BYTE_LENGTH,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_SECRET_BYTE_LENGTH,
} from '../../config/constants';

// ─── API Key Helpers ───────────────────────────────

/** Generate a cryptographically random API key with a human-readable prefix. */
export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_BYTE_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${randomBytes}`;
}

/** Generate a cryptographically random webhook signing secret. */
export function generateWebhookSecret(): string {
  const randomBytes = crypto.randomBytes(WEBHOOK_SECRET_BYTE_LENGTH).toString('hex');
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes}`;
}

/** Hash an API key using HMAC-SHA256 with the configured salt. */
export function hashApiKey(apiKey: string): string {
  return crypto
    .createHmac('sha256', env.API_KEY_SALT)
    .update(apiKey)
    .digest('hex');
}

/** Return a truncated preview (first 20 chars + ellipsis) so merchants can identify keys without exposing the full value. */
export function getApiKeyPreview(apiKey: string): string {
  return `${apiKey.substring(0, 20)}...`;
}

/** Constant-time comparison of two hex-encoded hashes to prevent timing attacks. */
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
