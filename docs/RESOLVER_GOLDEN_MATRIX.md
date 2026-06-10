# Resolver Golden Utterance Matrix

**Date:** 2026-06-09  
**Program:** Resolver Unification Wave — Workstream B  
**Source of truth:** `src/lib/resolver-golden/goldenUtteranceMatrix.ts`

---

## Summary

| Metric | Value |
|--------|-------|
| **Total cases** | **111** |
| Expected resolve | 78 |
| Expected clarify | 29 |
| Expected no_match | 4 |

### By category

| Category | Count | Purpose |
|----------|-------|---------|
| `batch001_specific` | 50 | One official + one WhatsApp utterance per Batch 001 SKU |
| `batch001_quantity` | 15 | Quantity-first requests (`Need 2 kg …`) |
| `ambiguous_family` | 12 | Asiyah, Baklava, Pyramid, Ring, Tart, Square families |
| `generic_only` | 9 | Bare family terms + one non-generic counterexample |
| `multilingual` | 10 | Kaju, Pista, Badam, Khajoor, Nariyal colloquial terms |
| `typo_tolerance` | 8 | Kita, piramed, crosole, almand, phonetic variants |
| `search_fallback` | 3 | SKU search, category browse, partial name |
| `negative` | 4 | Greetings, empty, unknown product |

---

## Usage

### Parity test (future PR)

```typescript
import { GOLDEN_UTTERANCE_MATRIX } from "@/lib/resolver-golden";
import { resolveProductIntelligence } from "@/lib/product-intelligence";
import { fetchProductResolution } from "@/lib/wa-governance/fetchProductResolution";

for (const row of GOLDEN_UTTERANCE_MATRIX) {
  const pi = resolveProductIntelligence(catalog, row.utterance);
  const wa = await fetchProductResolution(supabase, { messageText: row.utterance });
  // assert pi and wa agree on resolve vs clarify
}
```

### Validation today

```bash
npm run test -- src/lib/resolver-golden
```

---

## Representative cases

### Batch 001 — specific resolve

| ID | Utterance | Expected SKU |
|----|-----------|--------------|
| b001-OAS-AS-BKL-0001-wa | cashew kitta | OAS-AS-BKL-0001 |
| b001-OAS-AS-BKL-0014-wa | mor cashew asiyah lebanese baklava | OAS-AS-BKL-0014 (clarify — substring tie) |
| b001-OAS-AS-BKL-0019-wa | pistachio pyramid | OAS-AS-BKL-0019 |
| qty-001 | Need 2 kg Kitta | OAS-AS-BKL-0001 |

### Ambiguous — must clarify

| ID | Utterance | Notes |
|----|-----------|-------|
| amb-asiyah | Need Asiyah | 6+ Asiyah SKUs |
| amb-baklava | Need Baklava | Generic family |
| amb-pyramid | Need Pyramid | 0006, 0011, 0019 |
| amb-cashew-assiyah | cashew assiyah | Live alias collision 0013/0014 |
| amb-square | square baklawa | 0002 vs 0009 |

### Multilingual

| ID | Utterance | Expected SKU |
|----|-----------|--------------|
| ml-kaju-kitta | Kaju Kitta | OAS-AS-BKL-0001 |
| ml-pista-pyramid | Pista Pyramid | OAS-AS-BKL-0019 |
| ml-nariyal-durum | Nariyal Durum | OAS-AS-BKL-0025 |

### Typo tolerance

| ID | Utterance | Expected |
|----|-----------|----------|
| typo-kita | Kita | resolve → 0001 |
| typo-piramed | piramed | clarify (unsafe live alias) |
| typo-crosole | crosole | clarify (wrong canonical) |

### Negative

| ID | Utterance | Expected |
|----|-----------|----------|
| neg-greeting | Good morning | no_match |
| neg-unknown | XYZ Unknown Product 999 | no_match |

---

## Full matrix

The complete 111-row matrix is maintained in code to prevent doc drift:

- **File:** `src/lib/resolver-golden/goldenUtteranceMatrix.ts`
- **Export:** `GOLDEN_UTTERANCE_MATRIX`
- **Stats:** `goldenMatrixStats()`

Do not duplicate the full table in markdown — regenerate stats from code when auditing.

---

## Acceptance criteria for unified resolver

| Criterion | Target |
|-----------|--------|
| Resolve cases passing | ≥ 95% (74/78) after collision remediation |
| Clarify cases correct | 100% (29/29) — never silent auto-resolve |
| No_match cases | 100% (4/4) |
| PI/WA parity on matrix | ≥ 90% agreement on resolve vs clarify |
