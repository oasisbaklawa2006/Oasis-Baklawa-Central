/**
 * Read-only Batch 001 buyer-pilot readiness report generator.
 * Canonical product/snapshot data from src/lib/language-wave/.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  BATCH001_LIVE_HEALTH_SNAPSHOT,
  BATCH001_PRODUCTS,
  BATCH001_WAVE2C_SKUS,
  assessBatch001LanguageCoverage,
  batchHealthPercent,
  buildWave2cProposals,
  runResolverCoverage,
  scoreCatalogueHealth,
} from "../src/lib/language-wave/index.ts";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORTAL = process.env.B2B_PORTAL_URL || "https://b2b.oasisbaklawa.com";
const OUT = join(ROOT, "docs/BATCH001_CATALOGUE_READINESS.md");

const TOTAL = BATCH001_PRODUCTS.length;
const WAVE2C_SKU_SET = new Set<string>(BATCH001_WAVE2C_SKUS);
const snapBySku = new Map(BATCH001_LIVE_HEALTH_SNAPSHOT.map((s) => [s.sku, s]));

const liveAliasSkus = new Set(
  BATCH001_LIVE_HEALTH_SNAPSHOT.filter((s) => s.table_alias_count > 0).map((s) => s.sku),
);
const languageRows = assessBatch001LanguageCoverage(liveAliasSkus);
const langBySku = new Map(languageRows.map((r) => [r.sku, r]));
const resolverRows = runResolverCoverage([], []);
const resolverBySku = new Map(resolverRows.map((r) => [r.sku, r]));

const wave2cProposals = buildWave2cProposals();
const wave2cTermsBySku = new Map<string, number>();
for (const proposal of wave2cProposals) {
  wave2cTermsBySku.set(proposal.sku, (wave2cTermsBySku.get(proposal.sku) ?? 0) + 1);
}
const wave2cTotalTerms = wave2cProposals.length;
const wave2cTermsPerSku =
  WAVE2C_SKU_SET.size > 0 ? wave2cTotalTerms / WAVE2C_SKU_SET.size : 0;

const healthRows = scoreCatalogueHealth(BATCH001_LIVE_HEALTH_SNAPSHOT);
const batchHealthPct = batchHealthPercent(healthRows);

interface AuditedRow {
  sku: string;
  productId: string;
  name: string;
  category: string;
  packSize: string;
  url: string;
  hasImage: boolean;
  visibleInCatalog: boolean;
  uom: string | null;
  packSizeLive: string | null;
  liveAliasCount: number;
  wave2cPending: boolean;
  languageComplete: boolean;
  languageSource: string;
  resolverPass: boolean;
  hasDescription: boolean;
  categoryOk: boolean;
  packOk: boolean;
  urlOk: boolean;
  searchOk: boolean;
  pilotReady: boolean;
  blockers: string[];
}

function hasLiveAliases(sku: string): boolean {
  return (snapBySku.get(sku)?.table_alias_count ?? 0) > 0;
}

function isPilotReady(row: AuditedRow): boolean {
  return (
    row.hasImage &&
    row.liveAliasCount > 0 &&
    row.hasDescription &&
    row.categoryOk &&
    row.packOk &&
    row.urlOk &&
    row.searchOk
  );
}

const audited: AuditedRow[] = BATCH001_PRODUCTS.map((p) => {
  const snap = snapBySku.get(p.sku);
  const lang = langBySku.get(p.sku);
  const resolver = resolverBySku.get(p.sku);
  const url = `${PORTAL}/product/${p.productId}`;
  const hasDescription = false; // not captured in 2026-06-09 live audit snapshot
  const categoryOk = Boolean(p.category?.trim());
  const packOk = Boolean(snap?.pack_size?.trim() && snap?.uom?.trim());
  const urlOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    p.productId,
  );

  const row: AuditedRow = {
    sku: p.sku,
    productId: p.productId,
    name: p.name,
    category: p.category,
    packSize: p.packSize,
    url,
    hasImage: snap?.has_image ?? false,
    visibleInCatalog: snap?.visible_in_catalog ?? false,
    uom: snap?.uom ?? null,
    packSizeLive: snap?.pack_size ?? null,
    liveAliasCount: snap?.table_alias_count ?? 0,
    wave2cPending: WAVE2C_SKU_SET.has(p.sku),
    languageComplete: lang?.complete ?? false,
    languageSource: lang?.source ?? "unknown",
    resolverPass: resolver?.resolved ?? false,
    hasDescription,
    categoryOk,
    packOk,
    urlOk,
    searchOk: snap?.visible_in_catalog === true,
    pilotReady: false,
    blockers: [],
  };

  row.pilotReady = isPilotReady(row);

  if (!row.hasImage) row.blockers.push("missing_image");
  if (!hasLiveAliases(p.sku)) {
    row.blockers.push(
      row.wave2cPending ? "missing_live_aliases_wave2c_pending" : "missing_aliases",
    );
  }
  if (!row.hasDescription) row.blockers.push("missing_description_unverified");
  if (!row.categoryOk) row.blockers.push("missing_category");
  if (!row.packOk) row.blockers.push("missing_pack_or_uom");
  if (!row.urlOk) row.blockers.push("invalid_product_url");
  if (!row.visibleInCatalog) row.blockers.push("not_visible_in_catalog");
  if (!row.resolverPass) row.blockers.push("resolver_clarification");

  return row;
});

const ready = audited.filter((r) => r.pilotReady);
const blocked = audited.filter((r) => !r.pilotReady);
const missingImages = audited.filter((r) => !r.hasImage);
const missingAliases = audited.filter((r) => r.liveAliasCount === 0);
const missingDescriptions = audited.filter((r) => !r.hasDescription);
const notVisible = audited.filter((r) => !r.visibleInCatalog);
const resolverFailures = audited.filter((r) => !r.resolverPass);

const nearReady = audited.filter(
  (r) => hasLiveAliases(r.sku) && !r.hasImage && !r.visibleInCatalog && r.resolverPass,
);

const liveWithAliases = audited.filter((r) => r.liveAliasCount > 0);
const liveAliasMin =
  liveWithAliases.length > 0
    ? Math.min(...liveWithAliases.map((r) => r.liveAliasCount))
    : 0;
const liveAliasMax =
  liveWithAliases.length > 0
    ? Math.max(...liveWithAliases.map((r) => r.liveAliasCount))
    : 0;

const languageCompleteCount = languageRows.filter((r) => r.complete).length;
const resolverPassCount = resolverRows.filter((r) => r.resolved).length;
const resolverPassPct = TOTAL > 0 ? Math.round((resolverPassCount / TOTAL) * 100) : 0;

const categoryCounts = new Map<string, number>();
for (const p of BATCH001_PRODUCTS) {
  categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
}

const packCounts = new Map<string, number>();
for (const snap of BATCH001_LIVE_HEALTH_SNAPSHOT) {
  if (snap.pack_size) {
    packCounts.set(snap.pack_size, (packCounts.get(snap.pack_size) ?? 0) + 1);
  }
}

function bulletList(rows: Array<{ sku: string; name: string }>): string {
  if (rows.length === 0) return "_None._\n";
  return rows.map((r) => `- **${r.sku}** — ${r.name}`).join("\n");
}

function buildVerdict(): string {
  if (ready.length === TOTAL) {
    return `Batch 001 is **ready** for buyer-facing pilot — all ${TOTAL} SKUs pass every criterion.`;
  }

  const parts: string[] = [
    `Batch 001 is **not ready** for buyer-facing pilot.`,
  ];

  if (blocked.length === TOTAL) {
    parts.push(`All ${TOTAL} SKUs are blocked.`);
  } else {
    parts.push(`${blocked.length} of ${TOTAL} SKUs are blocked.`);
  }

  const common: string[] = [];
  if (missingImages.length > 0) {
    common.push(`missing images (${missingImages.length}/${TOTAL})`);
  }
  if (notVisible.length > 0) {
    common.push(`not buyer-visible (${notVisible.length}/${TOTAL})`);
  }
  if (missingDescriptions.length > 0) {
    common.push(`unverified descriptions (${missingDescriptions.length}/${TOTAL})`);
  }
  if (common.length > 0) {
    parts.push(`Common gaps: ${common.join("; ")}.`);
  }

  if (missingAliases.length > 0) {
    parts.push(
      `${missingAliases.length} SKU(s) lack **live** \`product_aliases\` rows (Wave 2C: ${wave2cTotalTerms} draft terms across ${WAVE2C_SKU_SET.size} SKUs, ${wave2cTermsPerSku} per SKU — pending governed approval).`,
    );
  }

  return parts.join(" ");
}

function buildPromotionSequence(): string {
  const steps: string[] = [];
  let n = 1;

  if (missingAliases.length > 0) {
    steps.push(
      `${n++}. **Approve Wave 2C alias drafts** — closes live alias gap for ${missingAliases.length} SKU(s) (${wave2cTotalTerms} terms total, ${wave2cTermsPerSku} per SKU)`,
    );
  }
  if (missingImages.length > 0) {
    steps.push(
      `${n++}. **Upload product images** — ${missingImages.length} SKU(s) missing \`image_url\``,
    );
  }
  if (missingDescriptions.length > 0) {
    steps.push(
      `${n++}. **Write/verify buyer descriptions** — ${missingDescriptions.length} SKU(s) need \`products.description\` confirmation`,
    );
  }
  if (notVisible.length > 0) {
    steps.push(
      `${n++}. **Flip \`visible_in_catalog\`** — ${notVisible.length} SKU(s) when media, aliases, and copy are complete`,
    );
  }
  if (resolverFailures.length > 0) {
    const skuList = resolverFailures.map((r) => r.sku).join(", ");
    steps.push(
      `${n++}. **Resolver hardening** — ${resolverFailures.length} SKU(s): ${skuList}`,
    );
  }

  return steps.length > 0 ? steps.join("\n") : "_No promotion steps required._";
}

const md = `# Batch 001 Catalogue Readiness

**Generated:** ${new Date().toISOString().slice(0, 10)}  
**Batch:** ${TOTAL} Baklawa SKUs (\`OAS-AS-BKL-0001\` … \`OAS-AS-BKL-0025\`)  
**Purpose:** Buyer-facing pilot readiness (read-only audit — no production changes)  
**Primary source:** \`src/lib/language-wave/catalogueHealth.ts\` (\`BATCH001_LIVE_HEALTH_SNAPSHOT\`, 2026-06-09 Central audit)  
**Batch health score:** ${batchHealthPct}% (seven-dimension catalogue health, not pilot-ready gate)

---

## Executive summary

| Metric | Count |
|--------|------:|
| **Pilot-ready products** | **${ready.length} / ${TOTAL}** |
| **Blocked products** | **${blocked.length} / ${TOTAL}** |
| Missing images | ${missingImages.length} / ${TOTAL} |
| Missing live aliases (Wave 2C pending) | ${missingAliases.length} / ${TOTAL} |
| Missing descriptions (unverified in live audit) | ${missingDescriptions.length} / ${TOTAL} |
| Not buyer-visible (\`visible_in_catalog = false\`) | ${notVisible.length} / ${TOTAL} |
| Near-ready (live aliases + resolver pass; media/visibility/description gap) | ${nearReady.length} / ${TOTAL} |
| Resolver primary-alias pass rate | ${resolverPassCount} / ${TOTAL} (${resolverPassPct}%) |

**Verdict:** ${buildVerdict()}

---

## Pilot readiness criteria

A SKU is **pilot-ready** only when **all seven** checks pass:

| # | Dimension | Criterion |
|---|-----------|-----------|
| 1 | Image | \`image_url\` present (live: \`has_image = true\`) |
| 2 | Alias coverage | ≥1 live \`product_aliases\` row (Wave 2C drafts alone do not count) |
| 3 | Description | Non-empty \`products.description\` |
| 4 | Category | \`category\` assigned on product record |
| 5 | Pack size | \`pack_size\` + \`uom\` populated |
| 6 | Product URL | Deep link \`${PORTAL}/product/{uuid}\` with valid product UUID |
| 7 | Search discoverability | \`visible_in_catalog = true\` (buyer catalogue + search) |

---

## Ready products (${ready.length})

${ready.length === 0 ? "_No SKUs meet all seven pilot criteria._\n" : bulletList(ready)}

---

## Blocked products (${blocked.length})

${bulletList(blocked)}

### Blocker breakdown

| Blocker | SKUs |
|---------|-----:|
| Missing image | ${missingImages.length} |
| Not visible in catalogue | ${notVisible.length} |
| Missing live aliases | ${missingAliases.length} |
| Description unverified | ${missingDescriptions.length} |
| Missing category | ${audited.filter((r) => !r.categoryOk).length} |
| Missing pack / UOM | ${audited.filter((r) => !r.packOk).length} |
| Invalid product URL | ${audited.filter((r) => !r.urlOk).length} |
| Resolver clarification / wrong match | ${resolverFailures.length} |

---

## Missing images (${missingImages.length})

${missingImages.length === TOTAL ? `All ${TOTAL} Batch 001 SKUs lack \`image_url\` in the live snapshot.` : `${missingImages.length} SKU(s) lack \`image_url\`.`} Buyer catalogue shows a placeholder package icon when absent.

${bulletList(missingImages)}

---

## Missing aliases (${missingAliases.length})

${missingAliases.length === 0 ? "_All SKUs have at least one live alias row._" : `These ${missingAliases.length} SKU(s) have **zero live** \`product_aliases\` rows. Wave 2C language packs (${wave2cTermsPerSku} terms per SKU, **${wave2cTotalTerms} total** across ${WAVE2C_SKU_SET.size} SKUs) are prepared but **pending governed approval** — not counted as live coverage.`}

${bulletList(missingAliases)}

${
  missingAliases.length > 0
    ? `| SKU | Wave 2C status |
|-----|----------------|
${missingAliases
  .map((r) => {
    const terms = wave2cTermsBySku.get(r.sku) ?? 0;
    return `| ${r.sku} | Pending (${terms} SAFE_TO_APPROVE terms; ${wave2cTotalTerms} total across ${missingAliases.length} SKUs) |`;
  })
  .join("\n")}`
    : ""
}

**Live alias coverage (${liveWithAliases.length} / ${TOTAL}):** SKUs with live rows have ${liveAliasMin}–${liveAliasMax} alias row(s) each.

---

## Missing descriptions (${missingDescriptions.length})

The 2026-06-09 Central read-only audit **did not include** \`products.description\`. Anon/staff-unauthenticated REST probes return empty under RLS, so description presence cannot be confirmed without an authenticated staff read.

**Conservative pilot stance:** treat ${missingDescriptions.length} SKU(s) as **description-unverified** until merchandising confirms copy.

${bulletList(missingDescriptions)}

---

## Dimension audit

### 1. Image availability

| Status | Count |
|--------|------:|
| Has image | ${audited.filter((r) => r.hasImage).length} |
| Missing image | ${missingImages.length} |

### 2. Alias coverage

| Status | Count |
|--------|------:|
| Live aliases (≥1 row) | ${liveWithAliases.length} |
| Wave 2C pending only | ${missingAliases.filter((r) => r.wave2cPending).length} |
| Typed language complete (incl. drafts) | ${languageCompleteCount} / ${TOTAL} |

### 3. Product descriptions

| Status | Count |
|--------|------:|
| Verified present | ${audited.filter((r) => r.hasDescription).length} |
| Unverified / assumed missing | ${missingDescriptions.length} |

### 4. Categories

| Category | SKUs |
|----------|-----:|
${[...categoryCounts.entries()].map(([cat, n]) => `| ${cat} | ${n} |`).join("\n")}

${audited.filter((r) => r.categoryOk).length} / ${TOTAL} SKUs pass category check.

### 5. Pack sizes

| Pack | SKUs |
|------|-----:|
${[...packCounts.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([pack, n]) => `| ${pack} | ${n} |`).join("\n")}

${audited.filter((r) => r.packOk).length} / ${TOTAL} SKUs have \`pack_size\` and \`uom\` in live snapshot.

### 6. Product URLs

${audited.filter((r) => r.urlOk).length} / ${TOTAL} deep links are structurally valid (require buyer auth before render):

| SKU | URL | Valid |
|-----|-----|:-----:|
${audited.map((r) => `| ${r.sku} | ${r.url} | ${r.urlOk ? "✓" : "✗"} |`).join("\n")}

### 7. Search discoverability

| Check | Result |
|-------|--------|
| \`visible_in_catalog = true\` | ${audited.filter((r) => r.searchOk).length} / ${TOTAL} |
| Buyer \`useProducts\` filter (\`is_active\` + \`visible_in_catalog\`) | Hidden SKUs excluded when promoted |
| Resolver primary-alias pass rate | ${resolverPassCount} / ${TOTAL} (${resolverPassPct}%)${resolverFailures.length > 0 ? ` — ${resolverFailures.map((r) => r.sku.replace("OAS-AS-BKL-", "")).join(", ")} need clarification` : ""} |

---

## Per-SKU matrix

| SKU | Product | Image | Live aliases | Description | Category | Pack | URL | Search visible | Pilot ready |
|-----|---------|:-----:|:------------:|:-----------:|:--------:|:----:|:---:|:--------------:|:-----------:|
${audited
  .map(
    (r) =>
      `| ${r.sku} | ${r.name} | ${r.hasImage ? "✓" : "✗"} | ${r.liveAliasCount}${r.wave2cPending ? "†" : ""} | ${r.hasDescription ? "✓" : "?"} | ${r.categoryOk ? "✓" : "✗"} | ${r.packOk ? "✓" : "✗"} | ${r.urlOk ? "✓" : "✗"} | ${r.searchOk ? "✓" : "✗"} | ${r.pilotReady ? "✓" : "✗"} |`,
  )
  .join("\n")}

† Wave 2C alias pack pending approval (not live).

---

## Near-ready shortlist (${nearReady.length})

SKUs with live aliases and resolver pass; blocked only on **image**, **visibility**, and **description verification**:

${bulletList(nearReady)}

---

## Recommended promotion sequence (no action taken in this audit)

${buildPromotionSequence()}

---

## Evidence

- \`src/lib/language-wave/batch001Manifest.ts\` — SKU authority + product UUIDs
- \`src/lib/language-wave/catalogueHealth.ts\` — \`BATCH001_LIVE_HEALTH_SNAPSHOT\`
- \`src/lib/language-wave/wave2cPack.ts\` — Wave 2C term proposals
- \`docs/evidence/batch-001/language-coverage.json\` — historical snapshot
- \`docs/evidence/batch-001/resolver-coverage.json\` — historical snapshot
- \`docs/BATCH001_CATALOGUE_HEALTH_REPORT.md\`
- \`docs/BATCH001_LANGUAGE_COMPLETION_REPORT.md\`

---

*Read-only audit. No SQL, migrations, production writes, or approvals were performed.*
`;

writeFileSync(OUT, md);
console.log("Wrote", OUT);
console.log(
  `Pilot-ready: ${ready.length}/${TOTAL} | Blocked: ${blocked.length}/${TOTAL} | Near-ready: ${nearReady.length}/${TOTAL} | Resolver pass: ${resolverPassCount}/${TOTAL}`,
);
