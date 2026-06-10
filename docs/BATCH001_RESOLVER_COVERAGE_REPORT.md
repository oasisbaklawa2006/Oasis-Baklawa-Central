# Batch 001 Resolver Coverage Report

**Date:** 2026-06-09  
**Resolver:** `resolveProductIntelligence()` (`src/lib/product-intelligence/`)  
**Catalog:** Batch 001 manifest + Wave 2C drafts + primary alias simulation

---

## Summary

| Metric | Value |
|--------|-------|
| SKUs tested | 25 |
| Auto-resolve (primary alias utterance) | **22 / 25 (88%)** |
| Clarification required | 3 |
| Wrong SKU returned | 1 (0009 → 0002) |

---

## Pass matrix (22 SKUs)

All SKUs except the three below resolve with `clarification_required = false` and correct `productId` when tested with distinctive primary aliases.

---

## Known failures (3 SKUs)

| SKU | Utterance | Best match | Issue |
|-----|-----------|------------|-------|
| OAS-AS-BKL-0009 | Special Square Baklawa | Square Baklawa (0002) | Substring name collision with 0002 |
| OAS-AS-BKL-0014 | Mor Cashew Asiyah Lebanese Baklava | Mor Cashew Asiyah (correct) | Clarification — 94% tie with Cashew Asiyah |
| OAS-AS-BKL-0015 | Mor Pistachio Asiyah Lebanese Baklava | Mor Pistachio Asiyah (correct) | Clarification — 94% tie with Pistachio Asiyah |

---

## WhatsApp keyword coverage (shorter utterances)

| SKU | WhatsApp keyword | Resolves? |
|-----|------------------|-----------|
| Most SKUs | e.g. `cashew kitta`, `mix nut tart` | Yes |
| 0009, 0014, 0015 | Short keywords | Clarification or wrong SKU |

**WhatsApp readiness implication:** Operators must use distinguishing language for Asiyah family and Square/Special Square variants until resolver substring policy is unified (see `PRODUCT_RESOLUTION_ALIGNMENT_AUDIT.md`).

---

## Recommendations

1. **Wave 3 resolver hardening:** Prefer longest whole-phrase alias; penalize substring-only name matches
2. **Collision cleanup:** Remove duplicate `cashew assiyah` cross-SKU aliases (governed)
3. **Golden utterance suite:** Add `src/lib/language-wave/__tests__/` parity tests vs WA-05A before inbox merge

---

## Evidence

- `docs/evidence/batch-001/resolver-coverage.json`
- Tests: `src/lib/language-wave/__tests__/languageWave.test.ts`
