import type { Redis } from "ioredis";
import { EmbeddingService, cosineSimilarity } from "./embedding.js";
import type { ChatResponse } from "../gateway/validator.js";

export interface CacheConfig {
  enabled: boolean;
  similarityThreshold: number;
  ttlSeconds: number;
  maxEntries: number;
}

interface CacheEntry {
  embedding: number[];
  response: ChatResponse;
  query: string;
  model: string;
  timestamp: number;
  hitCount: number;
}

const DEFAULT_CONFIG: CacheConfig = {
  enabled: true,
  similarityThreshold: 0.95,
  ttlSeconds: 3600,
  maxEntries: 10000,
};

export class SemanticCache {
  private redis: Redis;
  private embedder: EmbeddingService;
  private config: CacheConfig;
  private cacheKeyPrefix = "gw:cache:";
  private indexKey = "gw:cache:index";

  constructor(redis: Redis, embedder: EmbeddingService, config?: Partial<CacheConfig>) {
    this.redis = redis;
    this.embedder = embedder;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async lookup(query: string, model: string): Promise<ChatResponse | null> {
    if (!this.config.enabled) return null;

    try {
      const queryEmbedding = await this.embedder.embed(query);
      const entryKeys = await this.redis.smembers(this.indexKey);

      let bestMatch: { key: string; similarity: number; entry: CacheEntry } | null = null;

      // Check entries in batches
      for (const key of entryKeys) {
        const raw = await this.redis.get(key);
        if (!raw) {
          await this.redis.srem(this.indexKey, key);
          continue;
        }

        const entry = JSON.parse(raw) as CacheEntry;

        // Model must match (or be virtual)
        const virtualModels = ["auto", "fast", "cheap", "quality"];
        if (!virtualModels.includes(model) && entry.model !== model) continue;

        const similarity = cosineSimilarity(queryEmbedding, entry.embedding);
        if (similarity >= this.config.similarityThreshold) {
          if (!bestMatch || similarity > bestMatch.similarity) {
            bestMatch = { key, similarity, entry };
          }
        }
      }

      if (bestMatch) {
        // Increment hit count
        bestMatch.entry.hitCount++;
        await this.redis.set(
          bestMatch.key,
          JSON.stringify(bestMatch.entry),
          "EX",
          this.config.ttlSeconds
        );
        return {
          ...bestMatch.entry.response,
          "x-gateway": {
            ...bestMatch.entry.response["x-gateway"],
            cache_hit: true,
          },
        };
      }

      return null;
    } catch {
      // Cache errors should not break the request flow
      return null;
    }
  }

  async store(query: string, model: string, response: ChatResponse): Promise<void> {
    if (!this.config.enabled) return;

    try {
      const embedding = await this.embedder.embed(query);
      const key = `${this.cacheKeyPrefix}${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const entry: CacheEntry = {
        embedding,
        response,
        query,
        model,
        timestamp: Date.now(),
        hitCount: 0,
      };

      await this.redis.set(key, JSON.stringify(entry), "EX", this.config.ttlSeconds);
      await this.redis.sadd(this.indexKey, key);

      // Enforce max entries
      const count = await this.redis.scard(this.indexKey);
      if (count > this.config.maxEntries) {
        await this.evictOldest();
      }
    } catch {
      // Cache errors should not break the request flow
    }
  }

  async invalidate(pattern?: string): Promise<number> {
    const entryKeys = await this.redis.smembers(this.indexKey);
    let removed = 0;

    for (const key of entryKeys) {
      if (pattern) {
        const raw = await this.redis.get(key);
        if (raw) {
          const entry = JSON.parse(raw) as CacheEntry;
          if (entry.query.includes(pattern) || entry.model.includes(pattern)) {
            await this.redis.del(key);
            await this.redis.srem(this.indexKey, key);
            removed++;
          }
        }
      } else {
        await this.redis.del(key);
        removed++;
      }
    }

    if (!pattern) {
      await this.redis.del(this.indexKey);
    }

    return removed;
  }

  async getStats(): Promise<{
    totalEntries: number;
    enabled: boolean;
    similarityThreshold: number;
    ttlSeconds: number;
  }> {
    const count = await this.redis.scard(this.indexKey);
    return {
      totalEntries: count,
      enabled: this.config.enabled,
      similarityThreshold: this.config.similarityThreshold,
      ttlSeconds: this.config.ttlSeconds,
    };
  }

  private async evictOldest(): Promise<void> {
    const entryKeys = await this.redis.smembers(this.indexKey);
    const entries: Array<{ key: string; timestamp: number }> = [];

    for (const key of entryKeys) {
      const raw = await this.redis.get(key);
      if (!raw) {
        await this.redis.srem(this.indexKey, key);
        continue;
      }
      const entry = JSON.parse(raw) as CacheEntry;
      entries.push({ key, timestamp: entry.timestamp });
    }

    // Sort by timestamp, remove oldest until within limit
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const toRemove = entries.slice(0, entries.length - this.config.maxEntries);
    for (const { key } of toRemove) {
      await this.redis.del(key);
      await this.redis.srem(this.indexKey, key);
    }
  }
}
