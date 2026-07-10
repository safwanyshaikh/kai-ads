export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetAt: Date;
}

export interface RateLimiter {
  readonly name: string;
  /**
   * Consumes one attempt for `key` within a fixed window.
   * `key` should already include the bucket name, e.g. "agencies:203.0.113.4".
   */
  consume(key: string, options: { limit: number; windowSeconds: number }): Promise<RateLimitResult>;
}
