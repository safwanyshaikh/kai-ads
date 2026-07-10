import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/server/rate-limit/memory-rate-limiter";

describe("MemoryRateLimiter", () => {
  it("allows requests under the limit", async () => {
    const limiter = new MemoryRateLimiter();
    const result = await limiter.consume("test:1", { limit: 3, windowSeconds: 60 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("blocks requests once the limit is exceeded within the window", async () => {
    const limiter = new MemoryRateLimiter();
    const key = "test:2";
    await limiter.consume(key, { limit: 2, windowSeconds: 60 });
    await limiter.consume(key, { limit: 2, windowSeconds: 60 });
    const third = await limiter.consume(key, { limit: 2, windowSeconds: 60 });

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
  });

  it("tracks separate keys independently", async () => {
    const limiter = new MemoryRateLimiter();
    await limiter.consume("bucket:a", { limit: 1, windowSeconds: 60 });
    const other = await limiter.consume("bucket:b", { limit: 1, windowSeconds: 60 });

    expect(other.allowed).toBe(true);
  });

  it("resets the window after it expires", async () => {
    const limiter = new MemoryRateLimiter();
    const key = "test:3";
    const first = await limiter.consume(key, { limit: 1, windowSeconds: -1 }); // already-expired window
    expect(first.allowed).toBe(true);

    const second = await limiter.consume(key, { limit: 1, windowSeconds: -1 });
    expect(second.allowed).toBe(true); // window immediately expired again -> fresh bucket
  });
});
