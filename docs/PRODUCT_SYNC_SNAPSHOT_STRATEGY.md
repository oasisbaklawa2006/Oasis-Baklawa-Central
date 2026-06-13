# Product Sync Snapshot Strategy

**Date:** 2026-06-13  
**Purpose:** Define versioned export packages from AI Studio → downstream consumers without dual-master edits.

---

## Design principles

1. **Snapshots are immutable** once published (version `n` never mutates; publish creates `n+1`).
2. **Consumers import slices** — each app receives only fields it needs.
3. **Stable keys:** `product_id` (UUID) + `sku` + `external_catalogue_product_id`.
4. **Diff-friendly:** each snapshot includes `version`, `published_at`, `published_by`, `checksum`.
5. **No delete** on Central import — deactivate via `status: inactive` in snapshot.

---

## Snapshot types

### 1. `central_product_snapshot` (B2B operational slice)

**Consumer:** Oasis-Baklawa-Central (`products` table + buyer catalogue)  
**Trigger:** AI Studio publish approval → webhook or manual JSON handoff → Central `/admin/catalogue-sync`

```typescript
interface CentralProductSnapshot {
  schema_version: "1.0";
  snapshot_id: string;
  product_id: string;
  external_catalogue_product_id: string;
  sku: string;
  version: number;
  published_at: string; // ISO
  published_by: string; // user id

  // Identity
  product_name: string;
  product_description: string | null;
  category: string;
  sub_category: string | null;
  production_department: string; // canonical snake_case

  // Commerce (B2B)
  wholesale_price: number | null;
  base_price: number | null;
  mrp: number | null;
  moq: number | null;
  pack_size: string | null;
  uom: string | null;
  settlement_unit: string | null;

  // Unit math
  grams_per_piece: number | null;
  weight_per_box_kg: number | null;
  primary_pack_weight_kg: number | null;
  pcs_per_kg: number | null;
  pcs_per_primary_pack: number | null;
  packs_per_master_carton: number | null;
  net_weight_grams: number | null;

  // Compliance (approved only)
  hsn_code: string;
  gst_rate: number | null;
  ingredients: string | null;
  allergen_warnings: string | null;
  nutrition_facts: string | null; // only if QA approved flag set

  // Merchandising
  approved_image_urls: string[]; // [0] → products.image_url
  status: "active" | "inactive";
  visible_in_catalog: boolean;

  // Ops
  barcode_sku: string | null;

  checksum: string; // sha256 of canonical JSON
}
```

**Maps to existing:** `ApprovedCatalogueProductSnapshot` in `src/lib/catalogue-connector/catalogueConnectorTypes.ts` — extend with unit math + visibility + production_department canonical.

**Central import rules:**

- Upsert `catalogue_product_mappings` by `external_catalogue_product_id`
- Update `products` by `central_product_id` or create new
- Set `image_url` = first approved URL
- Never null-out fields absent from snapshot (merge policy: snapshot wins for declared keys only)

---

### 2. `label_product_snapshot`

**Consumer:** Label print workflows (AI Studio LabelQueue + Central LabelCommandCenter)

```typescript
interface LabelProductSnapshot {
  schema_version: "1.0";
  product_id: string;
  sku: string;
  version: number;
  published_at: string;

  product_name: string;
  net_weight_grams: number | null;
  pack_size: string | null;
  ingredients: string | null;
  allergen_warnings: string | null;
  nutrition_panel: Record<string, unknown> | null; // from nutrition_panels
  fssai_license: string | null;
  barcode_sku: string | null;
  storage_instructions: string | null;
  shelf_life_days: number | null;
  label_artwork_urls: string[]; // label-assets bucket

  qa_approved: boolean;
  checksum: string;
}
```

**Rule:** Print stations reject if `qa_approved !== true`.

---

### 3. `b2c_product_snapshot`

**Consumer:** Future B2C app (not built)

```typescript
interface B2cProductSnapshot {
  schema_version: "1.0";
  product_id: string;
  sku: string;
  version: number;

  consumer_title: string;
  consumer_description: string | null;
  mrp: number | null;
  hero_image_url: string | null;
  lifestyle_image_urls: string[];
  gallery_urls: string[];
  dietary_tags: string[];
  nutrition_display: Record<string, unknown> | null;
  visible_on_b2c: boolean;

  checksum: string;
}
```

---

### 4. `whatsapp_resolver_snapshot`

**Consumer:** Central WA inbox / `fetchProductResolution`

```typescript
interface WhatsappResolverSnapshot {
  schema_version: "1.0";
  product_id: string;
  sku: string;
  version: number;
  published_at: string;

  canonical_name: string;
  aliases: Array<{
    alias_text: string;
    normalized: string;
    language: string | null;
    channel_scope: "whatsapp" | "all";
    term_type: string | null;
  }>;
  blocked_generics: string[]; // reference list used at publish time
  pack_hints: string[]; // e.g. "3kg", "box"

  checksum: string;
}
```

**Central import:** Upsert `product_aliases` for `channel_scope=whatsapp`; refresh resolver cache; do **not** write `products.aliases[]` array (deprecate dual store).

---

## Publish pipeline (AI Studio)

```
ProductEdit (approved state)
    → Product Truth readiness gates pass
    → generateCatalogueSnapshot() [existing]
    → slice into 4 payloads
    → store in catalogue_versions.payload (jsonb)
    → emit sync events (catalogue_sync_events)
    → [future] webhook to Central
```

**Readiness gates before publish:**

| Gate | Rule |
|------|------|
| Identity | name, sku, category, production_department |
| B2B commerce | wholesale_price, MOQ |
| Media | hero approved in `product_media` |
| Compliance | HSN/GST present; nutrition only if QA flag |
| Aliases | ≥1 non-generic alias for pilot SKUs |
| Resolver | no collision with blocked generics |

---

## Central ingest pipeline

```
Receive snapshot (webhook / manual / queue)
    → validate schema_version + checksum
    → reject if version <= last_synced_version (stale)
    → dry-run diff UI (new)
    → operator approve
    → syncApprovedCatalogueProduct() [extend]
    → update catalogue_product_mappings.sync_status
    → log audit row
```

**Phased rollout:**

| Phase | Mode |
|-------|------|
| 0 (now) | Manual JSON paste at `/admin/catalogue-sync` |
| 1 | AI Studio export file download → upload |
| 2 | Signed webhook + auto dry-run diff |
| 3 | Auto-apply for non-breaking fields; manual for price/visibility |
| 4 | Full auto with rollback |

---

## Versioning & rollback

- `catalogue_versions.version` monotonic per product  
- Central stores `source_version` on `catalogue_product_mappings` (already exists)  
- Rollback = re-import previous snapshot version (never DELETE product row)

---

## Field merge policy (Central import)

| Policy | Fields |
|--------|--------|
| **Snapshot wins** | description, pricing, compliance, images, aliases (ingest), production_department |
| **Central retains** | `factory_inventory`, order FKs, override flags |
| **Union** | `product_tags` merchandising (Central presentation layer) |
| **Never import** | draft tables, localStorage fallbacks, suggestion-only AI fields |

---

## Security

- Snapshots signed with HMAC or delivered over authenticated webhook  
- RLS: only `catalogue_reviewer` / `super_admin` can publish  
- Central ingest requires `ADMIN` + module `products`  
- No service role in browser — Edge Function or server worker for webhook verify

---

## Gap vs today

| Item | Today | Needed |
|------|-------|--------|
| Multi-slice export | Single `ApprovedCatalogueProductSnapshot` | 4 typed slices |
| AI Studio → Central automation | Preview only | Webhook + queue |
| `whatsapp_resolver_snapshot` | Ad hoc aliases | Formal publish |
| QA flag on nutrition | UI warning only | `qa_approved` in label + B2B snapshots |
| Image types in B2B | `approved_image_urls[0]` only | Map hero/square from `product_media.type` |
