import { describe, expect, it } from "vitest";
import { paginate, toSkipTake, paginationQuerySchema } from "@/lib/pagination";

describe("pagination", () => {
  it("defaults to page 1, pageSize 25", () => {
    const result = paginationQuerySchema.parse({});
    expect(result).toEqual({ page: 1, pageSize: 25 });
  });

  it("accepts a configured page and pageSize", () => {
    const result = paginationQuerySchema.parse({ page: "3", pageSize: "10" });
    expect(result).toEqual({ page: 3, pageSize: 10 });
  });

  it("rejects a pageSize above the maximum", () => {
    const result = paginationQuerySchema.safeParse({ pageSize: "9999" });
    expect(result.success).toBe(false);
  });

  it("rejects page below 1", () => {
    const result = paginationQuerySchema.safeParse({ page: "0" });
    expect(result.success).toBe(false);
  });

  it("computes skip/take correctly", () => {
    expect(toSkipTake({ page: 1, pageSize: 25 })).toEqual({ skip: 0, take: 25 });
    expect(toSkipTake({ page: 3, pageSize: 25 })).toEqual({ skip: 50, take: 25 });
  });

  it("computes totalPages correctly", () => {
    const result = paginate([1, 2, 3], 55, { page: 1, pageSize: 25 });
    expect(result.totalPages).toBe(3);
  });
});
