# Batch 001 Catalogue Readiness

**Generated:** 2026-06-12  
**Batch:** 25 Baklawa SKUs (`OAS-AS-BKL-0001` … `OAS-AS-BKL-0025`)  
**Purpose:** Buyer-facing pilot readiness (read-only audit — no production changes)  
**Primary source:** `src/lib/language-wave/catalogueHealth.ts` (`BATCH001_LIVE_HEALTH_SNAPSHOT`, 2026-06-09 Central audit)  
**Batch health score:** 62% (seven-dimension catalogue health, not pilot-ready gate)

---

## Executive summary

| Metric | Count |
|--------|------:|
| **Pilot-ready products** | **0 / 25** |
| **Blocked products** | **25 / 25** |
| Missing images | 25 / 25 |
| Missing live aliases (Wave 2C pending) | 8 / 25 |
| Missing descriptions (unverified in live audit) | 25 / 25 |
| Not buyer-visible (`visible_in_catalog = false`) | 25 / 25 |
| Near-ready (live aliases + resolver pass; media/visibility/description gap) | 15 / 25 |
| Resolver primary-alias pass rate | 22 / 25 (88%) |

**Verdict:** Batch 001 is **not ready** for buyer-facing pilot. All 25 SKUs are blocked. Common gaps: missing images (25/25); not buyer-visible (25/25); unverified descriptions (25/25). 8 SKU(s) lack **live** `product_aliases` rows (Wave 2C: 32 draft terms across 8 SKUs, 4 per SKU — pending governed approval).

---

## Pilot readiness criteria

A SKU is **pilot-ready** only when **all seven** checks pass:

| # | Dimension | Criterion |
|---|-----------|-----------|
| 1 | Image | `image_url` present (live: `has_image = true`) |
| 2 | Alias coverage | ≥1 live `product_aliases` row (Wave 2C drafts alone do not count) |
| 3 | Description | Non-empty `products.description` |
| 4 | Category | `category` assigned on product record |
| 5 | Pack size | `pack_size` + `uom` populated |
| 6 | Product URL | Deep link `https://b2b.oasisbaklawa.com/product/{uuid}` with valid product UUID |
| 7 | Search discoverability | `visible_in_catalog = true` (buyer catalogue + search) |

---

## Ready products (0)

_No SKUs meet all seven pilot criteria._


---

## Blocked products (25)

- **OAS-AS-BKL-0001** — Cashew Kitta
- **OAS-AS-BKL-0002** — Square Baklawa
- **OAS-AS-BKL-0003** — Cashew Ring
- **OAS-AS-BKL-0004** — Cashew Rosebud
- **OAS-AS-BKL-0005** — Almond Crosole
- **OAS-AS-BKL-0006** — Cashew Pyramid
- **OAS-AS-BKL-0007** — Cashew Finger
- **OAS-AS-BKL-0008** — Date Baklawa
- **OAS-AS-BKL-0009** — Special Square Baklawa
- **OAS-AS-BKL-0010** — Pistachio Ring
- **OAS-AS-BKL-0011** — Pistachio Pyramid(Topping)
- **OAS-AS-BKL-0012** — Chocolate Pistachio Asiyah
- **OAS-AS-BKL-0013** — Chocolate Cashew Asiyah
- **OAS-AS-BKL-0014** — Mor Cashew Asiyah
- **OAS-AS-BKL-0015** — Mor Pistachio Asiyah
- **OAS-AS-BKL-0016** — Pistachio Asiyah
- **OAS-AS-BKL-0017** — Cashew Asiyah
- **OAS-AS-BKL-0018** — Diamond Pistachio
- **OAS-AS-BKL-0019** — Pistachio Pyramid
- **OAS-AS-BKL-0020** — Tart Cashew
- **OAS-AS-BKL-0021** — Mix Nut Tart
- **OAS-AS-BKL-0022** — Almond Tart
- **OAS-AS-BKL-0023** — Pistachio Tart
- **OAS-AS-BKL-0024** — Mor Pistachio Durum
- **OAS-AS-BKL-0025** — Coconut Durum

### Blocker breakdown

| Blocker | SKUs |
|---------|-----:|
| Missing image | 25 |
| Not visible in catalogue | 25 |
| Missing live aliases | 8 |
| Description unverified | 25 |
| Missing category | 0 |
| Missing pack / UOM | 0 |
| Invalid product URL | 0 |
| Resolver clarification / wrong match | 3 |

---

## Missing images (25)

All 25 Batch 001 SKUs lack `image_url` in the live snapshot. Buyer catalogue shows a placeholder package icon when absent.

- **OAS-AS-BKL-0001** — Cashew Kitta
- **OAS-AS-BKL-0002** — Square Baklawa
- **OAS-AS-BKL-0003** — Cashew Ring
- **OAS-AS-BKL-0004** — Cashew Rosebud
- **OAS-AS-BKL-0005** — Almond Crosole
- **OAS-AS-BKL-0006** — Cashew Pyramid
- **OAS-AS-BKL-0007** — Cashew Finger
- **OAS-AS-BKL-0008** — Date Baklawa
- **OAS-AS-BKL-0009** — Special Square Baklawa
- **OAS-AS-BKL-0010** — Pistachio Ring
- **OAS-AS-BKL-0011** — Pistachio Pyramid(Topping)
- **OAS-AS-BKL-0012** — Chocolate Pistachio Asiyah
- **OAS-AS-BKL-0013** — Chocolate Cashew Asiyah
- **OAS-AS-BKL-0014** — Mor Cashew Asiyah
- **OAS-AS-BKL-0015** — Mor Pistachio Asiyah
- **OAS-AS-BKL-0016** — Pistachio Asiyah
- **OAS-AS-BKL-0017** — Cashew Asiyah
- **OAS-AS-BKL-0018** — Diamond Pistachio
- **OAS-AS-BKL-0019** — Pistachio Pyramid
- **OAS-AS-BKL-0020** — Tart Cashew
- **OAS-AS-BKL-0021** — Mix Nut Tart
- **OAS-AS-BKL-0022** — Almond Tart
- **OAS-AS-BKL-0023** — Pistachio Tart
- **OAS-AS-BKL-0024** — Mor Pistachio Durum
- **OAS-AS-BKL-0025** — Coconut Durum

---

## Missing aliases (8)

These 8 SKU(s) have **zero live** `product_aliases` rows. Wave 2C language packs (4 terms per SKU, **32 total** across 8 SKUs) are prepared but **pending governed approval** — not counted as live coverage.

- **OAS-AS-BKL-0002** — Square Baklawa
- **OAS-AS-BKL-0004** — Cashew Rosebud
- **OAS-AS-BKL-0005** — Almond Crosole
- **OAS-AS-BKL-0006** — Cashew Pyramid
- **OAS-AS-BKL-0008** — Date Baklawa
- **OAS-AS-BKL-0009** — Special Square Baklawa
- **OAS-AS-BKL-0011** — Pistachio Pyramid(Topping)
- **OAS-AS-BKL-0018** — Diamond Pistachio

| SKU | Wave 2C status |
|-----|----------------|
| OAS-AS-BKL-0002 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0004 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0005 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0006 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0008 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0009 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0011 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |
| OAS-AS-BKL-0018 | Pending (4 SAFE_TO_APPROVE terms; 32 total across 8 SKUs) |

**Live alias coverage (17 / 25):** SKUs with live rows have 5–22 alias row(s) each.

---

## Missing descriptions (25)

The 2026-06-09 Central read-only audit **did not include** `products.description`. Anon/staff-unauthenticated REST probes return empty under RLS, so description presence cannot be confirmed without an authenticated staff read.

**Conservative pilot stance:** treat 25 SKU(s) as **description-unverified** until merchandising confirms copy.

- **OAS-AS-BKL-0001** — Cashew Kitta
- **OAS-AS-BKL-0002** — Square Baklawa
- **OAS-AS-BKL-0003** — Cashew Ring
- **OAS-AS-BKL-0004** — Cashew Rosebud
- **OAS-AS-BKL-0005** — Almond Crosole
- **OAS-AS-BKL-0006** — Cashew Pyramid
- **OAS-AS-BKL-0007** — Cashew Finger
- **OAS-AS-BKL-0008** — Date Baklawa
- **OAS-AS-BKL-0009** — Special Square Baklawa
- **OAS-AS-BKL-0010** — Pistachio Ring
- **OAS-AS-BKL-0011** — Pistachio Pyramid(Topping)
- **OAS-AS-BKL-0012** — Chocolate Pistachio Asiyah
- **OAS-AS-BKL-0013** — Chocolate Cashew Asiyah
- **OAS-AS-BKL-0014** — Mor Cashew Asiyah
- **OAS-AS-BKL-0015** — Mor Pistachio Asiyah
- **OAS-AS-BKL-0016** — Pistachio Asiyah
- **OAS-AS-BKL-0017** — Cashew Asiyah
- **OAS-AS-BKL-0018** — Diamond Pistachio
- **OAS-AS-BKL-0019** — Pistachio Pyramid
- **OAS-AS-BKL-0020** — Tart Cashew
- **OAS-AS-BKL-0021** — Mix Nut Tart
- **OAS-AS-BKL-0022** — Almond Tart
- **OAS-AS-BKL-0023** — Pistachio Tart
- **OAS-AS-BKL-0024** — Mor Pistachio Durum
- **OAS-AS-BKL-0025** — Coconut Durum

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

25 / 25 SKUs pass category check.

### 5. Pack sizes

| Pack | SKUs |
|------|-----:|
| 1kg | 9 |
| 3kg | 9 |
| 6kg | 7 |

25 / 25 SKUs have `pack_size` and `uom` in live snapshot.

### 6. Product URLs

25 / 25 deep links are structurally valid (require buyer auth before render):

| SKU | URL | Valid |
|-----|-----|:-----:|
| OAS-AS-BKL-0001 | https://b2b.oasisbaklawa.com/product/c7c0c5aa-1d2f-4088-88f1-1e5aacd321a0 | ✓ |
| OAS-AS-BKL-0002 | https://b2b.oasisbaklawa.com/product/89de33c7-e4c1-475e-b711-18258683fdec | ✓ |
| OAS-AS-BKL-0003 | https://b2b.oasisbaklawa.com/product/90e0f9df-d4dc-4ec5-8238-d7a2624e759a | ✓ |
| OAS-AS-BKL-0004 | https://b2b.oasisbaklawa.com/product/eb9c7a73-d1df-4bea-bdf1-209a5b386262 | ✓ |
| OAS-AS-BKL-0005 | https://b2b.oasisbaklawa.com/product/691f2fe6-2d25-4ce2-a9fd-d4b81ecb694b | ✓ |
| OAS-AS-BKL-0006 | https://b2b.oasisbaklawa.com/product/da4372b9-e1b3-4b17-bdd0-278bd636ab9a | ✓ |
| OAS-AS-BKL-0007 | https://b2b.oasisbaklawa.com/product/2390ea3d-19ba-43bb-8624-d6b033153c2f | ✓ |
| OAS-AS-BKL-0008 | https://b2b.oasisbaklawa.com/product/a6013e20-0fc7-4fe6-b2ab-f7f82d336b0c | ✓ |
| OAS-AS-BKL-0009 | https://b2b.oasisbaklawa.com/product/c522fa96-9247-4cf5-9699-a20bc316dc55 | ✓ |
| OAS-AS-BKL-0010 | https://b2b.oasisbaklawa.com/product/7d66f253-a179-4a33-b8ba-7b94ec783a3e | ✓ |
| OAS-AS-BKL-0011 | https://b2b.oasisbaklawa.com/product/2178c1c7-80c2-4ba3-a211-8643dcf57777 | ✓ |
| OAS-AS-BKL-0012 | https://b2b.oasisbaklawa.com/product/4baff7d1-bf58-4d0f-b842-c53f99caac61 | ✓ |
| OAS-AS-BKL-0013 | https://b2b.oasisbaklawa.com/product/c5e84d04-0d8b-4466-8690-a7e6267b44a8 | ✓ |
| OAS-AS-BKL-0014 | https://b2b.oasisbaklawa.com/product/4af95ba1-ff0f-4740-8869-6a19a41e8c83 | ✓ |
| OAS-AS-BKL-0015 | https://b2b.oasisbaklawa.com/product/73f91572-8844-4fa6-b267-56210d180468 | ✓ |
| OAS-AS-BKL-0016 | https://b2b.oasisbaklawa.com/product/f3f7a8fd-cea8-4ecb-a258-ef1ea86940b7 | ✓ |
| OAS-AS-BKL-0017 | https://b2b.oasisbaklawa.com/product/0cb6c64c-0529-4dfc-83cd-9b45ab7f9de6 | ✓ |
| OAS-AS-BKL-0018 | https://b2b.oasisbaklawa.com/product/2cab3d7f-7593-441e-a030-6ac6ad3ed9bc | ✓ |
| OAS-AS-BKL-0019 | https://b2b.oasisbaklawa.com/product/636b47cb-ea6f-4711-ae29-d6153e565ae3 | ✓ |
| OAS-AS-BKL-0020 | https://b2b.oasisbaklawa.com/product/b0aee1c4-4502-4a15-9880-e2c01378c0b5 | ✓ |
| OAS-AS-BKL-0021 | https://b2b.oasisbaklawa.com/product/6b258e44-69dc-465a-b82a-cbb72f68d723 | ✓ |
| OAS-AS-BKL-0022 | https://b2b.oasisbaklawa.com/product/8554f5d5-5e46-4ffe-b98a-0ed10ec522ae | ✓ |
| OAS-AS-BKL-0023 | https://b2b.oasisbaklawa.com/product/43a25d30-f7d9-426b-b5af-cae7d477468e | ✓ |
| OAS-AS-BKL-0024 | https://b2b.oasisbaklawa.com/product/cea65af8-129c-4838-988f-30955fa5bc22 | ✓ |
| OAS-AS-BKL-0025 | https://b2b.oasisbaklawa.com/product/f58e0a78-53a9-400b-8768-7af09b68ba38 | ✓ |

### 7. Search discoverability

| Check | Result |
|-------|--------|
| `visible_in_catalog = true` | 0 / 25 |
| Buyer `useProducts` filter (`is_active` + `visible_in_catalog`) | Hidden SKUs excluded when promoted |
| Resolver primary-alias pass rate | 22 / 25 (88%) — 0009, 0014, 0015 need clarification |

---

## Per-SKU matrix

| SKU | Product | Image | Live aliases | Description | Category | Pack | URL | Search visible | Pilot ready |
|-----|---------|:-----:|:------------:|:-----------:|:--------:|:----:|:---:|:--------------:|:-----------:|
| OAS-AS-BKL-0001 | Cashew Kitta | ✗ | 12 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0002 | Square Baklawa | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0003 | Cashew Ring | ✗ | 9 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0004 | Cashew Rosebud | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0005 | Almond Crosole | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0006 | Cashew Pyramid | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0007 | Cashew Finger | ✗ | 11 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0008 | Date Baklawa | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0009 | Special Square Baklawa | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0010 | Pistachio Ring | ✗ | 9 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | ✗ | 9 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | ✗ | 20 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | ✗ | 22 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | ✗ | 11 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0016 | Pistachio Asiyah | ✗ | 7 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0017 | Cashew Asiyah | ✗ | 8 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0018 | Diamond Pistachio | ✗ | 0† | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0019 | Pistachio Pyramid | ✗ | 9 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0020 | Tart Cashew | ✗ | 19 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0021 | Mix Nut Tart | ✗ | 8 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0022 | Almond Tart | ✗ | 9 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0023 | Pistachio Tart | ✗ | 5 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0024 | Mor Pistachio Durum | ✗ | 21 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |
| OAS-AS-BKL-0025 | Coconut Durum | ✗ | 12 | ? | ✓ | ✓ | ✓ | ✗ | ✗ |

† Wave 2C alias pack pending approval (not live).

---

## Near-ready shortlist (15)

SKUs with live aliases and resolver pass; blocked only on **image**, **visibility**, and **description verification**:

- **OAS-AS-BKL-0001** — Cashew Kitta
- **OAS-AS-BKL-0003** — Cashew Ring
- **OAS-AS-BKL-0007** — Cashew Finger
- **OAS-AS-BKL-0010** — Pistachio Ring
- **OAS-AS-BKL-0012** — Chocolate Pistachio Asiyah
- **OAS-AS-BKL-0013** — Chocolate Cashew Asiyah
- **OAS-AS-BKL-0016** — Pistachio Asiyah
- **OAS-AS-BKL-0017** — Cashew Asiyah
- **OAS-AS-BKL-0019** — Pistachio Pyramid
- **OAS-AS-BKL-0020** — Tart Cashew
- **OAS-AS-BKL-0021** — Mix Nut Tart
- **OAS-AS-BKL-0022** — Almond Tart
- **OAS-AS-BKL-0023** — Pistachio Tart
- **OAS-AS-BKL-0024** — Mor Pistachio Durum
- **OAS-AS-BKL-0025** — Coconut Durum

---

## Recommended promotion sequence (no action taken in this audit)

1. **Approve Wave 2C alias drafts** — closes live alias gap for 8 SKU(s) (32 terms total, 4 per SKU)
2. **Upload product images** — 25 SKU(s) missing `image_url`
3. **Write/verify buyer descriptions** — 25 SKU(s) need `products.description` confirmation
4. **Flip `visible_in_catalog`** — 25 SKU(s) when media, aliases, and copy are complete
5. **Resolver hardening** — 3 SKU(s): OAS-AS-BKL-0009, OAS-AS-BKL-0014, OAS-AS-BKL-0015

---

## Evidence

- `src/lib/language-wave/batch001Manifest.ts` — SKU authority + product UUIDs
- `src/lib/language-wave/catalogueHealth.ts` — `BATCH001_LIVE_HEALTH_SNAPSHOT`
- `src/lib/language-wave/wave2cPack.ts` — Wave 2C term proposals
- `docs/evidence/batch-001/language-coverage.json` — historical snapshot
- `docs/evidence/batch-001/resolver-coverage.json` — historical snapshot
- `docs/BATCH001_CATALOGUE_HEALTH_REPORT.md`
- `docs/BATCH001_LANGUAGE_COMPLETION_REPORT.md`

---

*Read-only audit. No SQL, migrations, production writes, or approvals were performed.*
