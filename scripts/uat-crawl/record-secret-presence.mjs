#!/usr/bin/env node
/** Record governed TEST_* secret presence (names only) for watchdog audit. */
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const RUN_ID = process.env.GITHUB_RUN_ID || "local";
const RUN_TRANCHE = process.env.RUN_TRANCHE || "watchdog-continue";

const SECRET_NAMES = [
  "TEST_PREVIEW_URL",
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
  "TEST_BUYER_EMAIL",
  "TEST_BUYER_PASSWORD",
  "TEST_SALES_EMAIL",
  "TEST_SALES_PASSWORD",
  "TEST_FINANCE_EMAIL",
  "TEST_FINANCE_PASSWORD",
  "TEST_ASSEMBLY_EMAIL",
  "TEST_ASSEMBLY_PASSWORD",
  "TEST_DISPATCH_EMAIL",
  "TEST_DISPATCH_PASSWORD",
  "TEST_OPERATIONS_EMAIL",
  "TEST_OPERATIONS_PASSWORD",
  "TEST_GATE_SECURITY_EMAIL",
  "TEST_GATE_SECURITY_PASSWORD",
  "TEST_RGS_EMAIL",
  "TEST_RGS_PASSWORD",
  "TEST_PRODUCTION_EMAIL",
  "TEST_PRODUCTION_PASSWORD",
  "TEST_TV_RGS_EMAIL",
  "TEST_TV_RGS_PASSWORD",
  "TEST_TV_PRODUCTION_EMAIL",
  "TEST_TV_PRODUCTION_PASSWORD",
  "TEST_AI_STUDIO_PREVIEW_URL",
  "TEST_TRACE_PREVIEW_URL",
];

const presence = SECRET_NAMES.map((name) => ({
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
  secrets: presence,
  policy: "Names only — values never logged.",
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(
  `Recorded secret presence audit: ${payload.presentCount} present, ${payload.missingCount} missing.`,
);
