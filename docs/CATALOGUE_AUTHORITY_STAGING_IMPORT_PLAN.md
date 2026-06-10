# Catalogue Authority Staging Import Plan

**Date:** 2026-06-09  
**Status:** Implementation plan only — **no SQL applied, no data imported, no production changes**  
**Scope:** Prepare Oasis Central to ingest Category 1–4 catalogue authority into **staging tables only**

---

## 1. Goal

Land authoritative catalogue source data from offline rulebook / Excel packs into a **reviewable staging layer** inside Oasis Central, without:

- Writing to operational `products` / `product_aliases` / `product_bom` directly
- Touching production buyer catalogue visibility
- Creating orders, reservations, or stock deductions
- Connecting Golden Chain, WhatsApp resolution, or customer storefront flows

Promotion from staging → authority tables is a **later, explicit PR** with approve RPCs and staff review UI.

---

## 2. Source inputs (expected)

| Input | Purpose | Repo status (2026-06-09) |
|-------|---------|---------------------------|
| **Category 1 Final Authority Pack** | Canonical C1 product master + alias list | **Not found** in workspace (`*.xlsx` / `project/raw` absent) |
| **Oasis_Category2_3_final_open_scope.xlsx** | C2 source/content products; C3 platforms, collections, generation rules | **Not found** in workspace |
| **Oasis Authority Rulebook V1** | Cross-category validation rules, naming, SKU conventions | **Not found** in workspace |
| **Category 4 rules** (latest discussion) | Hamper family skeleton, BOM composition rules (basic) | **Not in repo** — capture as markdown appendix when files are checked in |

**Prerequisite before any import PR:** commit sources under a stable path, e.g. `project/raw/catalogue-authority/` (gitignored binaries optional; at minimum checksum + tab inventory doc).

**In-repo proxies today (not substitutes for authority packs):**

- `src/utils/pricing.ts` — runtime **pricing pathways** (bulk kg / ready pc / premium pc); useful for field mapping, not the Rulebook taxonomy
- `src/lib/product-family.ts` — UI families: `bulk_sweets | retail_pack | goldware | hampers`
- `supabase/migrations/20260421074415_*.sql` — `product_family`, `bom_summary`, `gross_weight_kg` on `products`

---

## 3. Authority taxonomy → Central concepts

| Authority category | Business meaning (planning) | Closest operational target (post-promotion) | Staging entity |
|--------------------|----------------------------|---------------------------------------------|----------------|
| **Category 1** | Bulk sweets & nuts — canonical sellable SKUs by weight | `products` (`uom` Kg, `product_family` → `bulk_sweets`) + `product_aliases` | C1 product candidates, C1 alias candidates |
| **Category 2** | Source / content products (ready packs, components) | `products` (`uom` Pc, `product_family` → `retail_pack`) | C2 content product candidates |
| **Category 3** | Packaging platforms, collections, generation rules | `products` (`goldware` / packaging SKUs), `product_tags` + `product_tag_mapping`, rule JSON (new) | C3 platform, collection, generation-rule candidates |
| **Category 4** | Hamper families (skeleton only) | `products` (`product_family` → `hampers`) + `product_bom` lines + `bom_summary` | C4 hamper family + line candidates |

**Important:** Category numbers here follow the **Authority Rulebook**, not the three pathways in `pricing.ts` (which collapse C2/C3 pricing behavior). Staging must carry an explicit `authority_category` column (`c1`…`c4`) on every candidate row.

---

## 4. Existing tables usable now

### 4.1 Operational authority (read for matching only during staging)

| Table | Use during staging import |
|-------|---------------------------|
| `products` | **Read-only** SKU/id match, duplicate detection, diff preview |
| `product_aliases` | **Read-only** alias collision checks |
| `product_variants` | **Read-only** variant SKU overlap |
| `product_tags` | **Read-only** collection/tag key collision |
| `product_tag_mapping` | **Read-only** — do not write |
| `product_bom` | **Read-only** — C4 promotion preview only |
| `categories` | **Read-only** hierarchy reference (`id`, `name`, `parent_id`) |
| `catalogue_product_mappings` | **Read-only** — AI Catalogue Builder sync ledger; **separate** from authority import |

### 4.2 Existing staging patterns (precedents, not reuse for bulk authority)

| Table / pattern | In repo migrations? | Relevance |
|-----------------|---------------------|-----------|
| `customer_import_batches` + `customer_import_raw` + `*_candidates` | **Yes** (`20260607190000_...`) | **Best precedent** — batch registry, raw JSON landing, typed candidates, `source_environment = staging` CHECK |
| `catalogue_tag_drafts` / `catalogue_alias_drafts` | **Types only** (C1a on prod; no migration in git) | Single-row approve/reject for AI builder proposals — **too narrow** for bulk Excel authority load |
| `sales_order_drafts` | **Yes** | Staging workflow pattern; wrong domain |
| `catalogue_product_mappings` | **Yes** | Post-approval **connector** sync, not authority Excel ingest |

### 4.3 Application surfaces (stay disconnected from staging ingest)

| Surface | Why leave disconnected |
|---------|----------------------|
| `/catalogue`, `/cart`, `useProducts` | Buyer catalogue reads live `products` |
| `/admin/catalogue-sync` | AI builder approved JSON → connector → `products` |
| `/admin/catalogue-approvals` | Tag/alias draft RPCs only |
| WA product resolution (`product_aliases`, `products`) | Must not auto-pick up unstaged rows |
| Golden Chain / reservations / stock finalization | Order/inventory authority |

---

## 5. Missing tables required (recommended staging design)

Follow the **`customer_import_*` batch pattern** with catalogue-specific names and a hard `source_environment = 'staging'` constraint.

### 5.1 Core batch layer

| Proposed table | Purpose |
|----------------|---------|
| `catalogue_authority_import_batches` | One row per workbook/pack load; status `loaded → validated → approved → promoted/rejected/archived`; `row_counts`, `validation_summary` JSON |
| `catalogue_authority_import_raw` | Immutable landing: `source_file`, `source_tab`, `source_row_number`, `row_json`, `row_hash`, `authority_category` (`c1`…`c4`) |

### 5.2 Typed candidate tables

| Proposed table | Authority data |
|----------------|----------------|
| `catalogue_authority_c1_product_candidates` | C1 SKU, name, HSN, GST, weights, MOQ, pack/carton fields, tier prices, `matched_product_id`, `validation_status`, `promotion_status` |
| `catalogue_authority_c1_alias_candidates` | `alias_text`, `canonical_name`, optional `product_sku` / `matched_product_id`, `matched_alias_id` |
| `catalogue_authority_c2_content_candidates` | C2 source/content SKUs: pack weights, content type, links to C1 component SKUs (nullable until C1 promoted) |
| `catalogue_authority_c3_platform_candidates` | Packaging platform SKUs (`goldware` / platform type, dimensions, material) |
| `catalogue_authority_c3_collection_candidates` | Collection codes, display labels, sort order, member SKU lists (JSON), maps to future `product_tags` |
| `catalogue_authority_c3_generation_rule_candidates` | Rulebook generation rules as structured JSON + `rule_code`, `applies_to` scope, `rule_version` |
| `catalogue_authority_c4_hamper_family_candidates` | Hamper family code, display name, `bom_summary` template, `gross_weight_kg` hint, status skeleton only |
| `catalogue_authority_c4_hamper_line_candidates` | Family → component SKU/qty lines (maps to future `product_bom`) |

### 5.3 Shared candidate columns (all `*_candidates` tables)

- `batch_id` FK → `catalogue_authority_import_batches`
- `raw_id` FK → `catalogue_authority_import_raw` (nullable)
- `source_row_key` (stable `file:tab:row` or Rulebook id)
- `authority_category` CHECK (`c1`|`c2`|`c3`|`c4`)
- `validation_status` (`pending`, `valid`, `warning`, `error`, `duplicate_*`, `missing_reference`, …)
- `promotion_status` (`pending`, `blocked`, `ready`, `promoted`, `rejected`) — default `pending`
- `matched_*_id` UUIDs — **link only**, no UPDATE to authority tables on import
- `review_notes`, `reviewed_by`, `reviewed_at`

### 5.4 RPCs / promotion (later PR — not this plan)

Do **not** ship promotion RPCs in the first staging migration. When ready:

- `promote_catalogue_authority_c1_product_candidate(candidate_id)` → INSERT/UPDATE `products` (idempotent by SKU)
- `promote_catalogue_authority_c1_alias_candidate` → `product_aliases`
- C2/C3/C4 analogues
- Separate **reject** / **archive batch** RPCs

Mirror `customer_import_batches` promotion gating: batch cannot promote until `status = approved` and all blocking validations cleared.

---

## 6. Import order (when data load is authorized)

Execute in this sequence to respect cross-references:

```text
1. Register batch (catalogue_authority_import_batches)
2. Land raw rows (all files/tabs → catalogue_authority_import_raw)
3. Parse + validate Category 1 products → c1_product_candidates
4. Parse + validate Category 1 aliases → c1_alias_candidates
      (resolve product_sku → candidate or matched products.id)
5. Category 2 content products → c2_content_candidates
      (optional refs to C1 SKUs — warnings if unresolved)
6. Category 3 platforms → c3_platform_candidates
7. Category 3 collections → c3_collection_candidates
8. Category 3 generation rules → c3_generation_rule_candidates
9. Category 4 hamper families → c4_hamper_family_candidates
10. Category 4 hamper lines → c4_hamper_line_candidates
      (refs C2/C3/C1 SKUs — warnings only at skeleton stage)
11. Batch-level validation summary (no promotion)
```

**Do not import data in the first implementation PR** — only schema + empty parse dry-run tooling.

---

## 7. Validation checks (staging-only)

| Check | Applies to | Action on failure |
|-------|------------|-------------------|
| Required SKU / name / HSN / GST present | C1, C2, C3 platforms | `validation_status = error` |
| SKU format per Rulebook V1 | All product-like rows | `warning` or `error` per rule severity |
| Duplicate SKU within batch | All | `duplicate_in_batch` |
| Duplicate SKU vs `products.sku` | C1, C2, C3 | `duplicate_existing` + populate `matched_product_id` |
| Alias normalized uniqueness | C1 aliases | vs `product_aliases.alias_text` + within batch |
| Unknown component SKU | C4 lines, C2 BOM refs | `missing_reference` (warning at skeleton stage) |
| C3 collection member SKU exists in batch or DB | C3 collections | `warning` until C1/C2 promoted |
| Generation rule JSON schema | C3 rules | `error` if schema invalid |
| `source_environment` | Batch | must be `staging` only |
| Row hash dedup | Raw | skip re-load of identical rows in same batch |

---

## 8. What must stay read-only

| Layer | Read-only rule |
|-------|----------------|
| **Operational `products`** | No INSERT/UPDATE/DELETE from import job or staging triggers |
| **`product_aliases`, `product_bom`, `product_tags`** | No writes until explicit promote RPC after staff approval |
| **`factory_inventory`, `inventory_stock_balances`** | No connection |
| **`orders`, `order_items`, `sales_order_drafts`** | No connection |
| **`catalogue_product_mappings`** | No auto-create from authority staging (connector path stays separate) |
| **`visible_in_catalog`, `is_active`** | Do not flip on import — promotion PR may default `visible_in_catalog = false` |
| **Buyer `/catalogue` and admin merchandising** | Continue reading live authority only |
| **WhatsApp product resolution** | Continue reading `products` + `product_aliases` only |

Staging tables themselves are **writable by internal staff** via future admin import UI or controlled CLI — not by anon/authenticated buyers.

---

## 9. What not to connect yet

| System | Reason |
|--------|--------|
| Customer storefront / quick order | Authority not validated |
| Cart pricing engine (`pricing.ts`) | Needs promoted `products` fields |
| AI Catalogue Builder connector | Different source (`ApprovedCatalogueProductSnapshot`); do not merge pipelines |
| `/admin/catalogue-approvals` | Tag/alias **draft** RPCs ≠ bulk authority candidates |
| WA operator inbox / `APPROVED_FOR_SO` | Order domain |
| Golden Chain wizard | Order/inventory domain |
| Barcode ingest / scan timeline | Needs operational SKU + scan policy |
| Inventory command center / risk boards | Synthetic feeds only today |
| Auto-promotion on batch load | Violates staging-first policy |

---

## 10. Mapping notes by category

### Category 1 — products & aliases

**Target fields on `products` (for promotion design, not import):**

`sku`, `name`, `category`, `sub_category`, `hsn_code`, `gst_percentage`/`gst_rate`, `uom` (Kg), `price_per_kg`, tier prices, `primary_pack_weight_kg`, `packs_per_master_carton`, `moq`, `product_family` = `bulk_sweets`, `barcode_sku`, `settlement_unit`.

**Aliases:** prefer `product_aliases` table over `products.aliases[]` array for WA resolution; staging should support both `alias_text` and optional `product_id` resolution.

### Category 2 — source/content products

Map to `products` with `uom` Pc, `product_family` `retail_pack`, pack weight fields (`net_weight_grams`, `avg_weight_per_pack`), `mrp_per_pc` / tier pc pricing.

May reference C1 SKUs as BOM/content inputs in JSON — full BOM wiring deferred.

### Category 3 — platforms, collections, rules

| Staging entity | Promotion target |
|----------------|------------------|
| Platform SKU | `products` (`product_family` `goldware`, `dimensions`, `material`) |
| Collection | `product_tags` + `product_tag_mapping` |
| Generation rule | New operational store or JSON on products metadata — **do not promote rules until Rulebook V1 schema is frozen** |

### Category 4 — hamper families (basic skeleton)

**In scope for staging skeleton:**

- Family code, display name, marketing `bom_summary` text, optional `gross_weight_kg`
- Line items: `component_sku`, `quantity_per_unit`, optional `component_name`

**Out of scope for first pass:**

- Auto-generated sellable hamper SKUs
- Dynamic pricing from components
- Assembly production job creation
- Full `product_bom` promotion without C1/C2/C3 stability

Use `product_bom` + `products.product_family = hampers` only after explicit C4 promote PR.

---

## 11. Drift and dependency risks

| Risk | Mitigation |
|------|------------|
| `catalogue_tag_drafts` / `catalogue_alias_drafts` missing on staging DB | Reconcile C1a migration into git before C3 collection promotion (see `docs/CATALOGUE_APPROVAL_GAP_TRACE.md` on branch `cursor/catalogue-approval-gap-trace-9b16`) |
| `products` base DDL not in repo | Document promotion SQL against `types.ts`; verify on staging before prod |
| `customer_import_*` not in `types.ts` | Regenerate types after any new migration |
| Authority files not in repo | Block import tooling merge until `project/raw/catalogue-authority/` manifest exists |
| Two catalogue pipelines (connector vs authority) | Never write same SKU from both without mapping table; authority staging uses `source_app = 'catalogue_authority_pack'` metadata |

---

## 12. Recommended next PR scope (safest sequence)

| PR | Scope | SQL? | Data import? |
|----|-------|------|--------------|
| **A (this deliverable)** | `docs/CATALOGUE_AUTHORITY_STAGING_IMPORT_PLAN.md` | No | No |
| **B** | Check in authority source manifest + tab/sheet inventory (no binaries in git if policy requires; use secure artifact store + checksum doc) | No | No |
| **C** | Migration: `catalogue_authority_import_batches` + `catalogue_authority_import_raw` + **C1 product candidates only** + RLS internal-staff-only | Yes (staging) | No |
| **D** | Migration: C1 alias candidates + parse/validate CLI or admin read-only review page (list candidates, no promote) | Yes | No |
| **E** | C2/C3 candidate tables + dry-run parser against checked-in samples | Yes | **Dry-run only** |
| **F** | C4 hamper skeleton tables + validation | Yes | Dry-run only |
| **G** | Promote RPCs for C1 only + staff approval UI | Yes | Controlled promote |

**Recommended immediate next PR after this doc:** **PR C** — smallest staging footprint (batch + raw + C1 products), mirrors proven `customer_import_*` pattern, no promotion, no data load.

---

## 13. Acceptance criteria (plan complete)

- [x] Existing product/catalogue schema inspected
- [x] Safest staging targets identified per category
- [x] No data import performed
- [x] Implementation plan documented
- [x] Read-only and do-not-connect boundaries explicit
- [x] Next PR scope bounded

---

*Plan only. No SQL, migrations, data import, or production changes were made.*
