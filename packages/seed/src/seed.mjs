import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { prisma } from "@hindcast/db";

// Demo mode: real recorded Fernwood journeys, replayed onto a populated
// set of projects so a fresh clone opens to a product, not empty states.
// The event streams are genuine — every seeded session actually plays.

const here = dirname(fileURLToPath(import.meta.url));
const DAY = 24 * 60 * 60 * 1000;

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY,
    secretAccessKey: process.env.S3_SECRET_KEY,
  },
});

function loadFixture(name) {
  const raw = JSON.parse(
    readFileSync(join(here, "..", "fixtures", `${name}.json`), "utf8"),
  );
  const base = Math.min(...raw.events.map((e) => e.timestamp));
  const span = Math.max(...raw.events.map((e) => e.timestamp)) - base;
  return { ...raw, base, span };
}

const FIXTURES = {
  checkout: loadFixture("checkout-crash"),
  browse: loadFixture("browse-bounce"),
  cart: loadFixture("cart-abandon"),
};

// Weighted toward the light journeys, the way real traffic runs.
const JOURNEYS = [
  { fixture: FIXTURES.browse, weight: 5, paths: ["/", "/products/oak-bookshelf", "/sale"] },
  { fixture: FIXTURES.cart, weight: 3, paths: ["/products/linen-lounge-chair", "/products/brass-task-lamp", "/cart"] },
  { fixture: FIXTURES.checkout, weight: 2, paths: ["/products/walnut-writing-desk", "/checkout", "/products/marble-side-table"] },
];

const DEVICES = [
  { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36", browser: "Chrome", os: "Windows" },
  { ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15", browser: "Safari", os: "Mac OS" },
  { ua: "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0", browser: "Firefox", os: "Linux" },
  { ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1", browser: "Mobile Safari", os: "iOS" },
  { ua: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0", browser: "Edge", os: "Windows" },
];

const PROJECTS = [
  { name: "Fernwood", key: "seed_fernwood", sessions: 22, host: "https://shop.fernwood.example" },
  { name: "Fernwood — Staging", key: "seed_fernwood_staging", sessions: 9, host: "https://staging.fernwood.example" },
  { name: "Fernwood — EU", key: "seed_fernwood_eu", sessions: 14, host: "https://eu.fernwood.example" },
];

const REPORT_COMMENTS = [
  "the coupon button did nothing and then the page froze",
  "couldn't check if the desk was in stock",
  "checkout kept spinning, never confirmed my order",
  "the price didn't update after I applied the code",
];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

function pickJourney() {
  const total = JOURNEYS.reduce((sum, j) => sum + j.weight, 0);
  let n = Math.random() * total;
  for (const j of JOURNEYS) {
    n -= j.weight;
    if (n <= 0) return j;
  }
  return JOURNEYS[0];
}

async function seedSession(project, index) {
  const journey = pickJourney();
  const { fixture } = journey;
  const device = pick(DEVICES);
  const sessionId = randomUUID();

  const startedAt = Date.now() - randInt(0, 13) * DAY - randInt(0, DAY);
  const offset = startedAt - fixture.base;
  const rebase = (ts) => ts + offset;

  const events = fixture.events.map((e) => ({ ...e, timestamp: rebase(e.timestamp) }));
  const entryUrl = `${project.host}${pick(journey.paths)}`;

  const storageKey = `${project.id}/${sessionId}/000000.json.gz`;
  const body = gzipSync(JSON.stringify(events));
  await s3.send(
    new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: storageKey,
      Body: body,
      ContentType: "application/json",
      ContentEncoding: "gzip",
    }),
  );

  const hasError = fixture.errors.length > 0;
  const reported = Math.random() < 0.12;
  const reportedAt = reported ? new Date(startedAt + randInt(2000, fixture.span)) : null;

  await prisma.session.create({
    data: {
      id: sessionId,
      projectId: project.id,
      startedAt: new Date(startedAt),
      lastEventAt: new Date(startedAt + fixture.span),
      entryUrl,
      userAgent: device.ua,
      browser: device.browser,
      os: device.os,
      durationMs: fixture.span,
      hasError,
      reportedAt,
      reportComment: reported ? pick(REPORT_COMMENTS) : null,
    },
  });

  await prisma.eventChunk.create({
    data: {
      sessionId,
      seq: 0,
      storageKey,
      sizeBytes: body.byteLength,
      eventCount: events.length,
      pageUrl: entryUrl,
      firstEventAt: new Date(startedAt),
      lastEventAt: new Date(startedAt + fixture.span),
    },
  });

  if (fixture.errors.length > 0) {
    await prisma.errorEvent.createMany({
      data: fixture.errors.map((e) => ({
        sessionId,
        timestamp: new Date(rebase(e.timestamp)),
        source: e.source,
        message: e.message,
        stack: e.stack,
        pageUrl: entryUrl,
      })),
    });
  }
  if (fixture.network.length > 0) {
    await prisma.networkEvent.createMany({
      data: fixture.network.map((n) => ({
        sessionId,
        timestamp: new Date(rebase(n.timestamp)),
        method: n.method,
        url: n.url,
        status: n.status,
        durationMs: n.durationMs,
      })),
    });
  }
}

async function main() {
  // Idempotent: wipe anything a previous seed created, leaving real
  // projects (and the live demo-fernwood project) untouched.
  const removed = await prisma.project.deleteMany({
    where: { key: { startsWith: "seed_" } },
  });
  if (removed.count > 0) console.log(`cleared ${removed.count} previous demo project(s)`);

  for (const spec of PROJECTS) {
    const project = await prisma.project.create({
      data: { name: spec.name, key: spec.key },
    });
    project.host = spec.host;
    for (let i = 0; i < spec.sessions; i += 1) {
      await seedSession(project, i);
    }
    console.log(`seeded ${spec.sessions} sessions into "${spec.name}"`);
  }

  const total = PROJECTS.reduce((sum, p) => sum + p.sessions, 0);
  console.log(`done — ${total} replayable sessions across ${PROJECTS.length} projects`);
  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
