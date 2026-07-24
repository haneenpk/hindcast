import "dotenv/config";
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { promisify } from "node:util";
import { gunzip } from "node:zlib";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@hindcast/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Boots the real compiled server (dist/main.js) against the live
// docker-compose stack — postgres, minio and all. Run `pnpm build` and
// `docker compose up -d` first; the package's test script does the build.

// Not 4190: that's on the fetch spec's bad-ports list (ManageSieve) and
// undici refuses to connect to it.
const PORT = 4180;
const BASE = `http://localhost:${PORT}`;
const gunzipAsync = promisify(gunzip);

let server: ChildProcess;
let key: string;
let otherKey: string;

function makeBatch(
  sessionId: string,
  seq: number,
  startedAt: number,
  eventBase = startedAt,
) {
  return {
    v: 1,
    key,
    sessionId,
    seq,
    // startedAt stays constant across a session's batches, like the SDK
    // sends it; eventBase moves with each flush.
    startedAt,
    url: "https://shop.example.com/checkout",
    events: [
      { type: 2, data: { node: {} }, timestamp: eventBase },
      { type: 3, data: { source: 2 }, timestamp: eventBase + 1500 },
      { type: 3, data: { source: 2 }, timestamp: eventBase + 4200 },
    ],
  };
}

const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36";

async function post(body: unknown): Promise<Response> {
  return fetch(`${BASE}/v1/events`, {
    method: "POST",
    headers: { "user-agent": CHROME_UA },
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  let bootLog = "";
  server = spawn(process.execPath, ["dist/main.js"], {
    env: {
      ...process.env,
      PORT: String(PORT),
      // Low enough that the hardening tests can trip them, high enough
      // that the functional tests above never do.
      RATE_LIMIT_PER_MINUTE: "50",
      MAX_BATCH_BYTES: "100000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk: Buffer) => (bootLog += chunk.toString()));
  server.stderr?.on("data", (chunk: Buffer) => (bootLog += chunk.toString()));

  const deadline = Date.now() + 30_000;
  let lastError = "";
  for (;;) {
    try {
      const response = await fetch(`${BASE}/healthz`);
      if (response.ok) break;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = String((error as Error).cause ?? error);
    }
    if (server.exitCode !== null || Date.now() > deadline) {
      throw new Error(
        `ingest never became healthy (exit: ${server.exitCode}, last: ${lastError})\n${bootLog.slice(-800)}`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  key = `it-${randomUUID()}`;
  otherKey = `it-${randomUUID()}`;
  await prisma.project.createMany({
    data: [
      { name: "Integration A", key },
      { name: "Integration B", key: otherKey },
    ],
  });
});

afterAll(async () => {
  server.kill();
  await prisma.project.deleteMany({ where: { key: { startsWith: "it-" } } });
  await prisma.$disconnect();
});

describe("POST /v1/events", () => {
  it("persists the session, the chunk row and the gzipped object", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 10_000;
    const batch = makeBatch(sessionId, 0, startedAt);

    const response = await post(batch);
    expect(response.status).toBe(202);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { chunks: true },
    });
    expect(session).not.toBeNull();
    expect(session?.entryUrl).toBe(batch.url);
    expect(session?.lastEventAt.getTime()).toBe(startedAt + 4200);
    expect(session?.browser).toBe("Chrome");
    expect(session?.os).toBe("Windows");
    expect(session?.durationMs).toBe(4200);
    expect(session?.chunks).toHaveLength(1);
    expect(session?.chunks[0]?.eventCount).toBe(3);
    expect(session?.chunks[0]?.pageUrl).toBe(batch.url);

    const s3 = new S3Client({
      endpoint: process.env.S3_ENDPOINT,
      region: process.env.S3_REGION ?? "us-east-1",
      forcePathStyle: true,
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY ?? "",
        secretAccessKey: process.env.S3_SECRET_KEY ?? "",
      },
    });
    const object = await s3.send(
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: session?.chunks[0]?.storageKey,
      }),
    );
    const stored = JSON.parse(
      (
        await gunzipAsync(
          Buffer.from(await object.Body!.transformToByteArray()),
        )
      ).toString(),
    );
    expect(stored).toEqual(batch.events);
  });

  it("swallows duplicate chunk deliveries", async () => {
    const sessionId = randomUUID();
    const batch = makeBatch(sessionId, 0, Date.now() - 5000);

    expect((await post(batch)).status).toBe(202);
    expect((await post(batch)).status).toBe(202);

    const chunks = await prisma.eventChunk.count({ where: { sessionId } });
    expect(chunks).toBe(1);
  });

  it("only moves lastEventAt forward", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 60_000;

    await post(makeBatch(sessionId, 1, startedAt, startedAt + 30_000));
    await post(makeBatch(sessionId, 0, startedAt)); // late, out of order

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    expect(session?.lastEventAt.getTime()).toBe(startedAt + 30_000 + 4200);
    expect(session?.durationMs).toBe(30_000 + 4200);
  });

  it("rejects unknown project keys", async () => {
    const batch = { ...makeBatch(randomUUID(), 0, Date.now()), key: "nope" };
    expect((await post(batch)).status).toBe(401);
  });

  it("rejects malformed payloads", async () => {
    expect((await post({ nonsense: true })).status).toBe(400);
  });

  it("refuses to append to another project's session", async () => {
    const sessionId = randomUUID();
    await post(makeBatch(sessionId, 0, Date.now() - 5000));

    const hijack = {
      ...makeBatch(sessionId, 1, Date.now()),
      key: otherKey,
    };
    expect((await post(hijack)).status).toBe(403);
  });

  it("persists captured errors and flags the session", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 8000;
    const batch = {
      ...makeBatch(sessionId, 0, startedAt),
      errors: [
        {
          timestamp: startedAt + 2000,
          source: "window_error",
          message: "Cannot read properties of undefined (reading 'percent')",
          stack: "TypeError: Cannot read properties of undefined\n    at applyCoupon",
          url: "https://shop.example.com/checkout",
        },
        {
          timestamp: startedAt + 3000,
          source: "console_error",
          message: "stock check failed: HTTP 404",
        },
      ],
    };

    expect((await post(batch)).status).toBe(202);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { errors: { orderBy: { timestamp: "asc" } } },
    });
    expect(session?.hasError).toBe(true);
    expect(session?.errors).toHaveLength(2);
    expect(session?.errors[0]?.source).toBe("WINDOW_ERROR");
    expect(session?.errors[0]?.stack).toContain("applyCoupon");
    expect(session?.errors[1]?.source).toBe("CONSOLE_ERROR");
    expect(session?.errors[1]?.pageUrl).toBe(batch.url);
  });

  it("does not double-insert errors on duplicate delivery", async () => {
    const sessionId = randomUUID();
    const batch = {
      ...makeBatch(sessionId, 0, Date.now() - 5000),
      errors: [
        {
          timestamp: Date.now() - 4000,
          source: "unhandled_rejection",
          message: "newsletter signup failed: HTTP 404",
        },
      ],
    };

    expect((await post(batch)).status).toBe(202);
    expect((await post(batch)).status).toBe(202);

    const count = await prisma.errorEvent.count({ where: { sessionId } });
    expect(count).toBe(1);
  });

  it("accepts an errors-only batch and advances lastEventAt", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 60_000;
    await post(makeBatch(sessionId, 0, startedAt));

    const errorAt = startedAt + 45_000;
    const errorsOnly = {
      ...makeBatch(sessionId, 1, startedAt),
      events: [],
      errors: [
        {
          timestamp: errorAt,
          source: "window_error",
          message: "async crash on an idle page",
        },
      ],
    };
    expect((await post(errorsOnly)).status).toBe(202);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    expect(session?.hasError).toBe(true);
    expect(session?.lastEventAt.getTime()).toBe(errorAt);

    const chunks = await prisma.eventChunk.count({ where: { sessionId } });
    expect(chunks).toBe(1); // no chunk row for the eventless batch
  });

  it("flags an existing session when the visitor reports it", async () => {
    const sessionId = randomUUID();
    await post(makeBatch(sessionId, 0, Date.now() - 5000));

    const response = await fetch(`${BASE}/v1/reports`, {
      method: "POST",
      headers: { "user-agent": CHROME_UA },
      body: JSON.stringify({
        v: 1,
        key,
        sessionId,
        startedAt: Date.now() - 5000,
        url: "https://shop.example.com/checkout",
        comment: "  the coupon button crashed the page  ",
      }),
    });
    expect(response.status).toBe(202);

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    expect(session?.reportedAt).not.toBeNull();
    expect(session?.reportComment).toBe("the coupon button crashed the page");
  });

  it("creates a session shell when the report beats the first batch", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 2000;

    const response = await fetch(`${BASE}/v1/reports`, {
      method: "POST",
      headers: { "user-agent": CHROME_UA },
      body: JSON.stringify({
        v: 1,
        key,
        sessionId,
        startedAt,
        url: "https://shop.example.com/cart",
      }),
    });
    expect(response.status).toBe(202);

    const shell = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(shell?.reportedAt).not.toBeNull();
    expect(shell?.reportComment).toBeNull();
    expect(shell?.browser).toBe("Chrome");

    // the late batch fills the shell in rather than failing
    expect((await post(makeBatch(sessionId, 0, startedAt))).status).toBe(202);
    const filled = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(filled?.durationMs).toBe(4200);
    expect(filled?.reportedAt).not.toBeNull();
  });

  it("refuses reports against another project's session", async () => {
    const sessionId = randomUUID();
    await post(makeBatch(sessionId, 0, Date.now() - 5000));

    const response = await fetch(`${BASE}/v1/reports`, {
      method: "POST",
      body: JSON.stringify({
        v: 1,
        key: otherKey,
        sessionId,
        startedAt: Date.now(),
        url: "https://shop.example.com/",
      }),
    });
    expect(response.status).toBe(403);
  });

  it("rejects a batch with neither events nor errors", async () => {
    const empty = { ...makeBatch(randomUUID(), 0, Date.now()), events: [] };
    expect((await post(empty)).status).toBe(400);
  });

  it("persists request outcomes, statusless ones included", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 8000;
    const batch = {
      ...makeBatch(sessionId, 0, startedAt),
      network: [
        {
          timestamp: startedAt + 1000,
          method: "GET",
          url: "https://shop.example.com/api/products",
          status: 200,
          durationMs: 84,
        },
        {
          timestamp: startedAt + 2000,
          method: "POST",
          url: "https://shop.example.com/api/stock-check",
          status: 404,
          durationMs: 51,
        },
        {
          timestamp: startedAt + 3000,
          method: "GET",
          url: "https://cdn.down.example.com/hero.jpg",
          durationMs: 4013,
        },
      ],
    };

    expect((await post(batch)).status).toBe(202);

    const rows = await prisma.networkEvent.findMany({
      where: { sessionId },
      orderBy: { timestamp: "asc" },
    });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ method: "GET", status: 200, durationMs: 84 });
    expect(rows[1]).toMatchObject({ method: "POST", status: 404 });
    expect(rows[2]?.status).toBeNull();
  });

  it("accepts a network-only batch, advances lastEventAt, dedupes duplicates", async () => {
    const sessionId = randomUUID();
    const startedAt = Date.now() - 60_000;
    await post(makeBatch(sessionId, 0, startedAt));

    const lastAt = startedAt + 45_000;
    const networkOnly = {
      ...makeBatch(sessionId, 1, startedAt),
      events: [],
      network: [
        {
          timestamp: startedAt + 40_000,
          method: "GET",
          url: "https://shop.example.com/api/poll",
          status: 200,
          durationMs: 130,
        },
        {
          timestamp: lastAt,
          method: "GET",
          url: "https://shop.example.com/api/poll",
          status: 200,
          durationMs: 118,
        },
      ],
    };

    expect((await post(networkOnly)).status).toBe(202);
    expect((await post(networkOnly)).status).toBe(202);

    const rows = await prisma.networkEvent.count({ where: { sessionId } });
    expect(rows).toBe(2);

    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    expect(session?.lastEventAt.getTime()).toBe(lastAt);
    expect(session?.hasError).toBe(false); // failed requests are not errors
  });
});

describe("hardening", () => {
  it("rejects a body larger than the cap with a 413", async () => {
    // Rate limiting keys on body.key, and this fires before parsing, so
    // give it a fresh key to keep it off the shared budget.
    const oversized = {
      key: `big-${randomUUID()}`,
      blob: "x".repeat(150_000), // over the 100000-byte test cap
    };
    const response = await fetch(`${BASE}/v1/events`, {
      method: "POST",
      body: JSON.stringify(oversized),
    });
    expect(response.status).toBe(413);
  });

  it("rate-limits a project key once it exceeds the window", async () => {
    // The guard runs before validation, so a keyed-but-invalid body still
    // counts against the limit — no sessions written to trip it.
    const rlKey = `rl-${randomUUID()}`;
    const body = JSON.stringify({ key: rlKey });

    let firstStatus: number | null = null;
    let hit429 = false;
    let remainingHeader: string | null = null;
    for (let i = 0; i < 60; i += 1) {
      const response = await fetch(`${BASE}/v1/events`, {
        method: "POST",
        body,
      });
      if (firstStatus === null) firstStatus = response.status;
      if (response.status === 429) {
        hit429 = true;
        remainingHeader = response.headers.get("retry-after");
        break;
      }
    }

    // Allowed by the limiter, rejected only by schema validation.
    expect(firstStatus).toBe(400);
    expect(hit429).toBe(true);
    expect(Number(remainingHeader)).toBeGreaterThan(0);
  });
});
