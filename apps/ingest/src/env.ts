import { z } from "zod";

// Fail loudly at boot, not at the first request that needs a bucket.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  DATABASE_URL: z.string().min(1),
  S3_ENDPOINT: z.url(),
  S3_REGION: z.string().min(1).default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  REDIS_URL: z.url().default("redis://localhost:6379"),
  // How often the retention sweep runs, in minutes.
  RETENTION_SWEEP_MINUTES: z.coerce.number().int().positive().default(60),
});

export const env = envSchema.parse(process.env);
