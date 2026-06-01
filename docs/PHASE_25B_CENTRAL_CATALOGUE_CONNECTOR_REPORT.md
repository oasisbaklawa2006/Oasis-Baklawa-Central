# PHASE 25B — Central Catalogue Connector Foundation Report

**Date:** 2026-06-01  
**Branch:** `cursor/phase-25b-catalogue-connector-ee77`

---

## Migration required?

**Yes** — `supabase/migrations/20260601180000_phase25b_catalogue_product_mappings.sql`

Creates `catalogue_product_mappings` with RLS for internal staff. **Apply on staging/prod before using admin sync UI or Supabase store.**

---

## Files changed

| Area | Path |
|------|------|
| Migration | `supabase/migrations/20260601180000_phase25b_catalogue_product_mappings.sql` |
| Connector lib | `src/lib/catalogue-connector/*` |
| Types (Supabase) | `src/integrations/supabase/types.ts` |
| Admin UI | `src/pages/admin/AdminCatalogueSyncStatus.tsx` |
| Routes / nav | `src/App.tsx`, `src/components/AdminLayout.tsx` |
| Tests | `src/lib/catalogue-connector/__tests__/*` |

---

## Sync contract implemented

- **Input:** `ApprovedCatalogueProductSnapshot` (external id, SKU, name, description, approved_image_urls, prices, category, HSN/GST/UOM, barcode, active/inactive, version, updated_at)
- **Idempotent upsert** by `(source_app, external_catalogue_product_id)` with SKU uniqueness per source app
- **Product upsert** by existing mapping / `central_product_id` / SKU — never delete
- **Inactive:** `is_active = false`, `visible_in_catalog = false`, `sync_status = deactivated`
- **Image:** `selectPrimaryImageUrl()` → `products.image_url`
- **Stale version:** `skipped_stale` when incoming `version` &lt; stored `source_version`
- **SKU conflict:** error when same SKU maps to different external ids
- **Bundle:** `createCatalogueConnectorBundle(supabase).syncApprovedCatalogueProduct(snapshot)`

---

## Tests run

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm test -- --run catalogue-connector` | **9/9 PASS** |
| `npm run build` | PASS |

Covers: idempotent sync, no duplicate SKU product, inactive deactivation, image_url, external→central mapping, logic helpers.

---

## What remains for AI Catalogue Builder app

- Own DB, UI, AI generation, approval workflow, media vault
- Publish API / webhook calling Central sync (edge function or pull consumer — Phase 25C)
- Real `approved_image_urls` CDN hosting
- Scheduled or event-driven push of approved snapshots

---

## Admin surface

**Read-only:** `/admin/catalogue-sync` (Governance → Catalogue sync, `products` module)

---

*End of Phase 25B report.*
