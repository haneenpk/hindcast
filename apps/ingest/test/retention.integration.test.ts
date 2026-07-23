import "dotenv/config";
import { randomUUID } from "node:crypto";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@hindcast/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { RetentionService } from "../src/retention/retention.service";
import { StorageService } from "../src/storage/storage.service";

// Exercises the sweep against the live compose stack. Run `docker compose
// up -d` first; the package's test script builds beforehand.

const DAY_MS = 24 * 60 * 60 * 1000;
const retention = new RetentionService(new StorageService());
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY ?? "",
    secretAccessKey: process.env.S3_SECRET_KEY ?? "",
  },
});

async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(
      new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }),
    );
    return true;
  } catch {
    return false;
  }
}

// Seeds a session with one real gzipped chunk in object storage.
async function seedSession(
  projectId: string,
  startedAt: Date,
): Promise<{ id: string; key: string }> {
  const id = randomUUID();
  const key = `${projectId}/${id}/000000.json.gz`;
  const size = await new StorageService().putGzippedJson(key, [
    { type: 2, timestamp: startedAt.getTime() },
  ]);
  await prisma.session.create({
    data: {
      id,
      projectId,
      startedAt,
      lastEventAt: startedAt,
      durationMs: 0,
    },
  });
  await prisma.eventChunk.create({
    data: {
      sessionId: id,
      seq: 0,
      storageKey: key,
      sizeBytes: size,
      eventCount: 1,
      firstEventAt: startedAt,
      lastEventAt: startedAt,
    },
  });
  return { id, key };
}

let projectId: string;

beforeAll(async () => {
  const project = await prisma.project.create({
    data: { name: "Retention Test", key: `rt-${randomUUID()}`, retentionDays: 30 },
  });
  projectId = project.id;
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { key: { startsWith: "rt-" } } });
  await prisma.$disconnect();
});

describe("RetentionService.sweepProject", () => {
  it("deletes expired sessions, their chunks and their objects", async () => {
    const old = await seedSession(projectId, new Date(Date.now() - 40 * DAY_MS));
    const fresh = await seedSession(projectId, new Date(Date.now() - 2 * DAY_MS));

    expect(await objectExists(old.key)).toBe(true);

    const result = await retention.sweepProject(projectId);
    expect(result.deletedSessions).toBe(1);
    expect(result.freedBytes).toBeGreaterThan(0);

    expect(await prisma.session.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.eventChunk.count({ where: { sessionId: old.id } })).toBe(0);
    expect(await objectExists(old.key)).toBe(false);

    // the recent one is untouched
    expect(
      await prisma.session.findUnique({ where: { id: fresh.id } }),
    ).not.toBeNull();
    expect(await objectExists(fresh.key)).toBe(true);
  });

  it("is a no-op for a project set to keep forever", async () => {
    const forever = await prisma.project.create({
      data: {
        name: "Keep Forever",
        key: `rt-${randomUUID()}`,
        retentionDays: null,
      },
    });
    const ancient = await seedSession(
      forever.id,
      new Date(Date.now() - 400 * DAY_MS),
    );

    const result = await retention.sweepProject(forever.id);
    expect(result.deletedSessions).toBe(0);
    expect(
      await prisma.session.findUnique({ where: { id: ancient.id } }),
    ).not.toBeNull();
    expect(await objectExists(ancient.key)).toBe(true);
  });

  it("re-running after everything expired stays clean", async () => {
    const again = await retention.sweepProject(projectId);
    expect(again.deletedSessions).toBe(0);
  });
});

describe("RetentionService.storageStats", () => {
  it("reports session count, bytes and the oldest session", async () => {
    const project = await prisma.project.create({
      data: { name: "Stats", key: `rt-${randomUUID()}`, retentionDays: 30 },
    });
    const oldest = new Date(Date.now() - 5 * DAY_MS);
    await seedSession(project.id, oldest);
    await seedSession(project.id, new Date(Date.now() - 1 * DAY_MS));

    const stats = await retention.storageStats(project.id);
    expect(stats.sessionCount).toBe(2);
    expect(stats.totalBytes).toBeGreaterThan(0);
    expect(stats.oldestSessionAt?.getTime()).toBe(oldest.getTime());
  });
});
