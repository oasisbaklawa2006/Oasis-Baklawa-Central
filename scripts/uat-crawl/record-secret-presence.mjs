#!/usr/bin/env node
/** Record governed TEST_* secret presence (names only) for watchdog audit. */
import fs from "node:fs";
import path from "node:path";
import { SECRET_AUDIT_NAMES } from "./credential-prefix-aliases.mjs";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";

const presence = SECRET_AUDIT_NAMES.map((name) => ({
  name,
  present: Boolean(process.env[name]?.trim()),
}));

const outPath = path.join(ROOT, "docs/uat-crawl/UAT_SECRET_PRESENCE.json");
const payload = {
  generatedAt: new Date().toISOString(),
  runId: RUN_ID,
  runTranche: RUN_TRANCHE,
  presentCount: presence.filter((p) => p.present).length,
  missingCount: presence.filter((p) => !p.present).length,
  resolvedPreviewUrlSource:
    process.env.UAT_CRAWL_TARGET_TYPE?.trim() ||
    (process.env.UAT_CRAWL_BASE_URL?.trim() ? "crawl-base-url" : "unknown"),
  crawlBaseUrl: process.env.UAT_CRAWL_BASE_URL?.trim() || null,
  protectedDeploymentUrl: process.env.UAT_PROTECTED_DEPLOYMENT_URL?.trim() || null,
  aliasPolicy:
    "TEST_GATE accepts TEST_GATE_* or TEST_GATE_SECURITY_*; TEST_3PGS accepts TEST_3PGS_* or TEST_PRODUCTION_* at crawl runtime.",
  secrets: presence,
  policy: "Names only — values never logged. Current-run audit — historical blocker rows do not override this.",
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Recorded secret presence audit: ${payload.presentCount} present, ${payload.missingCount} missing.`,
);
