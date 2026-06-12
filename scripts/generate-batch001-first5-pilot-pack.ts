/**
 * Batch 001 First 5 SKU Pilot Execution Pack — read-only drafts/manifests.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";
import {
  BATCH001_LIVE_HEALTH_SNAPSHOT,
  BATCH001_RESOLVER_UTTERANCES,
  batch001ProductBySku,
  runResolverCoverage,
} from "../src/lib/language-wave/index.ts";
import { BATCH001_PRIMARY_ALIASES } from "../src/lib/language-wave/batch001PrimaryAliases.ts";
import type { ResolverCoverageRow } from "../src/lib/language-wave/types.ts";

type ResolverStatus = "PASS" | "CLARIFY" | "FAIL";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const PORTAL = process.env.B2B_PORTAL_URL || "https://b2b.oasisbaklawa.com";
const DOCS = join(ROOT, "docs");
const DATA = join(ROOT, "data/catalogue");
const GENERATED = new Date().toISOString().slice(0, 10);

const FIRST5_SKUS = [
  "OAS-AS-BKL-0024",
  "OAS-AS-BKL-0020",
  "OAS-AS-BKL-0001",
  "OAS-AS-BKL-0025",
  "OAS-AS-BKL-0007",
] as const;

const DESCRIPTION_DRAFTS: Record<(typeof FIRST5_SKUS)[number], string> = {
  "OAS-AS-BKL-0024":
    "Premium Turkish baklawa durum layered with pistachio and clarified butter. Sold in 1 kg packs for HORECA and wholesale buyers who need a distinctive pistachio-forward durum line.",
  "OAS-AS-BKL-0020":
    "Lebanese tart cashew baklawa with a crisp pastry base and generous cashew filling. 6 kg pack suited for counter display and bulk replenishment.",
  "OAS-AS-BKL-0001":
    "Classic Lebanese cashew kitta baklawa — flaky layers, roasted cashew, and traditional syrup finish. 3 kg trade pack for everyday menu staples.",
  "OAS-AS-BKL-0025":
    "Turkish coconut durum baklawa with aromatic coconut notes and fine phyllo layers. 1 kg pack ideal for specialty dessert counters and gift assortments.",
  "OAS-AS-BKL-0007":
    "Lebanese cashew finger baklawa in an easy-serve finger shape. 3 kg pack built for buffet, catering, and high-velocity reorder programs.",
};

const snapBySku = new Map(BATCH001_LIVE_HEALTH_SNAPSHOT.map((s) => [s.sku, s]));
const resolverBySku = new Map(runResolverCoverage([], []).map((r) => [r.sku, r]));

const IS_ACTIVE_IN_SNAPSHOT = false;
const DESCRIPTION_IN_DB = false;

interface First5Row {
  sku: (typeof FIRST5_SKUS)[number];
  productId: string;
  name: string;
  category: string;
  packSize: string;
  url: string;
  visibleInCatalog: boolean;
  isActiveVerified: boolean;
  hasImage: boolean;
  hasDescriptionInDb: boolean;
  descriptionDraft: string;
  liveAliasCount: number;
  primaryAlias: string;
  whatsappKeyword: string;
  resolverStatus: ResolverStatus;
  resolverPass: boolean;
  categoryOk: boolean;
  packOk: boolean;
  urlOk: boolean;
  missingAliases: string;
  readinessPct: number;
  pilotReady: boolean;
}

function csvEscape(v: string | number | boolean): string {
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function resolverStatusFromCoverage(resolver: ResolverCoverageRow | undefined): ResolverStatus {
  if (!resolver) return "FAIL";
  if (resolver.resolved) return "PASS";
  if (resolver.clarification_required) return "CLARIFY";
  return "FAIL";
}

function resolverGuidance(row: First5Row): string {
  if (row.resolverStatus === "PASS") {
    return `Primary utterance resolves to the expected product (\`${row.sku}\`). Buyer search and discovery appear healthy for this SKU.`;
  }
  if (row.resolverStatus === "CLARIFY") {
    return `Resolver requires clarification before reliable product identification. Human review or alias expansion is required — resolver confidence is insufficient for unattended buyer discovery.`;
  }
  return `Resolver failed simulation and should be treated as blocked. The primary utterance does not reliably identify \`${row.sku}\`; language ops must remediate before activation.`;
}

function resolverActivationStep(row: First5Row): string {
  if (row.resolverStatus === "PASS") {
    return "Resolver remains **PASS**";
  }
  if (row.resolverStatus === "CLARIFY") {
    return "Resolver **CLARIFY** — human review or alias expansion required before activation";
  }
  return "Resolver **FAIL** — blocked until language ops remediation";
}

function buildRow(sku: (typeof FIRST5_SKUS)[number]): First5Row {
  const product = batch001ProductBySku(sku)!;
  const snap = snapBySku.get(sku);
  const resolver = resolverBySku.get(sku);
  const url = `${PORTAL}/product/${product.productId}`;
  const categoryOk = Boolean(product.category?.trim());
  const packOk = Boolean(snap?.pack_size?.trim() && snap?.uom?.trim());
  const urlOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    product.productId,
  );
  const liveAliasCount = snap?.table_alias_count ?? 0;
  const hasImage = snap?.has_image ?? false;
  const visibleInCatalog = snap?.visible_in_catalog ?? false;
  const resolverStatus = resolverStatusFromCoverage(resolver);
  const resolverPass = resolverStatus === "PASS";

  const gates = [
    visibleInCatalog,
    IS_ACTIVE_IN_SNAPSHOT,
    hasImage,
    DESCRIPTION_IN_DB,
    categoryOk,
    packOk,
    urlOk,
    liveAliasCount > 0,
    resolverPass,
  ];
  const readinessPct = Math.round((gates.filter(Boolean).length / gates.length) * 100);

  const pilotReady = gates.every(Boolean);

  return {
    sku,
    productId: product.productId,
    name: product.name,
    category: product.category,
    packSize: snap?.pack_size ?? product.packSize,
    url,
    visibleInCatalog,
    isActiveVerified: IS_ACTIVE_IN_SNAPSHOT,
    hasImage,
    hasDescriptionInDb: DESCRIPTION_IN_DB,
    descriptionDraft: DESCRIPTION_DRAFTS[sku],
    liveAliasCount,
    primaryAlias: BATCH001_PRIMARY_ALIASES[sku] ?? product.name,
    whatsappKeyword: BATCH001_RESOLVER_UTTERANCES[sku] ?? "",
    resolverStatus,
    resolverPass,
    categoryOk,
    packOk,
    urlOk,
    missingAliases: liveAliasCount > 0 ? "none (live aliases present)" : "live alias rows required",
    readinessPct,
    pilotReady,
  };
}

const rows = FIRST5_SKUS.map(buildRow);
const avgReadiness = Math.round(
  rows.reduce((s, r) => s + r.readinessPct, 0) / rows.length,
);
const pilotReadyCount = rows.filter((r) => r.pilotReady).length;
const aliasGapCount = rows.filter((r) => r.liveAliasCount === 0).length;
const missingImageCount = rows.filter((r) => !r.hasImage).length;
const requiredImagesMissing = missingImageCount * 2;
const goNoGo = pilotReadyCount === rows.length ? "GO" : "NO-GO";

function requiredImageStatus(hasImage: boolean): string {
  return hasImage ? "ready" : "missing";
}

mkdirSync(DATA, { recursive: true });

// --- CSV: media shotlist ---
const mediaHeader =
  "sku,product_name,product_id,asset_type,aspect_ratio,min_resolution_px,filename_convention,current_status,owner";
const mediaLines = [mediaHeader];
for (const r of rows) {
  const base = r.sku.toLowerCase().replace(/-/g, "_");
  const heroStatus = requiredImageStatus(r.hasImage);
  const squareStatus = requiredImageStatus(r.hasImage);
  const assets = [
    ["hero", "16:9", "1600x900", `${base}_hero.jpg`, heroStatus],
    ["catalogue_square", "1:1", "1200x1200", `${base}_catalogue_sq.jpg`, squareStatus],
    ["detail_optional", "4:3", "1600x1200", `${base}_detail.jpg`, "optional_missing"],
  ] as const;
  for (const [type, aspect, res, file, status] of assets) {
    mediaLines.push(
      [
        r.sku,
        r.name,
        r.productId,
        type,
        aspect,
        res,
        file,
        status,
        "merchandising",
      ].map(csvEscape).join(","),
    );
  }
}
writeFileSync(join(DATA, "batch001_first5_media_shotlist.csv"), mediaLines.join("\n") + "\n");

// --- CSV: description drafts ---
const descHeader =
  "sku,product_name,product_id,description_draft,char_count,approval_status,owner";
const descLines = [
  descHeader,
  ...rows.map((r) =>
    [
      r.sku,
      r.name,
      r.productId,
      r.descriptionDraft,
      r.descriptionDraft.length,
      "draft_pending_merchandising_approval",
      "merchandising",
    ]
      .map(csvEscape)
      .join(","),
  ),
];
writeFileSync(join(DATA, "batch001_first5_description_drafts.csv"), descLines.join("\n") + "\n");

// --- CSV: visibility activation checklist ---
const visHeader =
  "sku,product_name,product_id,precondition_id,precondition,status,owner,notes";
const preconditions = [
  ["hero_image_uploaded", "Hero image uploaded and linked to product", "merchandising"],
  ["catalogue_image_uploaded", "Square catalogue image uploaded", "merchandising"],
  ["description_approved", "Buyer description approved and saved to products.description", "merchandising"],
  ["is_active_verified", "products.is_active confirmed true", "catalogue_admin"],
  ["aliases_verified", "Live product_aliases count verified", "language_ops"],
  ["resolver_pass", "Resolver PASS on primary utterance", "language_ops"],
  ["pilot_qa_signoff", "First-5 pilot QA sign-off on staging/preview", "operations"],
  ["visible_in_catalog_flip", "Governed visible_in_catalog activation (single SKU)", "catalogue_admin"],
] as const;

const visLines = [visHeader];
for (const r of rows) {
  for (const [id, label, owner] of preconditions) {
    let status = "pending";
    let notes = "";
    if (id === "aliases_verified" && r.liveAliasCount > 0) {
      status = "ready";
      notes = `${r.liveAliasCount} live rows in snapshot`;
    }
    if (id === "resolver_pass") {
      if (r.resolverStatus === "PASS") {
        status = "ready";
        notes = "PASS";
      } else if (r.resolverStatus === "CLARIFY") {
        status = "blocked";
        notes = "CLARIFY — clarification required";
      } else {
        status = "blocked";
        notes = "FAIL — resolver blocked";
      }
    }
    if (id === "hero_image_uploaded" || id === "catalogue_image_uploaded") {
      status = r.hasImage ? "ready" : "blocked";
      notes = r.hasImage ? "image_url present" : "image_url missing";
    }
    if (id === "description_approved") {
      status = "draft_ready";
      notes = "CSV draft prepared — not written to DB";
    }
    if (id === "is_active_verified") {
      status = "unverified";
      notes = "not in 2026-06-09 snapshot";
    }
    if (id === "visible_in_catalog_flip") {
      status = "do_not_activate";
      notes = "await all preconditions; no bulk publish";
    }
    visLines.push(
      [r.sku, r.name, r.productId, id, label, status, owner, notes].map(csvEscape).join(","),
    );
  }
}
writeFileSync(
  join(DATA, "batch001_first5_visibility_activation_checklist.csv"),
  visLines.join("\n") + "\n",
);

// --- Markdown pack ---
const md = `# Batch 001 First 5 SKU Pilot Execution Pack

**Generated:** ${GENERATED}  
**Purpose:** Buyer catalogue preview preparation — execution pack only (no production writes)  
**SKUs:** ${FIRST5_SKUS.join(", ")}

## Executive summary

| Metric | Value |
|--------|------:|
| Average readiness (9 gates) | **${avgReadiness}%** |
| Pilot ready (all gates) | **${pilotReadyCount} / ${rows.length}** |
| Images required | **${requiredImagesMissing} required** + **${rows.length} optional** detail (${requiredImagesMissing + rows.length} assets outstanding) |
| Description drafts prepared | **${rows.length} / ${rows.length}** |
| Alias gaps (live) | **${aliasGapCount} / ${rows.length}** |
| **Buyer preview** | **${goNoGo}** |

## Deliverables

| File | Purpose |
|------|---------|
| \`data/catalogue/batch001_first5_media_shotlist.csv\` | Image shot list |
| \`data/catalogue/batch001_first5_description_drafts.csv\` | Description drafts for approval |
| \`data/catalogue/batch001_first5_visibility_activation_checklist.csv\` | Per-SKU activation preconditions |

---

${rows
  .map(
    (r, i) => `## ${i + 1}. ${r.sku} — ${r.name}

### Current readiness

| Check | Status |
|-------|--------|
| Readiness score | **${r.readinessPct}%** (9 gates) |
| Pilot ready | **${r.pilotReady ? "YES" : "NO"}** |
| Category | ${r.category} (${r.categoryOk ? "OK" : "gap"}) |
| Pack | ${r.packSize} (${r.packOk ? "OK" : "gap"}) |
| visible_in_catalog | ${r.visibleInCatalog ? "true" : "false"} |
| is_active | ${r.isActiveVerified ? "verified" : "unverified"} |
| image_url | ${r.hasImage ? "present" : "missing"} |
| description (DB) | ${r.hasDescriptionInDb ? "present" : "missing"} |

### Image requirements

| Asset | Aspect | Min size | Filename | Status |
|-------|--------|----------|----------|--------|
| Hero image | 16:9 | 1600×900 | \`${r.sku.toLowerCase().replace(/-/g, "_")}_hero.jpg\` | **Required — ${requiredImageStatus(r.hasImage)}** |
| Square catalogue image | 1:1 | 1200×1200 | \`${r.sku.toLowerCase().replace(/-/g, "_")}_catalogue_sq.jpg\` | **Required — ${requiredImageStatus(r.hasImage)}** |
| Detail image (optional) | 4:3 | 1600×1200 | \`${r.sku.toLowerCase().replace(/-/g, "_")}_detail.jpg\` | Optional |

### Buyer-facing description (draft)

> ${r.descriptionDraft}

*Draft only — not written to \`products.description\`.*

### Search aliases (live)

| Field | Value |
|-------|-------|
| Live \`product_aliases\` rows (snapshot) | **${r.liveAliasCount}** |
| Primary alias (canonical) | ${r.primaryAlias} |
| WhatsApp keyword (canonical) | ${r.whatsappKeyword} |

### Missing aliases

${r.missingAliases === "none (live aliases present)" ? "None — live alias coverage present in Central snapshot." : r.missingAliases}

### Resolver status

**${r.resolverStatus}** — ${resolverGuidance(r)}

### Product URL

${r.url}

### Visibility activation preconditions

1. Hero + square catalogue images uploaded; \`image_url\` set via governed connector
2. Description draft approved and saved to \`products.description\`
3. \`is_active = true\` confirmed by catalogue admin
4. Live alias count re-verified (${r.liveAliasCount} rows)
5. ${resolverActivationStep(r)}
6. Pilot QA on preview environment
7. **Then** single-SKU \`visible_in_catalog\` flip (not bulk)

### Manual owner actions

| Owner | Action |
|-------|--------|
| Merchandising | Shoot/upload hero + square images; approve description draft |
| Catalogue admin | Verify \`is_active\`; activate \`visible_in_catalog\` after QA |
| Language ops | Confirm alias rows; monitor resolver on short keywords |
| Operations | Run first-5 buyer preview smoke test before go-live |

`,
  )
  .join("\n---\n\n")}

## Activation order (recommended)

1. Complete media shotlist for all 5 SKUs
2. Merchandising approves description CSV → governed write to \`products.description\`
3. Staging preview with \`visible_in_catalog\` false — internal QA
4. Per-SKU visibility flip: 0024 → 0020 → 0001 → 0025 → 0007

## Constraints

- No SQL, migrations, or production writes in this pack
- No automatic Wave 2C approval
- No bulk \`visible_in_catalog\` publish

---

*Regenerate: \`node scripts/generate-batch001-first5-pilot-pack.mjs\`*
`;

writeFileSync(join(DOCS, "BATCH001_FIRST5_PILOT_EXECUTION_PACK.md"), md);

console.log("Wrote docs/BATCH001_FIRST5_PILOT_EXECUTION_PACK.md");
console.log("Wrote data/catalogue/batch001_first5_*.csv (3 files)");
console.log(`First 5 avg readiness: ${avgReadiness}% | Pilot ready: ${pilotReadyCount}/5 | ${goNoGo}`);
