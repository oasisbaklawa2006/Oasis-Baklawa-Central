#!/usr/bin/env node
/**
 * Read-only Batch 001 language wave runner — emits scan JSON under docs/evidence/batch-001/.
 * No database writes.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "docs/evidence/batch-001");

async function main() {
  const mod = await import("../src/lib/language-wave/index.ts");
  const proposals = mod.buildWave2cProposals();
  const scan = mod.scanLanguagePack(mod.WAVE2C_ID, proposals);
  const safe = mod.filterSafeToApprove(
    mod.classifyLanguagePack(proposals),
  );
  const payloads = mod.buildAliasDraftPayloads(safe);
  const liveSkus = new Set(
    mod.BATCH001_SKUS.filter((sku) => !mod.BATCH001_WAVE2C_SKUS.includes(sku)),
  );
  const languageCoverage = mod.assessBatch001LanguageCoverage(liveSkus);
  const resolverRows = mod.runResolverCoverage(payloads);
  const healthRows = mod.scoreCatalogueHealth(mod.BATCH001_LIVE_HEALTH_SNAPSHOT);

  mkdirSync(outDir, { recursive: true });

  writeFileSync(join(outDir, "wave-2c-scan.json"), JSON.stringify(scan, null, 2));
  writeFileSync(join(outDir, "wave-2c-draft-payloads.json"), JSON.stringify(payloads, null, 2));
  writeFileSync(join(outDir, "language-coverage.json"), JSON.stringify(languageCoverage, null, 2));
  writeFileSync(
    join(outDir, "resolver-coverage.json"),
    JSON.stringify(
      {
        percent: mod.resolverCoveragePercent(resolverRows),
        rows: resolverRows,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(outDir, "catalogue-health.json"),
    JSON.stringify(
      {
        batch_percent: mod.batchHealthPercent(healthRows),
        rows: healthRows,
      },
      null,
      2,
    ),
  );
  writeFileSync(
    join(outDir, "live-collisions.json"),
    JSON.stringify(mod.BATCH001_LIVE_COLLISIONS, null, 2),
  );

  console.log("Batch 001 language wave artifacts written to", outDir);
  console.log("Wave 2C safe terms:", scan.safe_count, "/", scan.term_count);
  console.log("Language coverage:", languageCoverage.filter((c) => c.complete).length, "/ 25");
  console.log("Resolver coverage:", mod.resolverCoveragePercent(resolverRows), "%");
  console.log("Catalogue health:", mod.batchHealthPercent(healthRows), "%");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
