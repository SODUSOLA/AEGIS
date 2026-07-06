import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Zod schema that validates and transforms all required environment variables.
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  APP_NAME: z.string().default('AEGIS'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),

  API_KEY_SALT: z.string().min(32, 'API_KEY_SALT must be at least 32 characters'),

  NOMBA_BASE_URL: z.string().url('NOMBA_BASE_URL must be a valid URL'),
  NOMBA_CLIENT_ID: z.string().min(1, 'NOMBA_CLIENT_ID is required'),
  NOMBA_CLIENT_SECRET: z.string().min(1, 'NOMBA_CLIENT_SECRET is required'),
  NOMBA_ACCOUNT_ID: z.string().min(1, 'NOMBA_ACCOUNT_ID is required'),
  NOMBA_SUB_ACCOUNT_ID: z.string().min(1, 'NOMBA_SUB_ACCOUNT_ID is required'),
  NOMBA_WEBHOOK_SECRET: z.string().min(1, 'NOMBA_WEBHOOK_SECRET is required'),

  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.string().default('587').transform(Number),
  SMTP_SECURE: z.string().default('false').transform((v) => v === 'true'),
  SMTP_USER: z.string().email('SMTP_USER must be a valid email'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  SMTP_FROM: z.string().min(1, 'SMTP_FROM is required'),

  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),

  SCHEDULER_INTERVAL_SECONDS: z.string().default('60').transform(Number),
  WORKER_CONCURRENCY: z.string().default('5').transform(Number),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),

  WEBHOOK_MAX_DELIVERY_ATTEMPTS: z.string().default('4').transform(Number),
  UPTIME_PING_INTERVAL_SECONDS: z.string().default('300').transform(Number),
});

// Parse and exit immediately if required vars are missing or invalid
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

/** Validated, typed environment configuration singleton. */
export const env = parsed.data;
