import type { Redis } from "ioredis";

export interface CacheStatsSnapshot {
  hits: number;
  misses: number;
  hitRate: number;
  estimatedSavingsUsd: number;
  totalEntries: number;
  hitsByModel: Record<string, number>;
  missesByModel: Record<string, number>;
}

export class CacheStats {
  private redis: Redis;
  private prefix = "gw:cache:stats:";

  constructor(redis: Redis) {
    this.redis = redis;
  }

  async recordHit(model: string, estimatedCostSaved: number): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(`${this.prefix}hits`);
    pipeline.hincrby(`${this.prefix}hits:model`, model, 1);
    pipeline.incrbyfloat(`${this.prefix}savings`, estimatedCostSaved);
    await pipeline.exec();
  }

  async recordMiss(model: string): Promise<void> {
    const pipeline = this.redis.pipeline();
    pipeline.incr(`${this.prefix}misses`);
    pipeline.hincrby(`${this.prefix}misses:model`, model, 1);
    await pipeline.exec();
  }

  async getStats(): Promise<CacheStatsSnapshot> {
    const [hitsStr, missesStr, savingsStr, hitsByModel, missesByModel] = await Promise.all([
      this.redis.get(`${this.prefix}hits`),
      this.redis.get(`${this.prefix}misses`),
      this.redis.get(`${this.prefix}savings`),
      this.redis.hgetall(`${this.prefix}hits:model`),
      this.redis.hgetall(`${this.prefix}misses:model`),
    ]);

    const hits = parseInt(hitsStr ?? "0", 10);
    const misses = parseInt(missesStr ?? "0", 10);
    const total = hits + misses;

    const parsedHitsByModel: Record<string, number> = {};
    for (const [key, value] of Object.entries(hitsByModel)) {
      parsedHitsByModel[key] = parseInt(value, 10);
    }

    const parsedMissesByModel: Record<string, number> = {};
    for (const [key, value] of Object.entries(missesByModel)) {
      parsedMissesByModel[key] = parseInt(value, 10);
    }

    return {
      hits,
      misses,
      hitRate: total > 0 ? hits / total : 0,
      estimatedSavingsUsd: parseFloat(savingsStr ?? "0"),
      totalEntries: 0, // Filled in by caller with semantic cache stats
      hitsByModel: parsedHitsByModel,
      missesByModel: parsedMissesByModel,
    };
  }

  async reset(): Promise<void> {
    const keys = await this.redis.keys(`${this.prefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
