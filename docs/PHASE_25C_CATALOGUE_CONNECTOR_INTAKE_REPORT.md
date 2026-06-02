# PHASE 25C — Catalogue Connector Intake Report

**Date:** 2026-06-01  
**Branch:** `cursor/phase-25c-catalogue-intake-ee77` (includes Phase 25B foundation)  
**Depends on:** `catalogue_product_mappings` migration (25B)

---

## Intake method chosen

| Option | Phase | Decision |
|--------|-------|----------|
| **A. Admin manual JSON import** | **25C (now)** | **Implemented** — `/admin/catalogue-sync` pilot panel |
| B. Supabase Edge Function webhook | 25D+ | Proposed when Builder app can POST signed payloads |
| C. Scheduled pull from Builder API | 25D+ | Proposed after Builder REST export exists |

Rationale: smallest safe path; reuses `syncApprovedCatalogueProduct` with validation gate; no new infra.

---

## Implementation

### Validation (`validateApprovedCatalogueSnapshot`)

- Parses JSON string or object (single object or one-element array)
- **Required:** `external_catalogue_product_id`, `sku`, `product_name`, `category`, `hsn_code`, `status`, `version`, `updated_at`, `approved_image_urls` (array)
- Rejects empty sku / name / external id

### Intake (`intakeApprovedCatalogueSnapshot`)

- Validate → `syncApprovedCatalogueProduct` on Supabase or in-memory store
- Returns validation errors or sync result

### Admin UI

- Textarea + **Import & sync** on `/admin/catalogue-sync`
- Shows validation errors or last sync result (status, SKU, central product id)
- Refreshes mappings table after success

---

## Files changed

| Path | Change |
|------|--------|
| `src/lib/catalogue-connector/validateApprovedCatalogueSnapshot.ts` | **New** |
| `src/lib/catalogue-connector/intakeApprovedCatalogueSnapshot.ts` | **New** |
| `src/lib/catalogue-connector/index.ts` | Exports |
| `src/lib/catalogue-connector/__tests__/catalogueConnectorIntake.test.ts` | **New** |
| `src/pages/admin/AdminCatalogueSyncStatus.tsx` | Pilot JSON import UI |
| `docs/PHASE_25C_CATALOGUE_CONNECTOR_INTAKE_REPORT.md` | This report |

---

## Tests run

| Command | Result |
|---------|--------|
| `npm run typecheck` | **PASS** |
| `npm test -- --run catalogue-connector` | **15/15 PASS** (includes intake: valid sync, invalid rejected, stale skipped, inactive deactivate) |
| `npm run build` | **PASS** |

---

## Ready for Builder app integration?

**Partially ready.**

| Ready now | Not yet |
|-----------|---------|
| Contract + sync + mapping table (25B) | Builder app / API |
| Manual JSON pilot intake (25C) | Webhook edge function |
| Admin visibility of sync status | Scheduled pull job |
| Idempotent SKU / version rules | Auth between Builder → Central |

**Next (25D):** Edge function `catalogue-approved-webhook` calling `intakeApprovedCatalogueSnapshot` with shared secret; Builder publishes on approve.

---

*End of Phase 25C report.*
