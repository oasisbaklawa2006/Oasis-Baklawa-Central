/**
 * Catalogue Launch Readiness Wave — read-only Batch 001 audit reports.
 * Canonical data from src/lib/language-wave/. No production writes.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  BATCH001_LIVE_COLLISIONS,
  BATCH001_LIVE_HEALTH_SNAPSHOT,
  BATCH001_PRODUCTS,
  BATCH001_WAVE2C_SKUS,
  buildWave2cProposals,
  runResolverCoverage,
} from "../src/lib/language-wave/index.ts";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORTAL = process.env.B2B_PORTAL_URL || "https://b2b.oasisbaklawa.com";
const DOCS = join(ROOT, "docs");
const GENERATED = new Date().toISOString().slice(0, 10);

const TOTAL = BATCH001_PRODUCTS.length;
const WAVE2C_SET = new Set<string>(BATCH001_WAVE2C_SKUS);
const snapBySku = new Map(BATCH001_LIVE_HEALTH_SNAPSHOT.map((s) => [s.sku, s]));

const resolverRows = runResolverCoverage([], []);
const resolverBySku = new Map(resolverRows.map((r) => [r.sku, r]));

const wave2cProposals = buildWave2cProposals();
const wave2cTermsBySku = new Map<string, number>();
for (const p of wave2cProposals) {
  wave2cTermsBySku.set(p.sku, (wave2cTermsBySku.get(p.sku) ?? 0) + 1);
}

/** Snapshot omits is_active / description — not verified in 2026-06-09 Central audit. */
const IS_ACTIVE_IN_SNAPSHOT = false;
const DESCRIPTION_IN_SNAPSHOT = false;

interface LaunchRow {
  sku: string;
  productId: string;
  name: string;
  category: string;
  url: string;
  visibleInCatalog: boolean;
  isActiveKnown: boolean;
  isActive: boolean;
  hasImage: boolean;
  imageUrlPresent: boolean;
  usesPlaceholder: boolean;
  hasThumbnail: boolean;
  hasDescription: boolean;
  liveAliasCount: number;
  pendingAliasCount: number;
  wave2cPending: boolean;
  resolverStatus: "PASS" | "CLARIFY";
  resolverPass: boolean;
  categoryOk: boolean;
  packOk: boolean;
  urlOk: boolean;
  aliasesAvailable: boolean;
  pilotReady: boolean;
  ambiguous: boolean;
  collisionTerms: string[];
}

function buildRows(): LaunchRow[] {
  return BATCH001_PRODUCTS.map((p) => {
    const snap = snapBySku.get(p.sku);
    const resolver = resolverBySku.get(p.sku);
    const url = `${PORTAL}/product/${p.productId}`;
    const imageUrlPresent = snap?.has_image ?? false;
    const categoryOk = Boolean(p.category?.trim());
    const packOk = Boolean(snap?.pack_size?.trim() && snap?.uom?.trim());
    const urlOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      p.productId,
    );
    const liveAliasCount = snap?.table_alias_count ?? 0;
    const pendingAliasCount = wave2cTermsBySku.get(p.sku) ?? 0;
    const wave2cPending = WAVE2C_SET.has(p.sku);
    const resolverPass = resolver?.resolved ?? false;
    const visibleInCatalog = snap?.visible_in_catalog ?? false;
    const isActive = IS_ACTIVE_IN_SNAPSHOT ? true : false;
    const hasDescription = DESCRIPTION_IN_SNAPSHOT;
    const aliasesAvailable = liveAliasCount > 0;
    const collisionTerms = BATCH001_LIVE_COLLISIONS.filter((c) =>
      c.skus.includes(p.sku),
    ).map((c) => c.term);
    const ambiguous = !resolverPass || collisionTerms.length > 0;

    const pilotReady =
      visibleInCatalog &&
      isActive &&
      imageUrlPresent &&
      hasDescription &&
      categoryOk &&
      packOk &&
      urlOk &&
      aliasesAvailable &&
      resolverPass;

    return {
      sku: p.sku,
      productId: p.productId,
      name: p.name,
      category: p.category,
      url,
      visibleInCatalog,
      isActiveKnown: IS_ACTIVE_IN_SNAPSHOT,
      isActive,
      hasImage: imageUrlPresent,
      imageUrlPresent,
      usesPlaceholder: !imageUrlPresent,
      hasThumbnail: imageUrlPresent,
      hasDescription,
      liveAliasCount,
      pendingAliasCount,
      wave2cPending,
      resolverStatus: resolverPass ? "PASS" : "CLARIFY",
      resolverPass,
      categoryOk,
      packOk,
      urlOk,
      aliasesAvailable,
      pilotReady,
      ambiguous,
      collisionTerms,
    };
  });
}

const rows = buildRows();

function pct(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 100) : 0;
}

const catalogueChecks = rows.map((r) => {
  const checks = [
    r.visibleInCatalog,
    r.isActiveKnown ? r.isActive : false,
    r.categoryOk,
    r.packOk,
    r.urlOk,
  ];
  return checks.filter(Boolean).length / checks.length;
});
const catalogueReadinessPct = Math.round(
  (catalogueChecks.reduce((a, b) => a + b, 0) / TOTAL) * 100,
);

const mediaReadinessPct = pct(rows.filter((r) => r.imageUrlPresent).length, TOTAL);
const aliasReadinessPct = pct(rows.filter((r) => r.aliasesAvailable).length, TOTAL);
const resolverReadinessPct = pct(rows.filter((r) => r.resolverPass).length, TOTAL);
const pilotReadyCount = rows.filter((r) => r.pilotReady).length;

const clarifySkus = rows.filter((r) => r.resolverStatus === "CLARIFY");
const highlightClarify = ["OAS-AS-BKL-0009", "OAS-AS-BKL-0014", "OAS-AS-BKL-0015"];

function scorePilotCandidate(r: LaunchRow): number {
  let score = 0;
  if (r.aliasesAvailable) score += 3;
  if (r.resolverPass) score += 3;
  if (r.categoryOk && r.packOk && r.urlOk) score += 2;
  if (!r.ambiguous) score += 2;
  if (!r.wave2cPending) score += 1;
  score += Math.min(r.liveAliasCount, 20) / 10;
  if (r.collisionTerms.length > 0) score -= 5;
  return score;
}

const recommendedFirst5 = [...rows]
  .filter((r) => r.aliasesAvailable && r.resolverPass && !r.wave2cPending)
  .sort((a, b) => scorePilotCandidate(b) - scorePilotCandidate(a))
  .slice(0, 5);

const goItems = rows.filter(
  (r) =>
    r.categoryOk &&
    r.packOk &&
    r.urlOk &&
    r.aliasesAvailable &&
    r.resolverPass,
);
const blockedItems = rows.filter((r) => !r.pilotReady);

function yn(v: boolean): string {
  return v ? "YES" : "NO";
}

function activeCell(r: LaunchRow): string {
  return r.isActiveKnown ? yn(r.isActive) : "unverified";
}

function descCell(r: LaunchRow): string {
  return r.hasDescription ? "YES" : "unverified";
}

// --- Phase 1 ---
const phase1 = `# Batch 001 Pilot Launch Checklist

**Generated:** ${GENERATED}  
**Source:** \`BATCH001_LIVE_HEALTH_SNAPSHOT\` (2026-06-09) + resolver simulation  
**Note:** \`is_active\` and \`description\` were **not** captured in the live snapshot — shown as \`unverified\` until staff re-read.

## Summary

| Metric | Value |
|--------|------:|
| Pilot ready (all gates) | ${pilotReadyCount} / ${TOTAL} |
| Visible in catalogue | ${rows.filter((r) => r.visibleInCatalog).length} / ${TOTAL} |
| Image URL present | ${rows.filter((r) => r.imageUrlPresent).length} / ${TOTAL} |
| Live aliases (≥1) | ${rows.filter((r) => r.aliasesAvailable).length} / ${TOTAL} |
| Resolver PASS | ${rows.filter((r) => r.resolverPass).length} / ${TOTAL} |

## Per-SKU checklist

| SKU | Product name | visible_in_catalog | is_active | image_url? | description? | live aliases | resolver | pilot ready |
|-----|--------------|:------------------:|:---------:|:----------:|:------------:|:------------:|:--------:|:-----------:|
${rows
  .map(
    (r) =>
      `| ${r.sku} | ${r.name} | ${yn(r.visibleInCatalog)} | ${activeCell(r)} | ${yn(r.imageUrlPresent)} | ${descCell(r)} | ${r.liveAliasCount} | ${r.resolverStatus} | ${yn(r.pilotReady)} |`,
  )
  .join("\n")}

---

*Read-only. No SQL, migrations, production writes, or draft approvals.*
`;

// --- Phase 2 ---
const phase2 = `# Batch 001 Media Gap Report

**Generated:** ${GENERATED}  
**Source:** \`BATCH001_LIVE_HEALTH_SNAPSHOT.has_image\` (maps to \`products.image_url\` presence)

## Summary

| Gap type | Count | % of batch |
|----------|------:|-----------:|
| Missing \`image_url\` | ${rows.filter((r) => !r.imageUrlPresent).length} | ${pct(rows.filter((r) => !r.imageUrlPresent).length, TOTAL)}% |
| Using UI placeholder (no image) | ${rows.filter((r) => r.usesPlaceholder).length} | ${pct(rows.filter((r) => r.usesPlaceholder).length, TOTAL)}% |
| Missing thumbnail (no separate thumb field — same as image) | ${rows.filter((r) => !r.hasThumbnail).length} | ${pct(rows.filter((r) => !r.hasThumbnail).length, TOTAL)}% |

**Media readiness:** ${mediaReadinessPct}%

Buyer catalogue (\`CatalogueProductCard\`) renders a package icon when \`image_url\` is null — all Batch 001 SKUs currently fall into this path.

## Missing image_url

${rows
  .filter((r) => !r.imageUrlPresent)
  .map((r) => `- **${r.sku}** — ${r.name}`)
  .join("\n")}

## Placeholder / thumbnail gaps

| SKU | Product | image_url | placeholder UI | thumbnail |
|-----|---------|:---------:|:--------------:|:---------:|
${rows
  .map(
    (r) =>
      `| ${r.sku} | ${r.name} | ${r.imageUrlPresent ? "present" : "missing"} | ${r.usesPlaceholder ? "yes" : "no"} | ${r.hasThumbnail ? "yes" : "missing"} |`,
  )
  .join("\n")}

## Owner actions (draft — not executed)

1. Merchandising uploads hero image per SKU to approved storage
2. Set \`products.image_url\` via governed catalogue connector (not in this wave)
3. Re-run this report after media import

---

*Read-only audit.*
`;

// --- Phase 3 ---
const zeroAlias = rows.filter((r) => r.liveAliasCount === 0);
const wave2cRows = rows.filter((r) => r.wave2cPending);
const ambiguousRows = rows.filter((r) => r.ambiguous);

const phase3 = `# Batch 001 Alias Completion Plan

**Generated:** ${GENERATED}  
**Wave 2C pack:** ${wave2cProposals.length} draft terms across ${WAVE2C_SET.size} SKUs (${wave2cProposals.length / WAVE2C_SET.size} per SKU)

## Summary

| Category | Count |
|----------|------:|
| Zero live aliases | ${zeroAlias.length} |
| Wave 2C pending | ${wave2cRows.length} |
| Ambiguous resolver / collision exposure | ${ambiguousRows.length} |

**Alias readiness (live ≥1 row):** ${aliasReadinessPct}%

## Zero live aliases

${zeroAlias.map((r) => `- **${r.sku}** — ${r.name}`).join("\n")}

## Wave 2C pending (draft only — not approved)

${wave2cRows.map((r) => `- **${r.sku}** — ${r.pendingAliasCount} pending terms`).join("\n")}

## Per-SKU alias plan

| SKU | Product | live aliases | pending (Wave 2C) | resolver | resolver impact |
|-----|---------|:------------:|:-----------------:|:--------:|-----------------|
${rows
  .map((r) => {
    let impact = "PASS — search/WhatsApp resolve";
    if (!r.resolverPass) impact = "CLARIFY — operator must disambiguate";
    else if (r.liveAliasCount === 0 && r.wave2cPending)
      impact = "BLOCKED — no live aliases until Wave 2C approved";
    else if (r.collisionTerms.length > 0)
      impact = `Collision risk: ${r.collisionTerms.join("; ")}`;
    return `| ${r.sku} | ${r.name} | ${r.liveAliasCount} | ${r.pendingAliasCount} | ${r.resolverStatus} | ${impact} |`;
  })
  .join("\n")}

## Governed completion sequence (no auto-approval)

1. Catalogue reviewer approves Wave 2C drafts for ${wave2cRows.length} SKU(s)
2. Verify live alias counts post-approval
3. Resolve collision terms on 0013/0014 before expanding Asiyah pilot

---

*Read-only. Draft payloads in \`docs/evidence/batch-001/wave-2c-draft-payloads.json\`.*
`;

// --- Phase 4 ---
const phase4 = `# Batch 001 Resolver Readiness

**Generated:** ${GENERATED}  
**Engine:** \`resolveProductIntelligence()\` via \`runResolverCoverage()\`  
**Pass rate:** ${resolverReadinessPct}% (${rows.filter((r) => r.resolverPass).length} / ${TOTAL})

## PASS vs CLARIFY

| Status | Count | SKUs |
|--------|------:|------|
| PASS | ${rows.filter((r) => r.resolverPass).length} | ${rows.filter((r) => r.resolverPass).map((r) => r.sku.replace("OAS-AS-BKL-", "")).join(", ")} |
| CLARIFY | ${clarifySkus.length} | ${clarifySkus.map((r) => r.sku.replace("OAS-AS-BKL-", "")).join(", ")} |

## Highlighted ambiguous SKUs

${highlightClarify
  .map((sku) => {
    const r = rows.find((x) => x.sku === sku)!;
    const res = resolverBySku.get(sku);
    return `### ${sku} — ${r.name}

- **Resolver:** ${r.resolverStatus}${res?.clarification_required ? " (clarification_required)" : ""}
- **Primary utterance tested:** ${res?.utterance ?? "—"}
- **Best match productId:** ${res?.productId ?? "—"}
- **Live alias collisions:** ${r.collisionTerms.length > 0 ? r.collisionTerms.join(", ") : "none in collision index"}`;
  })
  .join("\n\n")}

## Live cross-SKU collision terms

| Term | SKUs |
|------|------|
${BATCH001_LIVE_COLLISIONS.map((c) => `| ${c.term} | ${c.skus.join(", ")} |`).join("\n")}

## Full resolver matrix

| SKU | Utterance | PASS/CLARIFY | Confidence | clarification_required |
|-----|-----------|:------------:|:----------:|:----------------------:|
${resolverRows
  .map(
    (r) =>
      `| ${r.sku} | ${r.utterance} | ${r.resolved ? "PASS" : "CLARIFY"} | ${r.confidence ?? "—"} | ${r.clarification_required ? "yes" : "no"} |`,
  )
  .join("\n")}

---

*Read-only simulation — not live WhatsApp traffic.*
`;

// --- Phase 5 ---
const pilotGo = pilotReadyCount > 0;
const phase5 = `# Batch 001 Pilot GO / NO-GO

**Generated:** ${GENERATED}  
**Recommendation:** **${pilotGo ? "GO" : "NO-GO"}** for buyer-facing preview

## Readiness scores

| Dimension | Score |
|-----------|------:|
| Catalogue readiness | ${catalogueReadinessPct}% |
| Media readiness | ${mediaReadinessPct}% |
| Alias readiness (live) | ${aliasReadinessPct}% |
| Resolver readiness | ${resolverReadinessPct}% |
| **Pilot ready (all gates)** | **${pilotReadyCount} / ${TOTAL}** |

## Pilot gate (all required)

| Gate | Required | Batch pass |
|------|----------|------------|
| \`visible_in_catalog = true\` | yes | ${rows.filter((r) => r.visibleInCatalog).length} / ${TOTAL} |
| \`is_active = true\` | yes | unverified (not in snapshot) |
| Image exists | yes | ${rows.filter((r) => r.imageUrlPresent).length} / ${TOTAL} |
| Description exists | yes | unverified (not in snapshot) |
| Category valid | yes | ${rows.filter((r) => r.categoryOk).length} / ${TOTAL} |
| Pack size valid | yes | ${rows.filter((r) => r.packOk).length} / ${TOTAL} |
| Product URL valid | yes | ${rows.filter((r) => r.urlOk).length} / ${TOTAL} |
| Aliases available (live) | yes | ${rows.filter((r) => r.aliasesAvailable).length} / ${TOTAL} |
| Resolver PASS | yes | ${rows.filter((r) => r.resolverPass).length} / ${TOTAL} |

## GO items (${goItems.length} SKUs — partial readiness)

SKUs with category, pack, URL, live aliases, and resolver PASS (still blocked on media/visibility/description):

${goItems.map((r) => `- **${r.sku}** — ${r.name}`).join("\n")}

## BLOCKED items (${blockedItems.length} SKUs)

${blockedItems.map((r) => `- **${r.sku}** — ${r.name}`).join("\n")}

## Fastest path to pilot

1. **Approve Wave 2C aliases** — unlock ${zeroAlias.length} SKU(s) with zero live rows (${wave2cProposals.length} terms)
2. **Upload images** for all ${rows.filter((r) => !r.imageUrlPresent).length} SKU(s) (or start with recommended 5)
3. **Write buyer descriptions** — staff verify \`products.description\` (not in snapshot)
4. **Confirm \`is_active\`** on pilot SKUs via authenticated admin read
5. **Flip \`visible_in_catalog\`** per SKU through governed merchandising (not bulk in this wave)
6. **Resolver hardening** for ${highlightClarify.join(", ")} before relying on short WhatsApp keywords

## Recommended first 5 SKUs for launch

Selected from near-ready pool: live aliases, resolver PASS, no Wave 2C gap, low collision risk.

| Rank | SKU | Product | live aliases | resolver | blockers remaining |
|------|-----|---------|:------------:|:--------:|--------------------|
${recommendedFirst5
  .map((r, i) => {
    const blockers: string[] = [];
    if (!r.visibleInCatalog) blockers.push("visibility");
    if (!r.imageUrlPresent) blockers.push("image");
    if (!r.hasDescription) blockers.push("description");
    if (!r.isActiveKnown) blockers.push("is_active verify");
    return `| ${i + 1} | ${r.sku} | ${r.name} | ${r.liveAliasCount} | ${r.resolverStatus} | ${blockers.join(", ")} |`;
  })
  .join("\n")}

### Why these five

${recommendedFirst5
  .map(
    (r) =>
      `- **${r.sku}** (${r.name}): ${r.liveAliasCount} live aliases, resolver ${r.resolverStatus}, ${r.category} / ${r.packOk ? "pack OK" : "pack gap"}`,
  )
  .join("\n")}

---

*Read-only recommendation. No visibility activation, SQL, or draft auto-approval performed.*
`;

writeFileSync(join(DOCS, "BATCH001_PILOT_LAUNCH_CHECKLIST.md"), phase1);
writeFileSync(join(DOCS, "BATCH001_MEDIA_GAP_REPORT.md"), phase2);
writeFileSync(join(DOCS, "BATCH001_ALIAS_COMPLETION_PLAN.md"), phase3);
writeFileSync(join(DOCS, "BATCH001_RESOLVER_READINESS.md"), phase4);
writeFileSync(join(DOCS, "BATCH001_PILOT_GO_NO_GO.md"), phase5);

console.log("Wrote launch readiness wave docs:");
console.log("  docs/BATCH001_PILOT_LAUNCH_CHECKLIST.md");
console.log("  docs/BATCH001_MEDIA_GAP_REPORT.md");
console.log("  docs/BATCH001_ALIAS_COMPLETION_PLAN.md");
console.log("  docs/BATCH001_RESOLVER_READINESS.md");
console.log("  docs/BATCH001_PILOT_GO_NO_GO.md");
console.log(
  `Scores — catalogue ${catalogueReadinessPct}%, media ${mediaReadinessPct}%, alias ${aliasReadinessPct}%, resolver ${resolverReadinessPct}%, pilot ready ${pilotReadyCount}/${TOTAL}`,
);
console.log(`Pilot: ${pilotGo ? "GO" : "NO-GO"}`);
