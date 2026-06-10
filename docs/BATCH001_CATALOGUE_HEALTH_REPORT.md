# Batch 001 Catalogue Health Report

**Date:** 2026-06-09  
**Source:** Live Central read-only audit (`products` + `product_aliases`)  
**Batch:** `OAS-AS-BKL-0001` … `OAS-AS-BKL-0025`

---

## Batch readiness score: **62%**

Average per-SKU health across seven dimensions: HSN/GST, UOM/packaging, media, search visibility, alias readiness, WhatsApp keyword depth, product truth.

---

## Dimension summary

| Dimension | Pass rate | Notes |
|-----------|-----------|-------|
| HSN/GST | 25 / 25 | All have `21069099` + GST |
| UOM/packaging | 25 / 25 | `pack_size` populated |
| Product truth (name+sku) | 25 / 25 | Canonical names present |
| Alias readiness | 17 / 25 → **25 / 25** post Wave 2C | 8 SKUs had zero aliases |
| WhatsApp keyword depth (≥3 aliases) | 17 / 25 | Improves post Wave 2C |
| Media (`image_url`) | **0 / 25** | No Batch 001 images |
| Search visibility (`visible_in_catalog`) | **0 / 25** | Internal batch — not buyer-visible |

---

## Per-SKU scores (live snapshot)

| SKU | Product | Score | Missing |
|-----|---------|-------|---------|
| OAS-AS-BKL-0001 | Cashew Kitta | 71% | Media, search visibility |
| OAS-AS-BKL-0002 | Square Baklawa | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0003 | Cashew Ring | 71% | Media, search visibility |
| OAS-AS-BKL-0004 | Cashew Rosebud | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0005 | Almond Crosole | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0006 | Cashew Pyramid | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0007 | Cashew Finger | 71% | Media, search visibility |
| OAS-AS-BKL-0008 | Date Baklawa | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0009 | Special Square Baklawa | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0010 | Pistachio Ring | 71% | Media, search visibility |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0012 … 0017 | Asiyah family | 71% | Media, search visibility |
| OAS-AS-BKL-0018 | Diamond Pistachio | 57% | Aliases, media, search, WA depth |
| OAS-AS-BKL-0019 … 0025 | Remaining | 71% | Media, search visibility |

---

## Missing-data inventory

| Priority | Gap | SKUs affected | Remediation wave |
|----------|-----|---------------|------------------|
| P0 | Zero aliases | 8 | **Wave 2C** (drafts ready) |
| P0 | Live cross-SKU collisions | 2 (0013/0014) | Wave 3 collision cleanup |
| P1 | No product images | 25 | Catalogue connector / merchandising |
| P1 | Not buyer-visible | 25 | Intentional for Batch 001 authority — enable when ready |
| P2 | `products.aliases[]` empty | 25 | Sync from approved aliases post-promotion |
| P2 | Generic null-`product_id` pollution | 6 aliases | Governed delete/replace |

---

## Evidence

- `docs/evidence/batch-001/catalogue-health.json`
- `src/lib/language-wave/catalogueHealth.ts`
