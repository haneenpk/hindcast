// Re-records the demo fixtures from the real Fernwood shop.
//
//   pnpm seed:capture
//
// Builds apps/demo against a throwaway capture endpoint, serves the build,
// drives a real browser through each journey at human pace, and writes what
// the SDK sent to fixtures/<journey>.json — the exact shape seed.mjs loads.
// Run it whenever the shop's look changes; the recordings are only as good
// as the site in them.
//
// Uses the Edge/Chrome already installed (CAPTURE_CHANNEL, default msedge);
// playwright-core never downloads a browser.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..", "..", "..");
const dist = join(repo, "apps", "demo", "dist");
const fixturesDir = join(here, "..", "fixtures");

const SHOP_PORT = 4173;
const INGEST_PORT = 4199;
const SHOP = `http://localhost:${SHOP_PORT}`;

const SOURCES = {
  window_error: "WINDOW_ERROR",
  unhandled_rejection: "UNHANDLED_REJECTION",
  console_error: "CONSOLE_ERROR",
};

// ------------------------------------------------------------------ build

console.log("building the shop against the capture endpoint…");
const build = spawnSync("pnpm --filter @hindcast/demo build", {
  cwd: repo,
  shell: true,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_HINDCAST_KEY: "capture",
    VITE_HINDCAST_ENDPOINT: `http://localhost:${INGEST_PORT}`,
  },
});
if (build.status !== 0) process.exit(build.status ?? 1);

// ------------------------------------------------------------------ servers

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
};

// The shop: static files with the SPA fallback. There is no /api — any
// POST 404s, which is what the planted stock-check and newsletter bugs need.
const shop = createServer((req, res) => {
  if (req.method !== "GET") {
    res.writeHead(404).end();
    return;
  }
  const path = normalize(decodeURIComponent(new URL(req.url, SHOP).pathname));
  const file = join(dist, path);
  const target = file.startsWith(dist) && existsSync(file) && extname(file) ? file : join(dist, "index.html");
  res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
  res.end(readFileSync(target));
});

// The capture endpoint stands in for ingest: it just keeps every batch.
let batches = [];
const ingest = createServer((req, res) => {
  const headers = { "access-control-allow-origin": "*" };
  if (req.method !== "POST") {
    res.writeHead(204, { ...headers, "access-control-allow-headers": "content-type" }).end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (req.url.startsWith("/v1/events")) {
      try {
        batches.push(JSON.parse(body));
      } catch {
        /* a torn beacon is dropped, same as ingest would */
      }
    }
    res.writeHead(202, headers).end();
  });
});

await new Promise((resolve) => shop.listen(SHOP_PORT, resolve));
await new Promise((resolve) => ingest.listen(INGEST_PORT, resolve));

// ------------------------------------------------------------------ pacing

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Glide the cursor to an element and click it, the way a person would —
// Playwright's own click teleports, which replays as a jump-cut.
async function glideClick(page, locator, { settle = 350 } = {}) {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 22 });
  await pause(settle);
  await page.mouse.click(x, y);
}

async function typeInto(page, locator, text) {
  await glideClick(page, locator, { settle: 180 });
  await page.keyboard.type(text, { delay: 55 });
  await pause(220);
}

async function scrollBy(page, total, step = 90) {
  for (let moved = 0; moved < total; moved += step) {
    await page.mouse.wheel(0, step);
    await pause(45);
  }
}

// ------------------------------------------------------------------ journeys

const JOURNEYS = {
  // The story the demo is about: a customer who wants to buy, hits two
  // failures, and still pushes through to the order.
  "checkout-crash": async (page) => {
    await page.goto(`${SHOP}/`);
    await pause(1400);
    await page.mouse.move(420, 380, { steps: 25 });
    await pause(500);
    await scrollBy(page, 760);
    await pause(900);
    await glideClick(page, page.getByRole("link", { name: /Walnut Writing Desk/ }).first());
    await pause(1500);

    await glideClick(page, page.getByRole("button", { name: "Check availability" }));
    await pause(1600);
    await glideClick(page, page.getByRole("button", { name: /Add to cart/ }));
    await pause(1300);

    await glideClick(page, page.getByRole("link", { name: "Check out" }));
    await pause(1100);

    await typeInto(page, page.getByLabel("Email", { exact: true }), "maya.lindqvist@example.com");
    await typeInto(page, page.getByLabel("Full name", { exact: true }), "Maya Lindqvist");
    await typeInto(page, page.getByLabel("Address", { exact: true }), "Östra Hamngatan 12");
    await typeInto(page, page.getByLabel("City", { exact: true }), "Göteborg");
    await typeInto(page, page.getByLabel("Postcode", { exact: true }), "411 10");
    await typeInto(page, page.getByLabel("Card number", { exact: true }), "4242 4242 4242 4242");
    await typeInto(page, page.getByLabel("Expiry", { exact: true }), "08 / 29");
    await typeInto(page, page.getByLabel("CVC", { exact: true }), "123");
    await pause(500);

    const coupon = page.getByLabel("Coupon code", { exact: true });
    await typeInto(page, coupon, "AUTUMN20");
    await glideClick(page, page.getByRole("button", { name: "Apply" }));
    await pause(1400);
    // Nothing visibly happened, so they try again — the second crash.
    await glideClick(page, page.getByRole("button", { name: "Apply" }), { settle: 150 });
    await pause(1500);

    await glideClick(page, coupon, { settle: 150 });
    await page.keyboard.press("Control+A");
    await page.keyboard.press("Backspace");
    await pause(600);
    await glideClick(page, page.getByRole("button", { name: /Place order/ }));
    await pause(2200);
  },

  // A visitor who browses, filters, looks at one piece and leaves.
  "browse-bounce": async (page) => {
    await page.goto(`${SHOP}/`);
    await pause(1500);
    await scrollBy(page, 700);
    await pause(800);
    await glideClick(page, page.getByRole("button", { name: "Storage", exact: true }));
    await pause(1100);
    await glideClick(page, page.getByRole("button", { name: "All", exact: true }));
    await pause(900);
    await glideClick(page, page.getByRole("link", { name: /Oak Bookshelf/ }).first());
    await pause(1800);
    await scrollBy(page, 900);
    await pause(1500);
  },

  // Two pieces into the cart, a quantity change, then gone.
  "cart-abandon": async (page) => {
    await page.goto(`${SHOP}/products/linen-lounge-chair`);
    await pause(1600);
    await glideClick(page, page.getByRole("button", { name: /Add to cart/ }));
    await pause(1300);
    await glideClick(page, page.getByRole("link", { name: "Shop", exact: true }).first());
    await pause(900);
    await scrollBy(page, 760);
    await pause(700);
    await glideClick(page, page.getByRole("link", { name: /Brass Table Lamp/ }).first());
    await pause(1400);
    await glideClick(page, page.getByRole("button", { name: "Increase quantity" }));
    await pause(500);
    await glideClick(page, page.getByRole("button", { name: /Add to cart/ }));
    await pause(1500);
    await glideClick(page, page.getByRole("button", { name: "Increase quantity" }).first());
    await pause(1800);
  },
};

// ------------------------------------------------------------------ capture

function toFixture(recorded) {
  const events = recorded.flatMap((b) => b.events ?? []).sort((a, b) => a.timestamp - b.timestamp);
  const errors = recorded
    .flatMap((b) => b.errors ?? [])
    .map((e) => ({
      timestamp: e.timestamp,
      source: SOURCES[e.source],
      message: e.message,
      stack: e.stack ?? null,
      pageUrl: e.url ?? null,
    }));
  const network = recorded
    .flatMap((b) => b.network ?? [])
    .map((n) => ({
      timestamp: n.timestamp,
      method: n.method,
      url: n.url,
      status: n.status ?? null,
      durationMs: n.durationMs,
    }));
  return { events, errors, network };
}

const browser = await chromium.launch({
  channel: process.env.CAPTURE_CHANNEL ?? "msedge",
  headless: process.env.CAPTURE_HEADED ? false : true,
});

try {
  for (const [name, journey] of Object.entries(JOURNEYS)) {
    batches = [];
    // A fresh context per journey means fresh storage: a new session id.
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await journey(page);
    // Let the 5s interval flush fire, then close — pagehide sends the rest.
    await pause(5600);
    await page.close({ runBeforeUnload: true });
    await pause(1200);
    await context.close();

    const fixture = toFixture(batches);
    const span = fixture.events.at(-1).timestamp - fixture.events[0].timestamp;
    writeFileSync(join(fixturesDir, `${name}.json`), JSON.stringify(fixture));
    console.log(
      `${name.padEnd(15)} ${String(fixture.events.length).padStart(4)} events · ` +
        `${fixture.errors.length} errors · ${fixture.network.length} requests · ${(span / 1000).toFixed(1)}s`,
    );
  }
} finally {
  await browser.close();
  shop.close();
  ingest.close();
}
