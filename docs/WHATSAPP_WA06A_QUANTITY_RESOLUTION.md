# WhatsApp WA-06A — Quantity resolution engine (read-only suggestions)

**PR:** WA-06A — Quantity Resolution Engine (Read-Only Suggestions)  
**Date:** 2026-06-03

---

## Summary

Operator inbox now shows **read-only quantity resolution suggestions** for the selected packet. The engine extracts **likely order quantities** from message content. **No mutations** and **no database reads** are performed.

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
| Resolver | `src/lib/wa-governance/fetchQuantityResolution.ts` |
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
- Pure message parsing — suggestions are **not persisted**

---

*End of WA-06A architecture note.*
