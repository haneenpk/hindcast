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

function makeBatch(sessionId: string, seq: number, startedAt: number) {
  return {
    v: 1,
    key,
    sessionId,
    seq,
    startedAt,
    url: "https://shop.example.com/checkout",
    events: [
      { type: 2, data: { node: {} }, timestamp: startedAt },
      { type: 3, data: { source: 2 }, timestamp: startedAt + 1500 },
      { type: 3, data: { source: 2 }, timestamp: startedAt + 4200 },
    ],
  };
}

async function post(body: unknown): Promise<Response> {
  return fetch(`${BASE}/v1/events`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeAll(async () => {
  let bootLog = "";
  server = spawn(process.execPath, ["dist/main.js"], {
    env: { ...process.env, PORT: String(PORT) },
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

    await post(makeBatch(sessionId, 1, startedAt + 30_000));
    await post(makeBatch(sessionId, 0, startedAt)); // late, out of order

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });
    expect(session?.lastEventAt.getTime()).toBe(startedAt + 30_000 + 4200);
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
});
