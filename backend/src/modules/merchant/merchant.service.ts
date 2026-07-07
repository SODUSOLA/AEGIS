import { prisma } from '../../db/prisma';
import { ConflictError, UnauthorizedError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { hashPassword, verifyPassword } from '../../lib/password';
import { RegisterMerchantInput, LoginMerchantInput } from './merchant.schema';
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  getApiKeyPreview,
} from './apiKey.service';

// ─── Types ─────────────────────────────────────────

/** Return shape for merchant registration — includes the raw API key (shown once). */
export interface MerchantRegistrationResult {
  merchant: {
    id: string;
    businessName: string;
    email: string;
    apiKeyPreview: string;
    webhookSecret: string;
    status: string;
    createdAt: Date;
  };
  apiKey: string;
}

/** Return shape for merchant login — includes merchant profile + API key for subsequent requests. */
export interface LoginResult {
  merchant: {
    id: string;
    businessName: string;
    email: string;
    apiKeyPreview: string;
    status: string;
    createdAt: Date;
  };
  apiKey: string;
}

// ─── Service Functions ─────────────────────────────

/** Register a new merchant account: validates uniqueness, hashes password, generates API key + webhook secret. */
export async function registerMerchant(
  input: RegisterMerchantInput,
): Promise<MerchantRegistrationResult> {
  const { businessName, email, password } = input;

  const existing = await prisma.merchant.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError('A merchant account with this email already exists.');
  }

  const passwordHash = hashPassword(password);
  const rawApiKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawApiKey);
  const apiKeyPreview = getApiKeyPreview(rawApiKey);
  const webhookSecret = generateWebhookSecret();

  const merchant = await prisma.merchant.create({
    data: {
      businessName,
      email,
      passwordHash,
      apiKeyHash,
      apiKeyPreview,
      webhookSecret,
    },
    select: {
      id: true,
      businessName: true,
      email: true,
      apiKeyPreview: true,
      webhookSecret: true,
      status: true,
      createdAt: true,
    },
  });

  logger.info('Merchant registered successfully', {
    merchantId: merchant.id,
    email: merchant.email,
  });

  return {
    merchant,
    apiKey: rawApiKey,
  };
}

/** Authenticate a merchant by email + password. Returns merchant profile + a fresh API key. */
export async function loginMerchant(
  input: LoginMerchantInput,
): Promise<LoginResult> {
  const { email, password } = input;

  const merchant = await prisma.merchant.findUnique({
    where: { email },
  });

  if (!merchant || !merchant.passwordHash) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  if (merchant.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is suspended.');
  }

  const valid = verifyPassword(password, merchant.passwordHash);
  if (!valid) {
    throw new UnauthorizedError('Invalid email or password.');
  }

  // Generate a fresh API key and rotate the hash (each login invalidates the old key).
  const rawApiKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawApiKey);
  const apiKeyPreview = getApiKeyPreview(rawApiKey);

  const updated = await prisma.merchant.update({
    where: { id: merchant.id },
    data: {
      apiKeyHash,
      apiKeyPreview,
    },
    select: {
      id: true,
      businessName: true,
      email: true,
      apiKeyPreview: true,
      status: true,
      createdAt: true,
    },
  });

  logger.info('Merchant logged in — API key rotated', {
    merchantId: merchant.id,
    email: merchant.email,
  });

  return {
    merchant: updated,
    apiKey: rawApiKey,
  };
}

/** Look up a merchant by its UUID. Returns null if not found. */
export async function getMerchantById(merchantId: string) {
  return prisma.merchant.findUnique({
    where: { id: merchantId },
    select: {
      id: true,
      businessName: true,
      email: true,
      apiKeyPreview: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/** Resolve a merchant from a raw API key. Returns null if key is invalid or merchant is not ACTIVE. */
export async function resolveMerchantFromApiKey(apiKey: string) {
  const apiKeyHash = hashApiKey(apiKey);

  const merchant = await prisma.merchant.findUnique({
    where: { apiKeyHash },
  });

  if (!merchant || merchant.status !== 'ACTIVE') {
    return null;
  }

  return merchant;
}
