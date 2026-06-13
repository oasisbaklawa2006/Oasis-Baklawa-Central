# Batch 001 Image Upload Readiness

**Generated:** 2026-06-12  
**Scope:** First 5 pilot SKUs — temporary image support (upgrade later)  
**Verdict:** **READY FOR IMAGE UPLOAD** (rendering path verified; catalogue listing still gated on visibility flags)

---

## Executive summary

The `products.image_url` field is wired correctly in buyer-facing UI. No code changes are required for image display. Once merchandising populates `image_url` with a public Supabase Storage URL, images render in the product detail page and search results immediately (subject to `is_active` for search). The buyer catalogue **grid** also renders `image_url` correctly, but pilot SKUs do not appear in the grid until `is_active = true` **and** `visible_in_catalog = true`.

---

## Image field source

| Item | Detail |
|------|--------|
| **Database column** | `products.image_url` (`text`, nullable) |
| **Type definition** | `src/integrations/supabase/types.ts` → `products.Row.image_url` |
| **Storage bucket** | Supabase `product-images` (public URLs via `getPublicUrl`) |
| **Admin upload path** | Admin → Products → edit SKU → image picker (`AdminProducts.tsx`) |
| **Intake prefix (pilot)** | `product-images/batch001/intake/first5/` (see media intake workflow) |
| **Live snapshot signal** | `BATCH001_LIVE_HEALTH_SNAPSHOT.has_image` → maps to `image_url` presence |

---

## Rendering locations (verified in code)

### 1. Buyer catalogue grid

| Item | Detail |
|------|--------|
| **Route** | `/catalogue` |
| **Data** | `useProducts()` → `select("*")` on `products`, filtered by `isBuyerVisibleProduct()` |
| **Component** | `src/components/catalogue/CatalogueProductCard.tsx` |
| **Logic** | `item.image_url` → `<img src={item.image_url} … object-contain>`; else `<Package>` placeholder |
| **Status** | **Rendering OK** — requires `is_active` + `visible_in_catalog` for product to appear in grid |

### 2. Product detail page

| Item | Detail |
|------|--------|
| **Route** | `/product/:id` |
| **Data** | `supabase.from("products").select("*").eq("id", id).single()` |
| **Component** | `src/pages/ProductDetail.tsx` |
| **Logic** | `images = [product.image_url].filter(Boolean)`; falls back to `/placeholder.svg` when null |
| **Status** | **Rendering OK** — displays image on direct URL as soon as `image_url` is set (no visibility filter on page) |

### 3. Search results

| Item | Detail |
|------|--------|
| **UI** | Global search overlay (`SearchOverlay`) |
| **Data** | `select("…, image_url, …")` where `is_active = true` |
| **Component** | `src/components/SearchOverlay.tsx` |
| **Logic** | `product.image_url` → `<img … object-cover>`; else 📦 emoji placeholder |
| **Status** | **Rendering OK** — image shows when `image_url` set and `is_active = true` |

### Related (not in scope but confirmed)

- `ProductRecommendations.tsx` — uses `image_url` on detail page cross-sell
- `AdminMerchandising.tsx` — admin preview of `image_url`

---

## First 5 pilot SKU status report

Source: `src/lib/language-wave/batch001Manifest.ts` + `BATCH001_LIVE_HEALTH_SNAPSHOT` (2026-06-09 read-only audit).  
`is_active` not captured in snapshot — marked **unverified**.

| SKU | Product name | Product ID | Current `image_url` | `visible_in_catalog` | `is_active` |
|-----|--------------|------------|---------------------|:--------------------:|:-----------:|
| OAS-AS-BKL-0024 | Mor Pistachio Durum | `cea65af8-129c-4838-988f-30955fa5bc22` | **null** | false | unverified |
| OAS-AS-BKL-0020 | Tart Cashew | `b0aee1c4-4502-4a15-9880-e2c01378c0b5` | **null** | false | unverified |
| OAS-AS-BKL-0001 | Cashew Kitta | `c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0` | **null** | false | unverified |
| OAS-AS-BKL-0025 | Coconut Durum | `f58e0a78-53a9-400b-8768-7af09b68ba38` | **null** | false | unverified |
| OAS-AS-BKL-0007 | Cashew Finger | `2390ea3d-19ba-43bb-8624-d6b033153c2f` | **null** | false | unverified |

**Product URLs (for post-upload QA):**

| SKU | Preview URL |
|-----|-------------|
| OAS-AS-BKL-0024 | https://b2b.oasisbaklawa.com/product/cea65af8-129c-4838-988f-30955fa5bc22 |
| OAS-AS-BKL-0020 | https://b2b.oasisbaklawa.com/product/b0aee1c4-4502-4a15-9880-e2c01378c0b5 |
| OAS-AS-BKL-0001 | https://b2b.oasisbaklawa.com/product/c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0 |
| OAS-AS-BKL-0025 | https://b2b.oasisbaklawa.com/product/f58e0a78-53a9-400b-8768-7af09b68ba38 |
| OAS-AS-BKL-0007 | https://b2b.oasisbaklawa.com/product/2390ea3d-19ba-43bb-8624-d6b033153c2f |

---

## Pilot readiness — image display once `image_url` is populated

| Surface | Displays image when `image_url` set? | Additional gates |
|---------|:------------------------------------:|------------------|
| Product detail (`/product/:id`) | **Yes — immediately** | None (direct link QA) |
| Search overlay | **Yes** | `is_active = true` |
| Buyer catalogue grid | **Yes (rendering)** | `is_active = true` **and** `visible_in_catalog = true` |

**Conclusion:** Image rendering is not blocked by application code. Uploading a valid public URL to `products.image_url` is sufficient for the UI to show the image on every surface where the product is reachable.

---

## Blockers

| Blocker | Type | Owner | Blocks image render? |
|---------|------|-------|:--------------------:|
| All 5 SKUs have `image_url = null` | Data | Merchandising | Yes — until URL set |
| All 5 have `visible_in_catalog = false` | Data / governance | Catalogue admin | No — only blocks catalogue grid listing |
| `is_active` unverified in snapshot | Data | Catalogue admin | No for detail; yes for search/grid |
| No separate hero vs square fields in snapshot | Data model | Future | No — single `image_url` used for card + detail |
| Session cache in `useProducts` | Runtime | Ops | Stale grid until refresh after upload (SWR revalidates on load) |

**No rendering code defects identified.** No schema changes or migrations required.

---

## Exact upload process for merchandising

### Option A — Admin Products (fastest for pilot)

1. Sign in to Central admin → **Products**.
2. Search/open the pilot SKU (e.g. `OAS-AS-BKL-0024`).
3. Use the **image upload** control on the product form.
4. File uploads to Supabase bucket `product-images` and sets `image_url` on save.
5. **Save product** — confirm `image_url` shows in the form preview.
6. Open the product URL (table above) in a browser tab — confirm hero image loads.
7. Repeat for SKUs 0020, 0001, 0025, 0007.

### Option B — Intake folder then governed link (controlled)

1. Upload files to `product-images/batch001/intake/first5/` using naming:  
   `{SKU}_square.jpg` (primary catalogue image).
2. Complete image reviewer checklist (clarity, correct product, packaging, no watermark).
3. Catalogue admin copies approved file to `product-images/batch001/live/`.
4. Set `products.image_url` to the public Storage URL (via Products admin or governed connector).
5. QA on product detail URL before any `visible_in_catalog` flip.

### Temporary image guidance

- Use square-oriented JPG, min 1200×1200, for `image_url` (drives card + detail).
- Hero/detail assets can be added later when multi-image support exists; for now one URL serves all surfaces.
- Prefer stable filenames under `batch001/live/` so URL replacements are traceable.

### Post-upload QA checklist (per SKU)

1. Product detail page shows image (not placeholder).
2. Search by SKU/name shows thumbnail (requires `is_active = true`).
3. After visibility activation: catalogue grid card shows image.
4. Hard-refresh or new session if catalogue cache shows old placeholder.

---

## Validation performed

| Check | Result |
|-------|--------|
| `CatalogueProductCard` uses `image_url` | Pass |
| `ProductDetail` uses `image_url` | Pass |
| `SearchOverlay` selects and renders `image_url` | Pass |
| `products.image_url` in generated types | Pass |
| `npm run typecheck` | Pass |
| `npm run build` | Pass |

---

## Final verdict

### **READY FOR IMAGE UPLOAD**

Image display logic is implemented and working. Merchandising can populate `products.image_url` now using Admin → Products or the governed intake path. Temporary images will render immediately on product detail; search and catalogue grid additionally require `is_active` (and catalogue grid requires `visible_in_catalog`) for the product to be discoverable — those are data/governance gates, not rendering defects.
