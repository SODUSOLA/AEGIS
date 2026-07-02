import crypto from 'crypto';
import { env } from '../../config/env';
import {
  API_KEY_PREFIX,
  API_KEY_BYTE_LENGTH,
  WEBHOOK_SECRET_PREFIX,
  WEBHOOK_SECRET_BYTE_LENGTH,
} from '../../config/constants';

export function generateApiKey(): string {
  const randomBytes = crypto.randomBytes(API_KEY_BYTE_LENGTH).toString('hex');
  return `${API_KEY_PREFIX}${randomBytes}`;
}

export function generateWebhookSecret(): string {
  const randomBytes = crypto.randomBytes(WEBHOOK_SECRET_BYTE_LENGTH).toString('hex');
  return `${WEBHOOK_SECRET_PREFIX}${randomBytes}`;
}

export function hashApiKey(apiKey: string): string {
  return crypto
    .createHmac('sha256', env.API_KEY_SALT)
    .update(apiKey)
    .digest('hex');
}

export function getApiKeyPreview(apiKey: string): string {
  return `${apiKey.substring(0, 20)}...`;
}

export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
