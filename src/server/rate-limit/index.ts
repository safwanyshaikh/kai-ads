import type { NextRequest } from "next/server";
import type { RateLimiter } from "./rate-limiter.interface";
import { MemoryRateLimiter } from "./memory-rate-limiter";
import { TooManyRequestsError } from "@/lib/errors";

export * from "./rate-limiter.interface";

let cachedLimiter: RateLimiter | null = null;

/**
 * Returns the active RateLimiter. Today this is always the in-memory
 * implementation. When Redis is introduced, branch here on an env var
 * (e.g. RATE_LIMIT_PROVIDER=redis) exactly like getEmailProvider() /
 * getStorageProvider() — no call site outside this file changes.
 */
export function getRateLimiter(): RateLimiter {
  if (!cachedLimiter) {
    cachedLimiter = new MemoryRateLimiter();
  }
  return cachedLimiter;
}

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "unknown";
}

/**
 * Enforces a rate limit for a public mutation route, keyed by client IP.
 * Throws TooManyRequestsError (-> 429) when exceeded.
 */
export async function enforceRateLimit(
  request: NextRequest,
  bucket: string,
  options: { limit: number; windowSeconds: number },
): Promise<void> {
  const limiter = getRateLimiter();
  const key = `${bucket}:${clientIp(request)}`;
  const result = await limiter.consume(key, options);

  if (!result.allowed) {
    throw new TooManyRequestsError(result.resetAt);
  }
}
