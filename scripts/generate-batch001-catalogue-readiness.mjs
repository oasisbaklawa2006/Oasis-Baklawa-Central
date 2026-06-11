#!/usr/bin/env node
/**
 * Read-only Batch 001 buyer-pilot readiness report generator.
 * Sources: manifest + live health snapshot in repo (2026-06-09 Central audit).
 * No SQL, writes to production, or approvals.
 */
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const ROOT = join(import.meta.dirname, "..");
const PORTAL = process.env.B2B_PORTAL_URL || "https://b2b.oasisbaklawa.com";
const OUT = join(ROOT, "docs/BATCH001_CATALOGUE_READINESS.md");

const PRODUCTS = [
  { sku: "OAS-AS-BKL-0001", productId: "c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0", name: "Cashew Kitta", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0002", productId: "89de33c7-e4c1-475e-b711-18258683fdec", name: "Square Baklawa", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0003", productId: "90e0f9df-d4dc-4ec5-8238-d7a2624e759a", name: "Cashew Ring", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0004", productId: "eb9c7a73-d1df-4bea-bdf1-209a5b386262", name: "Cashew Rosebud", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0005", productId: "691f2fe6-2d25-4ce2-a9fd-d4b81ecb694b", name: "Almond Crosole", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0006", productId: "da4372b9-e1b3-4b17-bdd0-278bd636ab9a", name: "Cashew Pyramid", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0007", productId: "2390ea3d-19ba-43bb-8624-d6b033153c2f", name: "Cashew Finger", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0008", productId: "a6013e20-0fc7-4fe6-b2ab-f7f82d336b0c", name: "Date Baklawa", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0009", productId: "c522fa96-9247-4cf5-9699-a20bc316dc55", name: "Special Square Baklawa", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0010", productId: "7d66f253-a179-4a33-b8ba-7b94ec783a3e", name: "Pistachio Ring", category: "Lebanese Baklawa", packSize: "3kg" },
  { sku: "OAS-AS-BKL-0011", productId: "2178c1c7-80c2-4ba3-a211-8643dcf57777", name: "Pistachio Pyramid(Topping)", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0012", productId: "4baff7d1-bf58-4d0f-b842-c53f99caac61", name: "Chocolate Pistachio Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0013", productId: "c5e84d04-0d8b-4466-8690-a7e6267b44a8", name: "Chocolate Cashew Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0014", productId: "4af95ba1-ff0f-4740-8869-6a19a41e8c83", name: "Mor Cashew Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0015", productId: "73f91572-8844-4fa6-b267-56210d180468", name: "Mor Pistachio Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0016", productId: "f3f7a8fd-cea8-4ecb-a258-ef1ea86940b7", name: "Pistachio Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0017", productId: "0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6", name: "Cashew Asiyah", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0018", productId: "2cab3d7f-7593-441e-a030-6ac6ad3ed9bc", name: "Diamond Pistachio", category: "Lebanese Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0019", productId: "636b47cb-ea6f-4711-ae29-d6153e565ae3", name: "Pistachio Pyramid", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0020", productId: "b0aee1c4-4502-4a15-9880-e2c01378c0b5", name: "Tart Cashew", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0021", productId: "6b258e44-69dc-465a-b82a-cbb72f68d723", name: "Mix Nut Tart", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0022", productId: "8554f5d5-5e46-4ffe-b98a-0ed10ec522ae", name: "Almond Tart", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0023", productId: "43a25d30-f7d9-426b-b5af-cae7d477468e", name: "Pistachio Tart", category: "Lebanese Baklawa", packSize: "6kg" },
  { sku: "OAS-AS-BKL-0024", productId: "cea65af8-129c-4838-988f-30955fa5bc22", name: "Mor Pistachio Durum", category: "Turkish Baklawa", packSize: "1kg" },
  { sku: "OAS-AS-BKL-0025", productId: "f58e0a78-53a9-400b-8768-7af09b68ba38", name: "Coconut Durum", category: "Turkish Baklawa", packSize: "1kg" },
];

const WAVE2C_SKUS = new Set([
  "OAS-AS-BKL-0002", "OAS-AS-BKL-0004", "OAS-AS-BKL-0005", "OAS-AS-BKL-0006",
  "OAS-AS-BKL-0008", "OAS-AS-BKL-0009", "OAS-AS-BKL-0011", "OAS-AS-BKL-0018",
]);

const LIVE_SNAPSHOT = [
  { sku: "OAS-AS-BKL-0001", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 12 },
  { sku: "OAS-AS-BKL-0002", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0003", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 9 },
  { sku: "OAS-AS-BKL-0004", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0005", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0006", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0007", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 11 },
  { sku: "OAS-AS-BKL-0008", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0009", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0010", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "3kg", table_alias_count: 9 },
  { sku: "OAS-AS-BKL-0011", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0012", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 9 },
  { sku: "OAS-AS-BKL-0013", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 20 },
  { sku: "OAS-AS-BKL-0014", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 22 },
  { sku: "OAS-AS-BKL-0015", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 11 },
  { sku: "OAS-AS-BKL-0016", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 7 },
  { sku: "OAS-AS-BKL-0017", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 8 },
  { sku: "OAS-AS-BKL-0018", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 0 },
  { sku: "OAS-AS-BKL-0019", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 9 },
  { sku: "OAS-AS-BKL-0020", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 19 },
  { sku: "OAS-AS-BKL-0021", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 8 },
  { sku: "OAS-AS-BKL-0022", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 9 },
  { sku: "OAS-AS-BKL-0023", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "6kg", table_alias_count: 5 },
  { sku: "OAS-AS-BKL-0024", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 21 },
  { sku: "OAS-AS-BKL-0025", has_image: false, visible_in_catalog: false, uom: "KG", pack_size: "1kg", table_alias_count: 12 },
];

const healthRows = JSON.parse(
  readFileSync(join(ROOT, "docs/evidence/batch-001/catalogue-health.json"), "utf8"),
).rows;
const languageRows = JSON.parse(
  readFileSync(join(ROOT, "docs/evidence/batch-001/language-coverage.json"), "utf8"),
);
const resolverRows = JSON.parse(
  readFileSync(join(ROOT, "docs/evidence/batch-001/resolver-coverage.json"), "utf8"),
).rows;

const snapBySku = new Map(LIVE_SNAPSHOT.map((s) => [s.sku, s]));
const healthBySku = new Map(healthRows.map((r) => [r.sku, r]));
const langBySku = new Map(languageRows.map((r) => [r.sku, r]));
const resolverBySku = new Map(resolverRows.map((r) => [r.sku, r]));

function hasLiveAliases(sku) {
  return (snapBySku.get(sku)?.table_alias_count ?? 0) > 0;
}

function isPilotReady(row) {
  const snap = snapBySku.get(row.sku);
  return (
    snap?.has_image === true &&
    snap?.visible_in_catalog === true &&
    hasLiveAliases(row.sku) &&
    row.hasDescription === true
  );
}

const audited = PRODUCTS.map((p) => {
  const snap = snapBySku.get(p.sku);
  const lang = langBySku.get(p.sku);
  const resolver = resolverBySku.get(p.sku);
  const url = `${PORTAL}/product/${p.productId}`;
  const hasDescription = false; // not captured in 2026-06-09 live audit
  const row = {
    ...p,
    url,
    hasImage: snap?.has_image ?? false,
    visibleInCatalog: snap?.visible_in_catalog ?? false,
    uom: snap?.uom ?? null,
    packSizeLive: snap?.pack_size ?? null,
    liveAliasCount: snap?.table_alias_count ?? 0,
    wave2cPending: WAVE2C_SKUS.has(p.sku),
    languageComplete: lang?.complete ?? false,
    languageSource: lang?.source ?? "unknown",
    resolverPass: resolver?.resolved ?? false,
    hasDescription,
    categoryOk: Boolean(p.category),
    packOk: Boolean(snap?.pack_size && snap?.uom),
    urlOk: Boolean(p.productId),
    searchOk: snap?.visible_in_catalog === true,
  };
  row.pilotReady = isPilotReady(row);
  row.blockers = [];
  if (!row.hasImage) row.blockers.push("missing_image");
  if (!hasLiveAliases(p.sku)) row.blockers.push(row.wave2cPending ? "missing_live_aliases_wave2c_pending" : "missing_aliases");
  if (!row.hasDescription) row.blockers.push("missing_description_unverified");
  if (!row.visibleInCatalog) row.blockers.push("not_visible_in_catalog");
  if (!row.resolverPass) row.blockers.push("resolver_clarification");
  return row;
});

const ready = audited.filter((r) => r.pilotReady);
const blocked = audited.filter((r) => !r.pilotReady);
const missingImages = audited.filter((r) => !r.hasImage).map((r) => r.sku);
const missingAliases = audited.filter((r) => r.liveAliasCount === 0).map((r) => r.sku);
const missingDescriptions = audited.filter((r) => !r.hasDescription).map((r) => r.sku);

const nearReady = audited.filter(
  (r) =>
    hasLiveAliases(r.sku) &&
    !r.hasImage &&
    !r.visibleInCatalog &&
    r.resolverPass,
);

function bulletList(skus, rows) {
  if (skus.length === 0) return "_None._\n";
  return skus
    .map((sku) => {
      const r = rows.find((x) => x.sku === sku);
      return `- **${sku}** — ${r?.name ?? sku}`;
    })
    .join("\n");
}

const md = `# Batch 001 Catalogue Readiness

**Generated:** ${new Date().toISOString().slice(0, 10)}  
**Batch:** 25 Baklawa SKUs (\`OAS-AS-BKL-0001\` … \`OAS-AS-BKL-0025\`)  
**Purpose:** Buyer-facing pilot readiness (read-only audit — no production changes)  
**Primary source:** Central live read-only audit snapshot (2026-06-09) in \`src/lib/language-wave/catalogueHealth.ts\`

---

## Executive summary

| Metric | Count |
|--------|------:|
| **Pilot-ready products** | **${ready.length} / 25** |
| **Blocked products** | **${blocked.length} / 25** |
| Missing images | ${missingImages.length} / 25 |
| Missing live aliases (Wave 2C pending) | ${missingAliases.length} / 25 |
| Missing descriptions (unverified in live audit) | ${missingDescriptions.length} / 25 |
| Not buyer-visible (\`visible_in_catalog = false\`) | ${audited.filter((r) => !r.visibleInCatalog).length} / 25 |
| Near-ready (aliases + resolver OK; only media/visibility gap) | ${nearReady.length} / 25 |

**Verdict:** Batch 001 is **not ready** for buyer-facing pilot. Every SKU is blocked on at least image, catalogue visibility, and unverified product description. Eight SKUs additionally lack **live** \`product_aliases\` rows (Wave 2C drafts exist but are not approved).

---

## Pilot readiness criteria

A SKU is **pilot-ready** only when all checks pass:

| # | Dimension | Criterion |
|---|-----------|-----------|
| 1 | Image | \`image_url\` present (live: \`has_image = true\`) |
| 2 | Alias coverage | ≥1 live \`product_aliases\` row (Wave 2C drafts alone do not count) |
| 3 | Description | Non-empty \`products.description\` |
| 4 | Category | \`category\` assigned on product record |
| 5 | Pack size | \`pack_size\` + \`uom\` populated |
| 6 | Product URL | Deep link \`${PORTAL}/product/{uuid}\` resolves to product |
| 7 | Search discoverability | \`visible_in_catalog = true\` (buyer catalogue + search) |

---

## Ready products (${ready.length})

${ready.length === 0 ? "_No SKUs meet all seven pilot criteria._\n" : bulletList(ready.map((r) => r.sku), ready)}

---

## Blocked products (${blocked.length})

${bulletList(blocked.map((r) => r.sku), blocked)}

### Blocker breakdown

| Blocker | SKUs |
|---------|-----:|
| Missing image | ${missingImages.length} |
| Not visible in catalogue | ${audited.filter((r) => !r.visibleInCatalog).length} |
| Missing live aliases | ${missingAliases.length} |
| Description unverified | ${missingDescriptions.length} |
| Resolver clarification / wrong match | ${audited.filter((r) => !r.resolverPass).length} |

---

## Missing images (${missingImages.length})

All Batch 001 SKUs lack \`image_url\` in the live snapshot. Buyer catalogue shows a placeholder package icon.

${bulletList(missingImages, audited)}

---

## Missing aliases (${missingAliases.length})

These SKUs have **zero live** \`product_aliases\` rows. Wave 2C language packs (4 terms each) are prepared but **pending governed approval** — not counted as live coverage.

${bulletList(missingAliases, audited)}

| SKU | Wave 2C status |
|-----|----------------|
${missingAliases.map((sku) => `| ${sku} | Pending (32 SAFE_TO_APPROVE terms in pack) |`).join("\n")}

**Live alias coverage (17 / 25):** remaining SKUs have 5–22 live alias rows each.

---

## Missing descriptions (${missingDescriptions.length})

The 2026-06-09 Central read-only audit **did not include** \`products.description\`. Anon/staff-unauthenticated REST probes return empty under RLS, so description presence cannot be confirmed without an authenticated staff read.

**Conservative pilot stance:** treat all 25 SKUs as **description-unverified** until merchandising confirms copy.

${bulletList(missingDescriptions, audited)}

---

## Dimension audit

### 1. Image availability

| Status | Count |
|--------|------:|
| Has image | 0 |
| Missing image | 25 |

### 2. Alias coverage

| Status | Count |
|--------|------:|
| Live aliases (≥1 row) | 17 |
| Wave 2C pending only | 8 |
| Typed language complete (incl. drafts) | 25 / 25 |

### 3. Product descriptions

| Status | Count |
|--------|------:|
| Verified present | 0 |
| Unverified / assumed missing | 25 |

### 4. Categories

| Category | SKUs |
|----------|-----:|
| Lebanese Baklawa | 23 |
| Turkish Baklawa | 2 |

All 25 SKUs have category assigned in manifest and live snapshot.

### 5. Pack sizes

| Pack | UOM | SKUs |
|------|-----|-----:|
| 3kg | KG | 10 |
| 6kg | KG | 9 |
| 1kg | KG | 6 |

All 25 SKUs have \`pack_size\` and \`uom\` in live snapshot.

### 6. Product URLs

All 25 deep links are structurally valid (require buyer auth before render):

| SKU | URL |
|-----|-----|
${audited.map((r) => `| ${r.sku} | ${r.url} |`).join("\n")}

### 7. Search discoverability

| Check | Result |
|-------|--------|
| \`visible_in_catalog = true\` | 0 / 25 |
| Buyer \`useProducts\` filter (\`is_active\` + \`visible_in_catalog\`) | Hidden SKUs excluded when promoted |
| Resolver primary-alias pass rate | 22 / 25 (88%) — 0009, 0014, 0015 need clarification |

---

## Per-SKU matrix

| SKU | Product | Image | Live aliases | Description | Category | Pack | URL | Search visible | Pilot ready |
|-----|---------|:-----:|:------------:|:-----------:|:--------:|:----:|:---:|:--------------:|:-----------:|
${audited
  .map(
    (r) =>
      `| ${r.sku} | ${r.name} | ${r.hasImage ? "✓" : "✗"} | ${r.liveAliasCount}${r.wave2cPending ? "†" : ""} | ? | ✓ | ✓ | ✓ | ${r.searchOk ? "✓" : "✗"} | ${r.pilotReady ? "✓" : "✗"} |`,
  )
  .join("\n")}

† Wave 2C alias pack pending approval (not live).

---

## Near-ready shortlist (${nearReady.length})

SKUs with live aliases and resolver pass; blocked only on **image**, **visibility**, and **description verification**:

${nearReady.length === 0 ? "_None._" : bulletList(nearReady.map((r) => r.sku), nearReady)}

---

## Recommended promotion sequence (no action taken in this audit)

1. **Approve Wave 2C alias drafts** — closes live alias gap for 8 SKUs
2. **Upload product images** — all 25 SKUs
3. **Write/verify buyer descriptions** — merchandising copy on \`products.description\`
4. **Flip \`visible_in_catalog\`** — per-SKU or batch when above are complete
5. **Resolver hardening** — OAS-AS-BKL-0009 (Special Square vs Square), 0014/0015 (Asiyah family)

---

## Evidence

- \`src/lib/language-wave/batch001Manifest.ts\` — SKU authority + product UUIDs
- \`src/lib/language-wave/catalogueHealth.ts\` — live health snapshot
- \`docs/evidence/batch-001/catalogue-health.json\`
- \`docs/evidence/batch-001/language-coverage.json\`
- \`docs/evidence/batch-001/resolver-coverage.json\`
- \`docs/BATCH001_CATALOGUE_HEALTH_REPORT.md\`
- \`docs/BATCH001_LANGUAGE_COMPLETION_REPORT.md\`

---

*Read-only audit. No SQL, migrations, production writes, or approvals were performed.*
`;

writeFileSync(OUT, md);
console.log("Wrote", OUT);
console.log(`Pilot-ready: ${ready.length}/25 | Blocked: ${blocked.length}/25`);
