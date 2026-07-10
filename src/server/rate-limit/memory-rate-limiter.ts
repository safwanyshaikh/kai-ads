import type { RateLimiter, RateLimitResult } from "./rate-limiter.interface";

interface Bucket {
  count: number;
  windowStartedAt: number;
}

/**
 * In-memory fixed-window limiter.
 *
 * Correct for a single Node.js instance (fine for Sprint 001 traffic /
 * early production). It is NOT correct across multiple instances/replicas
 * — each process has its own memory, so a person could get `limit *
 * instanceCount` attempts. The RateLimiter interface this implements is
 * the seam for that: swap this for a Redis-backed implementation
 * (INCR + EXPIRE, or a sliding-window Lua script) behind the same
 * interface with zero call-site changes when horizontal scaling starts.
 */
export class MemoryRateLimiter implements RateLimiter {
  readonly name = "memory";
  private buckets = new Map<string, Bucket>();

  async consume(
    key: string,
    options: { limit: number; windowSeconds: number },
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowMs = options.windowSeconds * 1000;
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStartedAt >= windowMs) {
      this.buckets.set(key, { count: 1, windowStartedAt: now });
      this.sweep(now, windowMs);
      return {
        allowed: true,
        remaining: options.limit - 1,
        limit: options.limit,
        resetAt: new Date(now + windowMs),
      };
    }

    existing.count += 1;
    const allowed = existing.count <= options.limit;
    return {
      allowed,
      remaining: Math.max(0, options.limit - existing.count),
      limit: options.limit,
      resetAt: new Date(existing.windowStartedAt + windowMs),
    };
  }

  /** Prevents unbounded memory growth from one-off keys (e.g. distinct IPs). */
  private sweep(now: number, windowMs: number) {
    if (this.buckets.size < 5000) return;
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.windowStartedAt >= windowMs) {
        this.buckets.delete(key);
      }
    }
  }
}
