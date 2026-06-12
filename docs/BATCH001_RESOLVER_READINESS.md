# Batch 001 Resolver Readiness

**Generated:** 2026-06-12  
**Engine:** `resolveProductIntelligence()` via `runResolverCoverage()`  
**Pass rate:** 88% (22 / 25)

## PASS vs CLARIFY

| Status | Count | SKUs |
|--------|------:|------|
| PASS | 22 | 0001, 0002, 0003, 0004, 0005, 0006, 0007, 0008, 0010, 0011, 0012, 0013, 0016, 0017, 0018, 0019, 0020, 0021, 0022, 0023, 0024, 0025 |
| CLARIFY | 3 | 0009, 0014, 0015 |

## Highlighted ambiguous SKUs

### OAS-AS-BKL-0009 — Special Square Baklawa

- **Resolver:** CLARIFY (clarification_required)
- **Primary utterance tested:** Special Square Baklawa
- **Best match productId:** 89de33c7-e4c1-475e-b711-18258683fdec
- **Live alias collisions:** none in collision index

### OAS-AS-BKL-0014 — Mor Cashew Asiyah

- **Resolver:** CLARIFY (clarification_required)
- **Primary utterance tested:** Mor Cashew Asiyah Lebanese Baklava
- **Best match productId:** 4af95ba1-ff0f-4740-8869-6a19a41e8c83
- **Live alias collisions:** cashew assiyah, cashew high gap baklawa, cashew high jump baklawa

### OAS-AS-BKL-0015 — Mor Pistachio Asiyah

- **Resolver:** CLARIFY (clarification_required)
- **Primary utterance tested:** Mor Pistachio Asiyah Lebanese Baklava
- **Best match productId:** 73f91572-8844-4fa6-b267-56210d180468
- **Live alias collisions:** none in collision index

## Live cross-SKU collision terms

| Term | SKUs |
|------|------|
| cashew assiyah | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| cashew high gap baklawa | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |
| cashew high jump baklawa | OAS-AS-BKL-0013, OAS-AS-BKL-0014 |

## Full resolver matrix

| SKU | Utterance | PASS/CLARIFY | Confidence | clarification_required |
|-----|-----------|:------------:|:----------:|:----------------------:|
| OAS-AS-BKL-0001 | Cashew Kitta Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0002 | Square Baklawa | PASS | 94 | no |
| OAS-AS-BKL-0003 | Cashew Ring Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0004 | Cashew Rosebud | PASS | 94 | no |
| OAS-AS-BKL-0005 | Almond Crosole | PASS | 94 | no |
| OAS-AS-BKL-0006 | Cashew Pyramid | PASS | 94 | no |
| OAS-AS-BKL-0007 | Cashew Finger Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0008 | Date Baklawa | PASS | 94 | no |
| OAS-AS-BKL-0009 | Special Square Baklawa | CLARIFY | 94 | yes |
| OAS-AS-BKL-0010 | Pistachio Ring Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0011 | Pistachio Pyramid Topping | PASS | 94 | no |
| OAS-AS-BKL-0012 | Chocolate Pistachio Asiyah Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0013 | Chocolate Cashew Asiyah Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah Lebanese Baklava | CLARIFY | 94 | yes |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah Lebanese Baklava | CLARIFY | 94 | yes |
| OAS-AS-BKL-0016 | Pistachio Asiyah Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0017 | Cashew Asiyah Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0018 | Diamond Pistachio | PASS | 94 | no |
| OAS-AS-BKL-0019 | Pistachio Pyramid Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0020 | Tart Cashew Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0021 | Mix Nut Tart Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0022 | Almond Tart Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0023 | Pistachio Tart Lebanese Baklava | PASS | 94 | no |
| OAS-AS-BKL-0024 | Mor Pistachio Durum Turkish Baklava | PASS | 94 | no |
| OAS-AS-BKL-0025 | Coconut Durum Turkish Baklava | PASS | 94 | no |

---

*Read-only simulation — not live WhatsApp traffic.*
