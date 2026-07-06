import crypto from 'crypto';
import { prisma } from '../../../db/prisma';
import { NotFoundError, ConflictError } from '../../../lib/errors';
import { getPrismaSkipTake, buildPaginationMeta } from '../../../lib/pagination';
import { CreateEndpointInput, UpdateEndpointInput } from './outbound.schema';
import { logger } from '../../../lib/logger';
import { WEBHOOK_SECRET_PREFIX } from '../../../config/constants';

// ─── Endpoint CRUD ───────────────────────────────────

/** Create a new webhook endpoint with a generated HMAC secret. Rejects duplicate URLs per merchant. */
export async function createWebhookEndpoint(
  merchantId: string,
  input: CreateEndpointInput,
) {
  const existing = await prisma.webhookEndpoint.findFirst({
    where: {
      merchantId,
      url: input.url,
      isDeleted: false,
    },
    select: { id: true },
  });

  if (existing) {
    throw new ConflictError(
      `A webhook endpoint for "${input.url}" already exists. Update the existing endpoint instead.`,
    );
  }

  const secret = `${WEBHOOK_SECRET_PREFIX}${crypto.randomBytes(32).toString('hex')}`;

  const endpoint = await prisma.webhookEndpoint.create({
    data: {
      merchantId,
      url: input.url,
      secret,
      subscribedEvents: input.subscribedEvents,
      description: input.description ?? null,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      url: true,
      secret: true,
      subscribedEvents: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

  logger.info('Webhook endpoint created', {
    merchantId,
    endpointId: endpoint.id,
    url: endpoint.url,
  });

  return {
    ...endpoint,
    _note: 'Store this secret securely — it will not be shown again in full.',
  };
}

/** Paginated list of webhook endpoints for a merchant, with delivery count. */
export async function listWebhookEndpoints(
  merchantId: string,
  page: number,
  limit: number,
) {
  const where = { merchantId, isDeleted: false };

  const [endpoints, total] = await prisma.$transaction([
    prisma.webhookEndpoint.findMany({
      where,
      select: {
        id: true,
        url: true,
        subscribedEvents: true,
        description: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { deliveries: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      ...getPrismaSkipTake(page, limit),
    }),
    prisma.webhookEndpoint.count({ where }),
  ]);

  return {
    endpoints,
    meta: buildPaginationMeta(total, page, limit),
  };
}

/** Get a single webhook endpoint by ID. Throws NotFoundError if not found or soft-deleted. */
export async function getWebhookEndpoint(merchantId: string, endpointId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, merchantId, isDeleted: false },
    select: {
      id: true,
      url: true,
      subscribedEvents: true,
      description: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!endpoint) throw new NotFoundError('Webhook endpoint');
  return endpoint;
}

/** Partial update of a webhook endpoint (URL, events, description, status). */
export async function updateWebhookEndpoint(
  merchantId: string,
  endpointId: string,
  input: UpdateEndpointInput,
) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, merchantId, isDeleted: false },
    select: { id: true },
  });

  if (!endpoint) throw new NotFoundError('Webhook endpoint');

  const updated = await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: {
      ...(input.url && { url: input.url }),
      ...(input.subscribedEvents && { subscribedEvents: input.subscribedEvents }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.status && { status: input.status }),
    },
    select: {
      id: true,
      url: true,
      subscribedEvents: true,
      description: true,
      status: true,
      updatedAt: true,
    },
  });

  logger.info('Webhook endpoint updated', { merchantId, endpointId });
  return updated;
}

/** Soft-delete a webhook endpoint (sets isDeleted + DISABLED). */
export async function deleteWebhookEndpoint(merchantId: string, endpointId: string) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, merchantId, isDeleted: false },
    select: { id: true },
  });

  if (!endpoint) throw new NotFoundError('Webhook endpoint');

  await prisma.webhookEndpoint.update({
    where: { id: endpointId },
    data: { isDeleted: true, deletedAt: new Date(), status: 'DISABLED' },
  });

  logger.info('Webhook endpoint deleted', { merchantId, endpointId });
}

/** Paginated delivery logs for a webhook endpoint, optionally filtered by status. */
export async function listWebhookDeliveries(
  merchantId: string,
  endpointId: string,
  page: number,
  limit: number,
  status?: string,
) {
  const endpoint = await prisma.webhookEndpoint.findFirst({
    where: { id: endpointId, merchantId, isDeleted: false },
    select: { id: true },
  });

  if (!endpoint) throw new NotFoundError('Webhook endpoint');

  const where = {
    endpointId,
    ...(status && { status: status as any }),
  };

  const [deliveries, total] = await prisma.$transaction([
    prisma.webhookDelivery.findMany({
      where,
      select: {
        id: true,
        eventId: true,
        eventType: true,
        status: true,
        attemptCount: true,
        lastAttemptedAt: true,
        nextAttemptAt: true,
        responseStatus: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      ...getPrismaSkipTake(page, limit),
    }),
    prisma.webhookDelivery.count({ where }),
  ]);

  return {
    deliveries,
    meta: buildPaginationMeta(total, page, limit),
  };
}
