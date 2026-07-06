import { Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../../db/prisma';
import { NotFoundError, ConflictError, ForbiddenError } from '../../lib/errors';
import { getPrismaSkipTake, buildPaginationMeta } from '../../lib/pagination';
import { CreateCustomerInput, UpdateCustomerInput, UpdatePaymentMethodInput } from './customer.schema';
import { logger } from '../../lib/logger';

// ─── Service Functions ─────────────────────────────

/**
 * Create a new customer under a merchant.
 *
 * If a soft-deleted customer with the same email exists, restores it
 * with the new data instead of creating a duplicate.
 */
export async function createCustomer(merchantId: string, input: CreateCustomerInput) {
  const existing = await prisma.customer.findUnique({
    where: { merchantId_email: { merchantId, email: input.email } },
    select: { id: true, isDeleted: true },
  });

  if (existing && !existing.isDeleted) {
    throw new ConflictError(
      `A customer with email "${input.email}" already exists in your account.`,
    );
  }

  if (existing?.isDeleted) {
    const restored = await prisma.customer.update({
      where: { merchantId_email: { merchantId, email: input.email } },
      data: {
        name: input.name ?? null,
        phone: input.phone ?? null,
        nombaTokenKey: input.nombaTokenKey ?? null,
        metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        isDeleted: false,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        nombaTokenKey: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    logger.info('Customer restored (was soft-deleted)', { merchantId, customerId: restored.id });
    return transformCustomer(restored);
  }

  const customer = await prisma.customer.create({
    data: {
      merchantId,
      email: input.email,
      name: input.name ?? null,
      phone: input.phone ?? null,
      nombaTokenKey: input.nombaTokenKey ?? null,
      metadata: (input.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      nombaTokenKey: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info('Customer created', { merchantId, customerId: customer.id });
  return transformCustomer(customer);
}

/** List customers for a merchant with pagination and optional hasToken filter. */
export async function listCustomers(
  merchantId: string,
  page: number,
  limit: number,
  hasToken?: boolean,
) {
  const where: Prisma.CustomerWhereInput = {
    merchantId,
    isDeleted: false,
    ...(hasToken === true && { NOT: { nombaTokenKey: null } }),
    ...(hasToken === false && { nombaTokenKey: null }),
  };

  const [customers, total] = await prisma.$transaction([
    prisma.customer.findMany({
      where,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        nombaTokenKey: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      ...getPrismaSkipTake(page, limit),
    }),
    prisma.customer.count({ where }),
  ]);

  return {
    customers: customers.map(transformCustomer),
    meta: buildPaginationMeta(total, page, limit),
  };
}

/** Fetch a single customer by ID with their recent subscription history (up to 5). */
export async function getCustomerById(merchantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId, isDeleted: false },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      nombaTokenKey: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
      subscriptions: {
        where: { isDeleted: false },
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
          plan: {
            select: { id: true, name: true, amountKobo: true, interval: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  if (!customer) {
    throw new NotFoundError('Customer');
  }

  return {
    ...transformCustomer(customer),
    subscriptions: customer.subscriptions,
  };
}

/** Update a customer's mutable profile fields (name, phone, metadata). */
export async function updateCustomer(
  merchantId: string,
  customerId: string,
  input: UpdateCustomerInput,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId, isDeleted: false },
    select: { id: true },
  });

  if (!customer) throw new NotFoundError('Customer');

  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.phone !== undefined && { phone: input.phone }),
      ...(input.metadata !== undefined && { metadata: input.metadata as Prisma.InputJsonValue }),
    },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      nombaTokenKey: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info('Customer updated', { merchantId, customerId });
  return transformCustomer(updated);
}

/** Attach or update a Nomba payment token for a customer. */
export async function updatePaymentMethod(
  merchantId: string,
  customerId: string,
  input: UpdatePaymentMethodInput,
) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId, isDeleted: false },
    select: { id: true },
  });

  if (!customer) throw new NotFoundError('Customer');

  await prisma.customer.update({
    where: { id: customerId },
    data: { nombaTokenKey: input.nombaTokenKey },
  });

  logger.info('Customer payment method updated', { merchantId, customerId });

  return { message: 'Payment method updated successfully.' };
}

/**
 * Soft-delete a customer. Blocked if the customer has active subscriptions
 * (TRIALING, ACTIVE, or PAST_DUE).
 */
export async function deleteCustomer(merchantId: string, customerId: string) {
  const customer = await prisma.customer.findFirst({
    where: { id: customerId, merchantId, isDeleted: false },
    select: { id: true, email: true },
  });

  if (!customer) throw new NotFoundError('Customer');

  const activeSubscriptions = await prisma.subscription.count({
    where: {
      customerId,
      merchantId,
      isDeleted: false,
      status: { in: ['TRIALING', 'ACTIVE', 'PAST_DUE'] as SubscriptionStatus[] },
    },
  });

  if (activeSubscriptions > 0) {
    throw new ForbiddenError(
      `Cannot delete customer — they have ${activeSubscriptions} active subscription(s). ` +
        'Cancel all subscriptions before deleting the customer.',
    );
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: { isDeleted: true, deletedAt: new Date() },
  });

  logger.info('Customer soft-deleted', { merchantId, customerId });
}

// ─── Helpers ───────────────────────────────────────

/** Strip the raw nombaTokenKey from the response and expose a boolean hasPaymentMethod instead. */
function transformCustomer(customer: {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  nombaTokenKey: string | null;
  metadata: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}) {
  const { nombaTokenKey, ...rest } = customer;
  return {
    ...rest,
    hasPaymentMethod: nombaTokenKey !== null,
  };
}
