# Retail store coordination module — status

Last updated: 2026-05-20 (B1 + B2 + B5 + read-only inventory visibility)

## Shipped in tree

### B1 — Route shell

- **Route:** `/admin/store-coordination`
- **Access:** Inherits admin `RoleProtectedRoute` + `ADMIN_STAFF_ROLES`; sidebar uses `moduleKey: "orders"` so roles with order-pipeline access see **Store coordination**.
- **UX:** Mobile-first layout, sticky action bar, CMD-safe spacing.

### B2 — Visibility & queue shells (read-only)

- **Ready goods visibility** — read-only `factory_inventory` + `products` snapshot; explicit **not shelf stock** labeling; null quantities remain **unknown**.
- **Outlet snapshot cards** — driven by `deriveStoreStockConfidence` / `buildInventoryVisibilitySummary` (`readyGoodsVisibility.ts`); integration-pending / manual verification when the query is empty or fails.
- **Reservation / prebooking queue** — table + mobile cards with explicit **“Reservation capture is not active yet”** banner; placeholder row only (no persistence, no deduction).
- **Factory follow-up queue** — table + mobile cards; **integration pending** copy; manual phone/WhatsApp until backend exists.
- **Inter-store / retail alerts / wedding–bulk** — compact placeholder cards (integration pending).

### B5 — Operational event projections

- **Kinds** (`RetailOperationalEventKind` in `types.ts`): `store.stock_visible`, `store.stock_unknown`, `store.reservation_requested`, `store.pickup_pending`, `store.factory_followup_needed`, `store.prebooking_pending`, `store.delay_warning`.
- **Inventory kinds** (`InventoryOperationalEventKind`): `inventory.visibility_available`, `inventory.visibility_unknown`, `inventory.low_stock_warning`, `inventory.ready_goods_pending`, `inventory.manual_verification_required`.
- **Sources:** `derived_store_coordination`, `derived_inventory_visibility`
- **Builders:** `buildStoreCoordinationOperationalFeed` + `buildInventoryOperationalFeed` + `mergeOperationalEventFeeds` — **pure** merge path for projections; snapshot rows use `occurredAt: null`.
- **UI:** `OperationalTimeline` on the store coordination page with standard category filters.

### Tests

- `src/lib/operational-events/__tests__/store-feed.test.ts` — deterministic ids, null timestamps, default outlets, reservation/factory placeholder emissions, suppress flag for duplicate stock-unknown placeholders when inventory feed is active.
- `src/lib/inventory/__tests__/readyGoodsVisibility.test.ts` — unknown qty, grouping, confidence.
- `src/lib/operational-events/__tests__/inventory-feed.test.ts` — inventory event kinds and severities.

## What is **not** real yet

- True **per-outlet shelf** quantities (POS / barcode receiving loop)
- Reservation persistence or stock deduction
- Factory follow-up persistence or production writes
- Any automation from this module

## Safety invariants

- No inventory writes, no auto-reallocation, no Edge/migration/package churn for this slice.
- No `functions.invoke`, no new DB writes from these files.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run test -- --run src/lib/operational-events/__tests__/ src/lib/inventory/__tests__/`
