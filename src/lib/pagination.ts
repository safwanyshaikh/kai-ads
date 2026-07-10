import { z } from "zod";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "@/lib/constants";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationParams = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function toSkipTake(params: PaginationParams): { skip: number; take: number } {
  return { skip: (params.page - 1) * params.pageSize, take: params.pageSize };
}

export function paginate<T>(data: T[], total: number, params: PaginationParams): Paginated<T> {
  return {
    data,
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.pageSize)),
  };
}

/** Parses page/pageSize from URL search params, defaulting per DEFAULT_PAGE_SIZE. */
export function parsePagination(searchParams: URLSearchParams | Record<string, string | undefined>): PaginationParams {
  const get = (key: string) =>
    searchParams instanceof URLSearchParams ? searchParams.get(key) ?? undefined : searchParams[key];
  return paginationQuerySchema.parse({ page: get("page"), pageSize: get("pageSize") });
}
