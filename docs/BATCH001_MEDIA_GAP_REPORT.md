# Batch 001 Media Gap Report

**Generated:** 2026-06-12  
**Source:** `BATCH001_LIVE_HEALTH_SNAPSHOT.has_image` (maps to `products.image_url` presence)

## Summary

| Gap type | Count | % of batch |
|----------|------:|-----------:|
| Missing `image_url` | 25 | 100% |
| Using UI placeholder (no image) | 25 | 100% |
| Missing thumbnail (no separate thumb field — same as image) | 25 | 100% |

**Media readiness:** 0%

Buyer catalogue (`CatalogueProductCard`) renders a package icon when `image_url` is null — all Batch 001 SKUs currently fall into this path.

## Missing image_url

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

## Placeholder / thumbnail gaps

| SKU | Product | image_url | placeholder UI | thumbnail |
|-----|---------|:---------:|:--------------:|:---------:|
| OAS-AS-BKL-0001 | Cashew Kitta | missing | yes | missing |
| OAS-AS-BKL-0002 | Square Baklawa | missing | yes | missing |
| OAS-AS-BKL-0003 | Cashew Ring | missing | yes | missing |
| OAS-AS-BKL-0004 | Cashew Rosebud | missing | yes | missing |
| OAS-AS-BKL-0005 | Almond Crosole | missing | yes | missing |
| OAS-AS-BKL-0006 | Cashew Pyramid | missing | yes | missing |
| OAS-AS-BKL-0007 | Cashew Finger | missing | yes | missing |
| OAS-AS-BKL-0008 | Date Baklawa | missing | yes | missing |
| OAS-AS-BKL-0009 | Special Square Baklawa | missing | yes | missing |
| OAS-AS-BKL-0010 | Pistachio Ring | missing | yes | missing |
| OAS-AS-BKL-0011 | Pistachio Pyramid(Topping) | missing | yes | missing |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah | missing | yes | missing |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah | missing | yes | missing |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah | missing | yes | missing |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah | missing | yes | missing |
| OAS-AS-BKL-0016 | Pistachio Asiyah | missing | yes | missing |
| OAS-AS-BKL-0017 | Cashew Asiyah | missing | yes | missing |
| OAS-AS-BKL-0018 | Diamond Pistachio | missing | yes | missing |
| OAS-AS-BKL-0019 | Pistachio Pyramid | missing | yes | missing |
| OAS-AS-BKL-0020 | Tart Cashew | missing | yes | missing |
| OAS-AS-BKL-0021 | Mix Nut Tart | missing | yes | missing |
| OAS-AS-BKL-0022 | Almond Tart | missing | yes | missing |
| OAS-AS-BKL-0023 | Pistachio Tart | missing | yes | missing |
| OAS-AS-BKL-0024 | Mor Pistachio Durum | missing | yes | missing |
| OAS-AS-BKL-0025 | Coconut Durum | missing | yes | missing |

## Owner actions (draft — not executed)

1. Merchandising uploads hero image per SKU to approved storage
2. Set `products.image_url` via governed catalogue connector (not in this wave)
3. Re-run this report after media import

---

*Read-only audit.*
