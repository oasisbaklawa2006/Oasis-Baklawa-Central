# WhatsApp WA-06A — Quantity resolution engine (read-only suggestions)

**PR:** WA-06A — Quantity Resolution Engine (Read-Only Suggestions)  
**Date:** 2026-06-03

---

## Summary

Operator inbox now shows **read-only quantity resolution suggestions** for the selected packet. The engine extracts **likely order quantities** from message content and optionally normalizes them using **authoritative catalogue fields** when product resolution provides a match. **No mutations** are performed.

---

## Resolver architecture

```
Selected packet
  → Sender identity (WA-03A)
  → Client resolution (WA-04A)
  → Product resolution (WA-05A)
  → extractQuantityResolutionTextSignals()
  → scoreQuantityResolutionCandidates()
  → OperatorInboxQuantityResolutionPanel
```

| Layer | File |
|-------|------|
| Types | `src/lib/wa-governance/quantityResolutionTypes.ts` |
| Text signals | `src/lib/wa-governance/quantityResolutionSignals.ts` |
| Scoring | `src/lib/wa-governance/quantityResolutionScoring.ts` |
| Resolver | `src/lib/wa-governance/fetchQuantityResolution.ts`, `quantityResolutionNormalize.ts` |
| Display | `src/lib/wa-governance/quantityResolutionDisplay.ts` |
| Request key / cache | `src/lib/wa-governance/quantityResolutionRequestKey.ts`, `quantityResolutionResultCache.ts` |
| Hook | `src/components/whatsapp/useOperatorInboxQuantityResolution.ts` |
| UI | `src/components/whatsapp/OperatorInboxQuantityResolutionPanel.tsx` |

---

## Recognized units

| Category | Units |
|----------|-------|
| Pack | boxes, tins, trays, pcs/pieces, cartons, cases, packs, units |
| Weight | kg, gm |
| Word quantities | dozen, half dozen, pair |

---

## Scoring & confidence bands

| Signal kind | Weight | Typical band |
|-------------|--------|--------------|
| Explicit quantity + unit | 0.98 | Auto-highlight (≥95%) |
| Explicit quantity only | 0.78 | Suggested (70–94%) |
| Word quantity (dozen, pair, …) | 0.62 | Needs clarification (<70%) |

| Band | Threshold | UI |
|------|-----------|-----|
| Auto-highlight | ≥ 95% | Emerald badge |
| Suggested | 70–94% | Blue badge |
| Needs clarification | < 70% | Amber badge |

---

## Request-key architecture (WA-05A pattern)

Immutable request key:

```
packetId | contentFingerprint | clientResolutionBestMatch | productResolutionBestMatch | identitySegment
```

- Effect depends on **`requestKey` only**
- Success-only in-memory cache
- `projectQuantityResolutionDisplayState()` prevents stale packet display

---

## Data sources audited (read-only)

| Source | Use |
|--------|-----|
| `products` (optional SELECT) | Catalogue normalization only — `weight_per_box_kg`, `grams_per_piece`, `packs_per_master_carton`, `pcs_per_master_carton`, `uom`, `settlement_unit` |

When product resolution provides a best match, WA-06A reuses:

- `convertToKgFromCatalogue()` from `src/lib/unit-conversion.ts` (catalogue fields only — no bulk defaults)
- `getProductCategory()` from `src/utils/pricing.ts` for carton inner-unit selection

If no catalogue conversion exists, entries keep raw parsed quantity with `conversionStatus: "unknown"`.

Resolved payload shape:

```json
{
  "rawQuantity": 50,
  "rawUnit": "tins",
  "normalizedQuantity": 300,
  "normalizedUnit": "kg",
  "conversionSource": "products.weight_per_box_kg",
  "conversionStatus": "resolved"
}
```

---

## Regression guards

Excluded from quantity extraction:

- Phone numbers (`9876543210`, `+91…`)
- GSTIN strings
- Order references (`SO-12345`, `ORD-…`)
- Client code numeric spans

Dedupe prevents the same quantity block from scoring twice.

---

## Read-only posture

- No `.insert`, `.update`, `.upsert`, `.delete`, or `.rpc`
- No migrations or Edge functions
- Optional SELECT on `products` for catalogue normalization when a product match exists
- Suggestions are **not persisted**

---

*End of WA-06A architecture note.*
