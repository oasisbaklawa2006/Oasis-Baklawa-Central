# Inventory / ready goods visibility — status

Last updated: 2026-05-20 (read-only visibility foundation)

## Purpose

Expose **honest, read-only** inventory / ready-goods signals for retail store coordination. **No stock mutation**, no reservation persistence, no `functions.invoke`, no Edge changes, and no migrations for this slice.

## What exists in the database (discovered in code / types)

| Artifact | Role | Safe for this sprint? |
|----------|------|------------------------|
| `factory_inventory` | Per-SKU factory-side quantity (`quantity`, `last_updated`, `product_id`) | **Yes** for a **factory snapshot** only — not branch shelf stock |
| `products` | SKU metadata including `default_store` (string) | **Yes** as a **best-effort** grouping key toward named outlets |
| `inventory_items` | Alternate stock representation in other modules | Not wired here; reserved for a future pass if product agrees |
| `order_items` | Dispatch / packing progress | Used elsewhere (e.g. Ready Goods TV); **not** authoritative shelf inventory |
| `inventory_adjustments` | Write-oriented history | **Not** used (no reads required for this foundation) |

## What is “real” today

- **Real read:** `factory_inventory` joined to `products` on the Store coordination page (`StoreCoordination.tsx`) via a **single `select`** — no `.insert` / `.update` / `.delete` / `.rpc`.
- **Real pure logic:** `src/lib/inventory/readyGoodsVisibility.ts` normalizes rows, groups by outlet label, derives per-outlet **confidence** (unknown / partial / verified_numeric / manual_verification_required), and builds a summary. **Null quantities stay unknown** — never coerced to zero for display confidence.
- **Operational projections:** `InventoryOperationalEventKind` + `buildInventoryOperationalFeed` in `src/lib/operational-events/inventoryFeed.ts` — merged into the store coordination timeline with `mergeOperationalEventFeeds`.

## What is **not** real yet

- **Per-outlet shelf stock** — `default_store` is not a verified POS feed; unmatched SKUs land in `Factory snapshot · outlet not linked`.
- **Barcode / label truth loop** — scanning, carton IDs, and store receiving confirmations are **out of scope** for this branch; they are the natural **next step** after outlet-level feeds are defined.
- **Reservation persistence** and **factory follow-up persistence** — explicitly still placeholders on the coordination page.

## CMD pulse (optional)

`CmdOperationalCommPulse` shows a **read-only head count** on `factory_inventory` plus static copy that branch shelf truth remains **pending / manual verification**. No automation.

## Invariants (guardrails)

- No DB writes from inventory / inventory-feed / store coordination inventory wiring.
- No stock deduction and no reservation persistence.
- No new `functions.invoke` from these surfaces.

## Tests

- `src/lib/inventory/__tests__/readyGoodsVisibility.test.ts`
- `src/lib/operational-events/__tests__/inventory-feed.test.ts`

## Next step (barcode / label flow)

1. Define canonical **store + SKU** identity (barcode or internal packing id).
2. Add a **read-only** receiving or stock-on-hand table **or** a documented view — only after product sign-off (may require migrations in a later branch).
3. Map scans to `DEFAULT_RETAIL_OUTLETS` (or a DB-backed directory) so cards reflect **shelf** confidence, not only `factory_inventory`.
