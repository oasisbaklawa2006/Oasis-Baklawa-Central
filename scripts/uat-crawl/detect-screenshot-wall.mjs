#!/usr/bin/env node
/** Detect possible deployment/auth walls via duplicate screenshot hashes across routes. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const MIN_ROUTES = Number.parseInt(process.env.UAT_SCREENSHOT_WALL_MIN_ROUTES || "5", 10);

function loadJsonl(relativePath) {
  const filePath = path.join(ROOT, relativePath);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

const rows = [
  ...loadJsonl("docs/uat-crawl/UAT_MANIFEST.jsonl"),
  ...loadJsonl("docs/uat-crawl/UAT_MANIFEST_AUTH.jsonl"),
  ...loadJsonl("docs/uat-crawl/UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl"),
].filter((row) => !row.runId || row.runId === RUN_ID);

const byHash = new Map();
for (const row of rows) {
  if (!row.screenshotSha256 || row.visualStatus === "BLOCKED") continue;
  const list = byHash.get(row.screenshotSha256) ?? [];
  list.push(row);
  byHash.set(row.screenshotSha256, list);
}

let wallDetected = false;
const walls = [];
for (const [hash, group] of byHash) {
  const routes = new Set(group.map((r) => r.route));
  if (group.length >= MIN_ROUTES && routes.size >= MIN_ROUTES) {
    wallDetected = true;
    walls.push({ hash, uatIds: group.map((r) => r.uatId), routes: [...routes] });
  }
}

const outPath = path.join(ROOT, "docs/uat-crawl/UAT_SCREENSHOT_WALL_AUDIT.json");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(
  outPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      runId: RUN_ID,
      wallDetected,
      minRoutes: MIN_ROUTES,
      walls,
      policy:
        "Duplicate hashes across many routes may indicate Vercel auth wall — combined with title/URL/origin guards, not standalone defect classification.",
    },
    null,
    2,
  )}\n`,
);

if (wallDetected) {
  console.error(
    `::warning::Possible screenshot wall detected — ${walls.length} hash group(s) shared across >=${MIN_ROUTES} routes.`,
  );
} else {
  console.log("Screenshot wall audit: no dominant duplicate-hash wall detected.");
}
