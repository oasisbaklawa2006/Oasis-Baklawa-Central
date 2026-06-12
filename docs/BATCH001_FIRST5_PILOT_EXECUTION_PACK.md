# Batch 001 First 5 SKU Pilot Execution Pack

**Generated:** 2026-06-12  
**Purpose:** Buyer catalogue preview preparation — execution pack only (no production writes)  
**SKUs:** OAS-AS-BKL-0024, OAS-AS-BKL-0020, OAS-AS-BKL-0001, OAS-AS-BKL-0025, OAS-AS-BKL-0007

## Executive summary

| Metric | Value |
|--------|------:|
| Average readiness (9 gates) | **56%** |
| Pilot ready (all gates) | **0 / 5** |
| Images required | **10 required** + **5 optional** detail (15 assets outstanding) |
| Description drafts prepared | **5 / 5** |
| Alias gaps (live) | **0 / 5** |
| **Buyer preview** | **NO-GO** |

## Deliverables

| File | Purpose |
|------|---------|
| `data/catalogue/batch001_first5_media_shotlist.csv` | Image shot list |
| `data/catalogue/batch001_first5_description_drafts.csv` | Description drafts for approval |
| `data/catalogue/batch001_first5_visibility_activation_checklist.csv` | Per-SKU activation preconditions |

---

## 1. OAS-AS-BKL-0024 — Mor Pistachio Durum

### Current readiness

| Check | Status |
|-------|--------|
| Readiness score | **56%** (9 gates) |
| Pilot ready | **NO** |
| Category | Turkish Baklawa (OK) |
| Pack | 1kg (OK) |
| visible_in_catalog | false |
| is_active | unverified |
| image_url | missing |
| description (DB) | missing |

### Image requirements

| Asset | Aspect | Min size | Filename | Status |
|-------|--------|----------|----------|--------|
| Hero image | 16:9 | 1600×900 | `oas_as_bkl_0024_hero.jpg` | **Required — missing** |
| Square catalogue image | 1:1 | 1200×1200 | `oas_as_bkl_0024_catalogue_sq.jpg` | **Required — missing** |
| Detail image (optional) | 4:3 | 1600×1200 | `oas_as_bkl_0024_detail.jpg` | Optional |

### Buyer-facing description (draft)

> Premium Turkish baklawa durum layered with pistachio and clarified butter. Sold in 1 kg packs for HORECA and wholesale buyers who need a distinctive pistachio-forward durum line.

*Draft only — not written to `products.description`.*

### Search aliases (live)

| Field | Value |
|-------|-------|
| Live `product_aliases` rows (snapshot) | **21** |
| Primary alias (canonical) | Mor Pistachio Durum Turkish Baklava |
| WhatsApp keyword (canonical) | mor pistachio durum |

### Missing aliases

None — live alias coverage present in Central snapshot.

### Resolver status

**PASS** — Primary utterance resolves to the expected product (`OAS-AS-BKL-0024`). Buyer search and discovery appear healthy for this SKU.

### Product URL

https://b2b.oasisbaklawa.com/product/cea65af8-129c-4838-988f-30955fa5bc22

### Visibility activation preconditions

1. Hero + square catalogue images uploaded; `image_url` set via governed connector
2. Description draft approved and saved to `products.description`
3. `is_active = true` confirmed by catalogue admin
4. Live alias count re-verified (21 rows)
5. Resolver remains **PASS**
6. Pilot QA on preview environment
7. **Then** single-SKU `visible_in_catalog` flip (not bulk)

### Manual owner actions

| Owner | Action |
|-------|--------|
| Merchandising | Shoot/upload hero + square images; approve description draft |
| Catalogue admin | Verify `is_active`; activate `visible_in_catalog` after QA |
| Language ops | Confirm alias rows; monitor resolver on short keywords |
| Operations | Run first-5 buyer preview smoke test before go-live |


---

## 2. OAS-AS-BKL-0020 — Tart Cashew

### Current readiness

| Check | Status |
|-------|--------|
| Readiness score | **56%** (9 gates) |
| Pilot ready | **NO** |
| Category | Lebanese Baklawa (OK) |
| Pack | 6kg (OK) |
| visible_in_catalog | false |
| is_active | unverified |
| image_url | missing |
| description (DB) | missing |

### Image requirements

| Asset | Aspect | Min size | Filename | Status |
|-------|--------|----------|----------|--------|
| Hero image | 16:9 | 1600×900 | `oas_as_bkl_0020_hero.jpg` | **Required — missing** |
| Square catalogue image | 1:1 | 1200×1200 | `oas_as_bkl_0020_catalogue_sq.jpg` | **Required — missing** |
| Detail image (optional) | 4:3 | 1600×1200 | `oas_as_bkl_0020_detail.jpg` | Optional |

### Buyer-facing description (draft)

> Lebanese tart cashew baklawa with a crisp pastry base and generous cashew filling. 6 kg pack suited for counter display and bulk replenishment.

*Draft only — not written to `products.description`.*

### Search aliases (live)

| Field | Value |
|-------|-------|
| Live `product_aliases` rows (snapshot) | **19** |
| Primary alias (canonical) | Tart Cashew Lebanese Baklava |
| WhatsApp keyword (canonical) | tart cashew |

### Missing aliases

None — live alias coverage present in Central snapshot.

### Resolver status

**PASS** — Primary utterance resolves to the expected product (`OAS-AS-BKL-0020`). Buyer search and discovery appear healthy for this SKU.

### Product URL

https://b2b.oasisbaklawa.com/product/b0aee1c4-4502-4a15-9880-e2c01378c0b5

### Visibility activation preconditions

1. Hero + square catalogue images uploaded; `image_url` set via governed connector
2. Description draft approved and saved to `products.description`
3. `is_active = true` confirmed by catalogue admin
4. Live alias count re-verified (19 rows)
5. Resolver remains **PASS**
6. Pilot QA on preview environment
7. **Then** single-SKU `visible_in_catalog` flip (not bulk)

### Manual owner actions

| Owner | Action |
|-------|--------|
| Merchandising | Shoot/upload hero + square images; approve description draft |
| Catalogue admin | Verify `is_active`; activate `visible_in_catalog` after QA |
| Language ops | Confirm alias rows; monitor resolver on short keywords |
| Operations | Run first-5 buyer preview smoke test before go-live |


---

## 3. OAS-AS-BKL-0001 — Cashew Kitta

### Current readiness

| Check | Status |
|-------|--------|
| Readiness score | **56%** (9 gates) |
| Pilot ready | **NO** |
| Category | Lebanese Baklawa (OK) |
| Pack | 3kg (OK) |
| visible_in_catalog | false |
| is_active | unverified |
| image_url | missing |
| description (DB) | missing |

### Image requirements

| Asset | Aspect | Min size | Filename | Status |
|-------|--------|----------|----------|--------|
| Hero image | 16:9 | 1600×900 | `oas_as_bkl_0001_hero.jpg` | **Required — missing** |
| Square catalogue image | 1:1 | 1200×1200 | `oas_as_bkl_0001_catalogue_sq.jpg` | **Required — missing** |
| Detail image (optional) | 4:3 | 1600×1200 | `oas_as_bkl_0001_detail.jpg` | Optional |

### Buyer-facing description (draft)

> Classic Lebanese cashew kitta baklawa — flaky layers, roasted cashew, and traditional syrup finish. 3 kg trade pack for everyday menu staples.

*Draft only — not written to `products.description`.*

### Search aliases (live)

| Field | Value |
|-------|-------|
| Live `product_aliases` rows (snapshot) | **12** |
| Primary alias (canonical) | Cashew Kitta Lebanese Baklava |
| WhatsApp keyword (canonical) | cashew kitta |

### Missing aliases

None — live alias coverage present in Central snapshot.

### Resolver status

**PASS** — Primary utterance resolves to the expected product (`OAS-AS-BKL-0001`). Buyer search and discovery appear healthy for this SKU.

### Product URL

https://b2b.oasisbaklawa.com/product/c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0

### Visibility activation preconditions

1. Hero + square catalogue images uploaded; `image_url` set via governed connector
2. Description draft approved and saved to `products.description`
3. `is_active = true` confirmed by catalogue admin
4. Live alias count re-verified (12 rows)
5. Resolver remains **PASS**
6. Pilot QA on preview environment
7. **Then** single-SKU `visible_in_catalog` flip (not bulk)

### Manual owner actions

| Owner | Action |
|-------|--------|
| Merchandising | Shoot/upload hero + square images; approve description draft |
| Catalogue admin | Verify `is_active`; activate `visible_in_catalog` after QA |
| Language ops | Confirm alias rows; monitor resolver on short keywords |
| Operations | Run first-5 buyer preview smoke test before go-live |


---

## 4. OAS-AS-BKL-0025 — Coconut Durum

### Current readiness

| Check | Status |
|-------|--------|
| Readiness score | **56%** (9 gates) |
| Pilot ready | **NO** |
| Category | Turkish Baklawa (OK) |
| Pack | 1kg (OK) |
| visible_in_catalog | false |
| is_active | unverified |
| image_url | missing |
| description (DB) | missing |

### Image requirements

| Asset | Aspect | Min size | Filename | Status |
|-------|--------|----------|----------|--------|
| Hero image | 16:9 | 1600×900 | `oas_as_bkl_0025_hero.jpg` | **Required — missing** |
| Square catalogue image | 1:1 | 1200×1200 | `oas_as_bkl_0025_catalogue_sq.jpg` | **Required — missing** |
| Detail image (optional) | 4:3 | 1600×1200 | `oas_as_bkl_0025_detail.jpg` | Optional |

### Buyer-facing description (draft)

> Turkish coconut durum baklawa with aromatic coconut notes and fine phyllo layers. 1 kg pack ideal for specialty dessert counters and gift assortments.

*Draft only — not written to `products.description`.*

### Search aliases (live)

| Field | Value |
|-------|-------|
| Live `product_aliases` rows (snapshot) | **12** |
| Primary alias (canonical) | Coconut Durum Turkish Baklava |
| WhatsApp keyword (canonical) | coconut durum |

### Missing aliases

None — live alias coverage present in Central snapshot.

### Resolver status

**PASS** — Primary utterance resolves to the expected product (`OAS-AS-BKL-0025`). Buyer search and discovery appear healthy for this SKU.

### Product URL

https://b2b.oasisbaklawa.com/product/f58e0a78-53a9-400b-8768-7af09b68ba38

### Visibility activation preconditions

1. Hero + square catalogue images uploaded; `image_url` set via governed connector
2. Description draft approved and saved to `products.description`
3. `is_active = true` confirmed by catalogue admin
4. Live alias count re-verified (12 rows)
5. Resolver remains **PASS**
6. Pilot QA on preview environment
7. **Then** single-SKU `visible_in_catalog` flip (not bulk)

### Manual owner actions

| Owner | Action |
|-------|--------|
| Merchandising | Shoot/upload hero + square images; approve description draft |
| Catalogue admin | Verify `is_active`; activate `visible_in_catalog` after QA |
| Language ops | Confirm alias rows; monitor resolver on short keywords |
| Operations | Run first-5 buyer preview smoke test before go-live |


---

## 5. OAS-AS-BKL-0007 — Cashew Finger

### Current readiness

| Check | Status |
|-------|--------|
| Readiness score | **56%** (9 gates) |
| Pilot ready | **NO** |
| Category | Lebanese Baklawa (OK) |
| Pack | 3kg (OK) |
| visible_in_catalog | false |
| is_active | unverified |
| image_url | missing |
| description (DB) | missing |

### Image requirements

| Asset | Aspect | Min size | Filename | Status |
|-------|--------|----------|----------|--------|
| Hero image | 16:9 | 1600×900 | `oas_as_bkl_0007_hero.jpg` | **Required — missing** |
| Square catalogue image | 1:1 | 1200×1200 | `oas_as_bkl_0007_catalogue_sq.jpg` | **Required — missing** |
| Detail image (optional) | 4:3 | 1600×1200 | `oas_as_bkl_0007_detail.jpg` | Optional |

### Buyer-facing description (draft)

> Lebanese cashew finger baklawa in an easy-serve finger shape. 3 kg pack built for buffet, catering, and high-velocity reorder programs.

*Draft only — not written to `products.description`.*

### Search aliases (live)

| Field | Value |
|-------|-------|
| Live `product_aliases` rows (snapshot) | **11** |
| Primary alias (canonical) | Cashew Finger Lebanese Baklava |
| WhatsApp keyword (canonical) | cashew finger |

### Missing aliases

None — live alias coverage present in Central snapshot.

### Resolver status

**PASS** — Primary utterance resolves to the expected product (`OAS-AS-BKL-0007`). Buyer search and discovery appear healthy for this SKU.

### Product URL

https://b2b.oasisbaklawa.com/product/2390ea3d-19ba-43bb-8624-d6b033153c2f

### Visibility activation preconditions

1. Hero + square catalogue images uploaded; `image_url` set via governed connector
2. Description draft approved and saved to `products.description`
3. `is_active = true` confirmed by catalogue admin
4. Live alias count re-verified (11 rows)
5. Resolver remains **PASS**
6. Pilot QA on preview environment
7. **Then** single-SKU `visible_in_catalog` flip (not bulk)

### Manual owner actions

| Owner | Action |
|-------|--------|
| Merchandising | Shoot/upload hero + square images; approve description draft |
| Catalogue admin | Verify `is_active`; activate `visible_in_catalog` after QA |
| Language ops | Confirm alias rows; monitor resolver on short keywords |
| Operations | Run first-5 buyer preview smoke test before go-live |



## Activation order (recommended)

1. Complete media shotlist for all 5 SKUs
2. Merchandising approves description CSV → governed write to `products.description`
3. Staging preview with `visible_in_catalog` false — internal QA
4. Per-SKU visibility flip: 0024 → 0020 → 0001 → 0025 → 0007

## Constraints

- No SQL, migrations, or production writes in this pack
- No automatic Wave 2C approval
- No bulk `visible_in_catalog` publish

---

*Regenerate: `node scripts/generate-batch001-first5-pilot-pack.mjs`*
