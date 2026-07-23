import { env } from "../env";

/**
 * BullMQ takes an ioredis options object, not a URL, so the configured
 * REDIS_URL is parsed into its parts here. maxRetriesPerRequest must be
 * null for the blocking commands workers rely on.
 */
export function redisConnection() {
  const url = new URL(env.REDIS_URL);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}
