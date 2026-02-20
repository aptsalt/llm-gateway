import type { Redis } from "ioredis";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetInMs: number;
  retryAfterMs?: number;
}

export class RateLimiter {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async checkRateLimit(
    key: string,
    maxRequests: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const windowKey = `gw:ratelimit:${key}`;
    const windowStart = now - windowMs;

    const pipeline = this.redis.pipeline();
    // Remove expired entries
    pipeline.zremrangebyscore(windowKey, 0, windowStart);
    // Count current entries
    pipeline.zcard(windowKey);
    // Add current request
    pipeline.zadd(windowKey, now, `${now}-${Math.random().toString(36).slice(2, 8)}`);
    // Set expiry on the key
    pipeline.pexpire(windowKey, windowMs);

    const results = await pipeline.exec();
    const currentCount = (results?.[1]?.[1] as number) ?? 0;

    if (currentCount >= maxRequests) {
      // Find when the oldest entry in the window will expire
      const oldest = await this.redis.zrange(windowKey, 0, 0, "WITHSCORES");
      const oldestTime = oldest[1] ? parseInt(oldest[1], 10) : now;
      const retryAfterMs = oldestTime + windowMs - now;

      return {
        allowed: false,
        remaining: 0,
        resetInMs: retryAfterMs,
        retryAfterMs,
      };
    }

    return {
      allowed: true,
      remaining: maxRequests - currentCount - 1,
      resetInMs: windowMs,
    };
  }

  async checkRequestRate(apiKeyId: string, rpm: number): Promise<RateLimitResult> {
    return this.checkRateLimit(`rpm:${apiKeyId}`, rpm, 60000);
  }

  async checkTokenRate(apiKeyId: string, tpm: number, tokensToAdd: number): Promise<RateLimitResult> {
    const windowKey = `gw:ratelimit:tpm:${apiKeyId}`;
    const now = Date.now();
    const windowMs = 60000;
    const windowStart = now - windowMs;

    // Remove expired entries
    await this.redis.zremrangebyscore(windowKey, 0, windowStart);

    // Get current token sum
    const entries = await this.redis.zrangebyscore(windowKey, windowStart, now);
    let currentTokens = 0;
    for (const entry of entries) {
      const tokens = parseInt(entry.split(":")[0] ?? "0", 10);
      currentTokens += tokens;
    }

    if (currentTokens + tokensToAdd > tpm) {
      return {
        allowed: false,
        remaining: Math.max(0, tpm - currentTokens),
        resetInMs: windowMs,
        retryAfterMs: windowMs,
      };
    }

    // Record the tokens
    await this.redis.zadd(
      windowKey,
      now,
      `${tokensToAdd}:${now}-${Math.random().toString(36).slice(2, 8)}`
    );
    await this.redis.pexpire(windowKey, windowMs);

    return {
      allowed: true,
      remaining: tpm - currentTokens - tokensToAdd,
      resetInMs: windowMs,
    };
  }
}
