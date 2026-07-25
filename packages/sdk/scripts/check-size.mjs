import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// The embeddable recorder must never bloat the sites that host it. This
// fails the build if the gzipped r.js crosses the budget — the number a
// visitor actually downloads.
const BUDGET_KB = 70;

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "dist", "r.js");

if (!existsSync(file)) {
  console.error("dist/r.js not found — run `pnpm build` first");
  process.exit(1);
}

const raw = readFileSync(file);
const rawKb = raw.length / 1024;
const gzipKb = gzipSync(raw).length / 1024;
const withinBudget = gzipKb <= BUDGET_KB;

console.log(
  `r.js: ${rawKb.toFixed(1)} KB raw, ${gzipKb.toFixed(1)} KB gzipped ` +
    `(budget ${BUDGET_KB} KB) — ${withinBudget ? "ok" : "OVER BUDGET"}`,
);

if (!withinBudget) process.exit(1);
