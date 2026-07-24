import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import IORedis from "ioredis";
import { env } from "../env";
import { redisConnection } from "../retention/redis";

const WINDOW_MS = 60_000;

export interface RateVerdict {
  allowed: boolean;
  remaining: number;
  resetSeconds: number;
}

// A fixed-window counter per project key. Deliberately fail-open: a Redis
// blip must never start dropping real recordings, so any error here is
// treated as "allowed". enableOfflineQueue:false makes commands reject
// fast instead of hanging when Redis is unreachable.
@Injectable()
export class RateLimiterService implements OnModuleDestroy {
  private readonly logger = new Logger(RateLimiterService.name);
  private readonly redis = new IORedis({
    ...redisConnection(),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    lazyConnect: false,
  });

  constructor() {
    // Without a listener, connection errors would crash the process.
    this.redis.on("error", () => {});
  }

  async hit(key: string): Promise<RateVerdict> {
    const limit = env.RATE_LIMIT_PER_MINUTE;
    const window = Math.floor(Date.now() / WINDOW_MS);
    const bucket = `rl:${key}:${window}`;
    try {
      const count = await this.redis.incr(bucket);
      if (count === 1) await this.redis.pexpire(bucket, WINDOW_MS);
      const resetSeconds = Math.ceil(
        (WINDOW_MS - (Date.now() % WINDOW_MS)) / 1000,
      );
      return {
        allowed: count <= limit,
        remaining: Math.max(0, limit - count),
        resetSeconds,
      };
    } catch {
      return { allowed: true, remaining: limit, resetSeconds: 0 };
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis.quit();
    } catch {
      /* already gone */
    }
  }
}
