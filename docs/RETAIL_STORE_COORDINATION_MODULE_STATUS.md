# Retail store coordination module — status

Last updated: 2026-05-24 (B1 + B2 + B5 slice)

## Shipped in tree

### B1 — Route shell

- **Route:** `/admin/store-coordination`
- **Access:** Inherits admin `RoleProtectedRoute` + `ADMIN_STAFF_ROLES`; sidebar uses `moduleKey: "orders"` so roles with order-pipeline access see **Store coordination**.
- **UX:** Mobile-first layout, sticky action bar, CMD-safe spacing.

### B2 — Visibility & queue shells (read-only)

- **Stock visibility cards** for eight named outlets (South Extension, Paschim Vihar, Kamla Nagar, Ashok Vihar, Mall of India Noida, Select City Walk, Amritsar, Srinagar). **No live quantities** — every card states integration pending and manual verification.
- **Reservation / prebooking queue** — table + mobile cards with explicit **“Reservation capture is not active yet”** banner; placeholder row only (no persistence, no deduction).
- **Factory follow-up queue** — table + mobile cards; **integration pending** copy; manual phone/WhatsApp until backend exists.
- **Inter-store / retail alerts / wedding–bulk** — compact placeholder cards (integration pending).

### B5 — Operational event projections

- **Kinds** (`RetailOperationalEventKind` in `types.ts`): `store.stock_visible`, `store.stock_unknown`, `store.reservation_requested`, `store.pickup_pending`, `store.factory_followup_needed`, `store.prebooking_pending`, `store.delay_warning`.
- **Source:** `derived_store_coordination`
- **Builder:** `buildStoreCoordinationOperationalFeed` + `normalizeStoreCoordinationEvents` in `storeFeed.ts` — **pure**, no network, **no `occurredAt` fabrication** (snapshot rows use `null`).
- **UI:** `OperationalTimeline` on the store coordination page with standard category filters.

### Tests

- `src/lib/operational-events/__tests__/store-feed.test.ts` — deterministic ids, null timestamps, default outlets, reservation/factory placeholder emissions.

## What is **not** real yet

- Live stock / ready-goods / per-SKU inventory feeds  
- Reservation persistence or stock deduction  
- Factory follow-up persistence or production writes  
- Any automation from this module  

## Safety invariants

- No inventory writes, no auto-reallocation, no Edge/migration/package churn for this slice.
- No `functions.invoke`, no new DB writes from these files.

## Verification

- `npm run typecheck`
- `npm run build`
- `npm run test -- --run src/lib/operational-events/__tests__/`
