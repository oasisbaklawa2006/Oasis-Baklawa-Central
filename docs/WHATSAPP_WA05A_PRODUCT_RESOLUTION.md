# WhatsApp WA-05A — Product resolution engine (read-only suggestions)

**PR:** WA-05A — Product Resolution Engine (Read-Only Suggestions)  
**Date:** 2026-06-03

---

## Summary

Operator inbox now shows **read-only product resolution suggestions** for the selected packet. The engine infers **likely catalog products** from message content and read-only lookups against the Central product master. **No mutations** are performed.

---

## Resolver architecture

```
Selected packet
  → Sender identity (WA-03A)
  → Client resolution (WA-04A)
  → extractProductResolutionTextSignals()
  → read-only SELECT queries (products, product_aliases)
  → scoreProductResolutionCandidates()
  → OperatorInboxProductResolutionPanel
```

| Layer | File |
|-------|------|
| Types | `src/lib/wa-governance/productResolutionTypes.ts` |
| Text signals | `src/lib/wa-governance/productResolutionSignals.ts` |
| Scoring | `src/lib/wa-governance/productResolutionScoring.ts` |
| Read-only queries | `src/lib/wa-governance/fetchProductResolution.ts` |
| Display | `src/lib/wa-governance/productResolutionDisplay.ts` |
| Request key / cache | `src/lib/wa-governance/productResolutionRequestKey.ts`, `productResolutionResultCache.ts` |
| Hook | `src/components/whatsapp/useOperatorInboxProductResolution.ts` |
| UI | `src/components/whatsapp/OperatorInboxProductResolutionPanel.tsx` |

---

## Data sources audited (read-only)

| Source | Use |
|--------|-----|
| `products` | Authoritative catalog — `name`, `sku`, `aliases[]`, `pack_size`, weight fields, `category`, `sub_category` |
| `product_aliases` | Alias → canonical name / `product_id` |

**Not queried for identity:** `product_variants` (v1 uses parent product rows only), inventory tables, operational scan barcodes.

---

## Matching signals & weights

| Signal | Weight |
|--------|--------|
| Exact product name in message | 0.80 |
| Product alias (`product_aliases` or `products.aliases[]`) | 0.45 |
| Weight match (grams / pack label) | 0.35 |
| Piece count match | 0.30 |
| Pack format match (tin, carton, box, tray, acrylic) | 0.25 |
| Catalog keyword match | 0.18 |

Scores are summed (capped at 0.98) and shown as **confidence %**.

---

## Confidence bands

| Band | Threshold | UI |
|------|-----------|-----|
| Auto-highlight | ≥ 95% | Emerald badge |
| Suggested | 70–94% | Blue badge |
| Needs clarification | < 70% | Amber badge |

---

## Request-key architecture (WA-04A pattern)

Immutable request key:

```
packetId | contentFingerprint | clientResolutionBestMatch | identitySegment
```

- **No** dependency on `selectedPacket` object reference
- State carries `requestKey`; UI only renders when keys match
- Successful resolutions cached by key; loading/error never cached
- Upstream waits for sender identity + client resolution (ready or error) before fetch

---

## UI location

**Route:** `/admin/operator-inbox` or `/admin/whatsapp`  
**Panel:** Selected packet header → below **Client resolution** → **Product resolution**

Shows likely product, SKU, confidence, why matched, and up to 3 alternatives. Label: **read-only · not persisted**.

---

## Hard rules compliance

- No migrations, Edge functions, ownership writes, order/draft/quotation/PI creation, inventory reservation, outbound WhatsApp, or audit persistence
- Runtime resolution only — SELECT queries through PostgREST client

---

## Known limitations

1. **Bounded query fan-out** — up to ~6 name candidates × selective ILIKE queries per packet select.
2. **No variant-level SKU split** — variant rows not scored separately in v1.
3. **Client context is key-only** — resolved client company does not yet narrow catalog search (future WA-05B scope).
4. **Sales/catalog RLS** — visible products depend on authenticated operator RLS.

---

*End of WA-05A note.*
