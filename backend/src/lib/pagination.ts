import { z } from 'zod';

/** Validates and coerces `?page=` and `?limit=` query parameters. Defaults to page 1 / limit 20. */
export const paginationSchema = z.object({
  page: z.string().default('1').transform(Number).pipe(z.number().min(1)),
  limit: z.string().default('20').transform(Number).pipe(z.number().min(1).max(100)),
});

export type PaginationParams = z.infer<typeof paginationSchema>;

/** Metadata attached to every paginated API response. */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  [key: string]: unknown;
}

/** Converts 1-based page/limit into Prisma-compatible skip/take values. */
export function getPrismaSkipTake(page: number, limit: number): { skip: number; take: number } {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/** Builds a PaginationMeta object from the raw count and the requested page/limit. */
export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
