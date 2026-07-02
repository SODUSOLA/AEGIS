import { prisma } from '../../db/prisma';
import { ConflictError } from '../../lib/errors';
import { logger } from '../../lib/logger';
import { RegisterMerchantInput } from './merchant.schema';
import {
  generateApiKey,
  generateWebhookSecret,
  hashApiKey,
  getApiKeyPreview,
} from './apiKey.service';

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

export async function registerMerchant(
  input: RegisterMerchantInput,
): Promise<MerchantRegistrationResult> {
  const { businessName, email } = input;

  const existing = await prisma.merchant.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError('A merchant account with this email already exists.');
  }

  const rawApiKey = generateApiKey();
  const apiKeyHash = hashApiKey(rawApiKey);
  const apiKeyPreview = getApiKeyPreview(rawApiKey);
  const webhookSecret = generateWebhookSecret();

  const merchant = await prisma.merchant.create({
    data: {
      businessName,
      email,
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
