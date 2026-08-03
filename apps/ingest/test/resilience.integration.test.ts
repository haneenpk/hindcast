import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { prisma } from "@hindcast/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Boots the compiled server (dist/main.js) with one dependency pointed at a
// dead address, to prove failures stay isolated:
//   - Redis down must not stop boot or drop recordings (rate limiter is
//     fail-open; the retention scheduler must not block startup).
//   - An object-storage outage must not crash the server or swallow the
//     error/network telemetry that never touches storage.
// Needs the compose stack (postgres, redis, minio) up and a build first —
// the package's test script builds.

const REAL: Record<string, string> = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    "postgresql://hindcast:hindcast@localhost:5432/hindcast",
  S3_ENDPOINT: process.env.S3_ENDPOINT ?? "http://localhost:9000",
  S3_REGION: process.env.S3_REGION ?? "us-east-1",
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY ?? "hindcast",
  S3_SECRET_KEY: process.env.S3_SECRET_KEY ?? "hindcast-dev",
  S3_BUCKET: process.env.S3_BUCKET ?? "hindcast-events",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
};

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

// Boots ingest with the real stack, overriding one dependency, and resolves
// once /healthz answers — proving startup survived the broken dependency.
async function boot(
  port: number,
  overrides: Record<string, string>,
): Promise<ChildProcess> {
  let log = "";
  const server = spawn(process.execPath, ["dist/main.js"], {
    env: { ...process.env, ...REAL, PORT: String(port), ...overrides },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk: Buffer) => (log += chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => (log += chunk.toString()));

  const base = `http://localhost:${port}`;
  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return server;
    } catch {
      /* not up yet */
    }
    if (server.exitCode !== null || Date.now() > deadline) {
      throw new Error(
        `ingest never became healthy on ${port} (exit: ${server.exitCode})\n${log.slice(-800)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
}

function makeBatch(key: string, sessionId: string, startedAt: number) {
  return {
    v: 1,
    key,
    sessionId,
    seq: 0,
    startedAt,
    url: "https://shop.example.com/checkout",
    events: [
      { type: 2, data: { node: {} }, timestamp: startedAt },
      { type: 3, data: { source: 2 }, timestamp: startedAt + 1500 },
    ],
  };
}

function post(base: string, body: unknown): Promise<Response> {
  return fetch(`${base}/v1/events`, {
    method: "POST",
    headers: { "user-agent": CHROME_UA },
    body: JSON.stringify(body),
  });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe("resilience: Redis unreachable", () => {
  const PORT = 4181;
  const BASE = `http://localhost:${PORT}`;
  let server: ChildProcess;
  let key: string;

  beforeAll(async () => {
    server = await boot(PORT, { REDIS_URL: "redis://127.0.0.1:6399" });
    key = `rt-${randomUUID()}`;
    await prisma.project.create({ data: { name: "Resilience Redis", key } });
  });

  afterAll(async () => {
    server.kill();
    await prisma.project.deleteMany({ where: { key } });
  });

  it("boots and stays healthy with Redis down", async () => {
    expect((await fetch(`${BASE}/healthz`)).ok).toBe(true);
  });

  it("still accepts a batch — the limiter fails open, the recording lands", async () => {
    const sessionId = randomUUID();
    const response = await post(BASE, makeBatch(key, sessionId, Date.now() - 5000));
    expect(response.status).toBe(202);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { chunks: true },
    });
    expect(session).not.toBeNull();
    expect(session?.chunks).toHaveLength(1);
  });
});

describe("resilience: object storage unreachable", () => {
  const PORT = 4182;
  const BASE = `http://localhost:${PORT}`;
  let server: ChildProcess;
  let key: string;

  beforeAll(async () => {
    server = await boot(PORT, { S3_ENDPOINT: "http://127.0.0.1:9599" });
    key = `rt-${randomUUID()}`;
    await prisma.project.create({ data: { name: "Resilience S3", key } });
  });

  afterAll(async () => {
    server.kill();
    await prisma.project.deleteMany({ where: { key } });
  });

  it("fails an event batch when the chunk can't be stored, but stays up", async () => {
    // The chunk write happens before any DB row, so a storage failure
    // surfaces as a 5xx and no half-written session is left behind.
    const response = await post(BASE, makeBatch(key, randomUUID(), Date.now() - 5000));
    expect(response.status).toBeGreaterThanOrEqual(500);
    // The process survived the failed request and serves the next one.
    expect((await fetch(`${BASE}/healthz`)).ok).toBe(true);
  }, 20_000);

  it("still records errors — telemetry never touches object storage", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 8000;
    const errorsOnly = {
      ...makeBatch(key, sessionId, startedAt),
      events: [],
      errors: [
        {
          timestamp: startedAt + 2000,
          source: "window_error",
          message: "crash while object storage is down",
        },
      ],
    };
    expect((await post(BASE, errorsOnly)).status).toBe(202);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { errors: true },
    });
    expect(session?.hasError).toBe(true);
    expect(session?.errors).toHaveLength(1);
  }, 20_000);
});
