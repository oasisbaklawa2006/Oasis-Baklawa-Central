# Phase A Handoff: Inventory Command Center

Status: **DRAFT — pending backend sign-off** (not eligible for sign-off; see §Unresolved gaps)

Route: `/admin/inventory-command-center`  
Disposition: SIMPLIFY (`docs/frontend/APPVERSE_ROUTE_DISPOSITION_MATRIX.md`)  
Module key: `inventory` (`src/lib/appverse/roleAccess.ts`, `src/lib/appverse/routeAccess.ts`)

Evidence reviewed on `main` at `144e9d8d` (2026-08-03). Repository sources only — no invented RPCs or capabilities.

---

## 1. Module identity

| Field | Value |
|---|---|
| Module/domain | Inventory command center |
| Owning backend domain | Stores / Inventory (Execution OS Phase 4A/4G) |
| Owning application | Oasis-Baklawa-Central |
| Primary personas | STORE_INCHARGE, STORE_READY_GOODS, RGS_ADMIN, OPERATIONS_MANAGER |
| Secondary personas | SUPER_ADMIN, ADMIN, PRODUCTION_MANAGER, INVENTORY_MANAGER |
| Read-only personas | Roles with `inventory` module read but no reservation/stock mutation authority |

## 2. Business outcome

Single stores/inventory **attention surface**: what needs attention, what is blocked, next valid action — without duplicating specialist boards (`/admin/reservation-board`, `/admin/inventory-risk-board`) or inventing stock truth.

## 3. Current frontend (AS-IS — do not redesign in Phase A)

| Aspect | Verified state | Source |
|---|---|---|
| UI | `src/pages/admin/InventoryCommandCenter.tsx` | Read-only merged timeline |
| Live data | **Not connected** — hardcoded feed inputs | L16–37, badge L45–46 |
| Writes | **None** | L13 comment |
| Feed builders | `buildInventoryOsOperationalFeed`, `buildExecutionOperationalFeed`, `buildGovernanceOperationalFeed`, `buildBarcodeOperationalFeed` | L7–10 |

---

## 4. Canonical entities and fields

| Entity | Identifier(s) | Source of truth | Verified | Notes |
|---|---|---|---|---|
| Product | `products.id`, `sku` | `products` | ✅ | `src/integrations/supabase/types.ts` |
| Factory snapshot qty | `factory_inventory.product_id`, `quantity`, `last_updated` | `factory_inventory` | ✅ types + RLS | **Factory snapshot, not shelf ATP** — `docs/INVENTORY_READY_GOODS_VISIBILITY_STATUS.md` L13–14 |
| Stock balance | `product_id`, `sku`, `location_code`, `available_qty`, `reserved_qty`, `damaged_qty`, `expired_qty`, `quarantine_qty`, `version` | `inventory_stock_balances` | ✅ migration | `supabase/migrations/20260526160000_execution_os_phase4g_stock_finalization.sql` L8–20 |
| Reservation | `id`, `reservation_number`, `order_id`, `product_id`, `sku`, `requested_qty`, `reserved_qty`, `fulfilled_qty`, `released_qty`, `reservation_status`, `reservation_priority`, `correlation_id`, `version` | `inventory_reservations` | ✅ migration | `20260526030000_execution_os_phase4a_inventory_reservation.sql` L8–44 |
| Reservation allocation | `reservation_id`, `inventory_entity_type`, `inventory_entity_id`, `allocated_qty`, `allocation_status` | `inventory_reservation_allocations` | ✅ migration | same file L69+ |
| Inventory movement | append-only ledger row | `inventory_movements` | ✅ migration | Immutability trigger L128–136 |
| Consumption lineage | `order_id`, `reservation_id`, `consumed_qty`, `lineage_type`, `scan_reference`, `gate_reference`, `dispatch_lineage_id` | `stock_consumption_lineage` | ✅ migration | Phase 4G |
| Legacy stock item | `inventory_items.id`, `current_stock`, `min_threshold` | `inventory_items` | ⚠️ REVIEW-BACKEND | In `types.ts` only; no CREATE in repo migrations |
| Inventory adjustment | `product_id`, `quantity`, `adjustment_type` | `inventory_adjustments` | ⚠️ REVIEW-BACKEND | types only |
| Bin / outlet registry | — | — | **BLOCKED-BY-BACKEND** | No `bins` or `outlets` table in repo |

---

## 5. Authoritative tables, views and RPCs

### Tables (verified in migrations)

| Table | Phase | RLS | App types generated |
|---|---|---|---|
| `inventory_reservations` | 4A | `is_internal_staff` | **No** — REVIEW-BACKEND |
| `inventory_reservation_allocations` | 4A | `is_internal_staff` | **No** |
| `inventory_movements` | 4A | `is_internal_staff`; UPDATE/DELETE revoked | **No** |
| `inventory_stock_balances` | 4G | `is_internal_staff` | **No** |
| `stock_consumption_lineage` | 4G | `is_internal_staff`; append-only | **No** |
| `factory_inventory` | legacy | `is_internal_staff` + buyer SELECT | ✅ `types.ts` |

### Views

**None verified** for inventory, ATP, shortage, or reservations. No `CREATE VIEW` in `supabase/migrations/` for these domains.

### RPCs

**No inventory business RPCs** in migrations. Writes are direct PostgREST via service layer (`src/lib/inventory-reservations/createGovernedReservation.ts`). Immutability enforced by triggers only:

- `prevent_inventory_movement_mutation()` — `20260526030000_*.sql`
- `prevent_stock_consumption_lineage_mutation()` — `20260526160000_*.sql`

### Source of truth per displayed metric (target command center)

| Metric | Authoritative source today | ICC wired? | Specialist / sibling wired? | Gap classification |
|---|---|---|---|---|
| Stock position (location) | `inventory_stock_balances` | ❌ | Reservation board reads balance slice for selected SKU/location | **ICC wiring** — no ICC read path |
| Factory snapshot qty | `factory_inventory` | ❌ | Store coordination only | **ICC wiring** — sibling surface only |
| Shortage / excess | No view/RPC | ❌ | ❌ | **BLOCKED-BY-BACKEND** |
| ATP | Formula in code only | ❌ | Reservation board context (`buildAvailabilitySnapshotFromBalance`) | **REVIEW-BACKEND** — see §6; **ICC wiring** |
| Open reservations | `inventory_reservations` WHERE open status | ❌ | ✅ `/admin/reservation-board` (`ReservationGovernancePanel` + `supabaseReservationRepository`) | **ICC wiring** — backend capability exists elsewhere |
| Inward/receiving | No table verified | ❌ | ❌ | **BLOCKED-BY-BACKEND** |
| Bin/store allocation | `inventory_reservation_allocations` + `location_code` on balances | ❌ | Reservation board allocation lines | **REVIEW-BACKEND** — **ICC wiring** |
| Blocked stock finalization | `stock:finalize_consumption` path | ❌ | `/admin/stock-finalization` (BLOCKED writes) | **BLOCKED-BY-BACKEND** for ICC |
| Reconciliation / audit | `inventory_movements`, `stock_consumption_lineage`, `operational_events` | ❌ | Reservation board writes append movements | **REVIEW-BACKEND** — **ICC wiring** |

**Wiring vs backend capability:** Several rows above are **ICC wiring gaps** (backend tables and specialist UI exist) rather than missing backend capability. Do not conflate "not on ICC" with "no backend exists."

---

## 6. State machine and frontend projections

### Reservation status (DB-aligned — Phase 4A)

**DB CHECK:** `inventory_reservations.reservation_status` — `pending`, `reserved`, `partially_reserved`, `blocked`, `released`, `expired`, `fulfilled`, `cancelled`

**Transitions:** `src/lib/inventory-reservations/reservationLifecycle.ts` L3–12

| Status | Frontend projection (proposed) | Actionable by (canonical roles from `inventoryAuthorityMatrix.ts`) | Precedence |
|---|---|---|---|
| `pending` | Awaiting allocation | `reservation:reserve` / `reservation:partial_reserve` → OPS_RESERVE_RELEASE (`INVENTORY_MANAGER`, `STORE_INCHARGE`, `STORE_READY_GOODS`, `RGS_ADMIN`, `OPERATIONS_MANAGER`, `ADMIN`) | High |
| `partially_reserved` | Partial hold | Same as `pending` | High |
| `reserved` | Fully held | `reservation:release` / `reservation:fulfill` / `reservation:expire` → OPS_RESERVE_RELEASE; `reservation:fulfill` denied to dispatch roles on reservation board channel | Normal |
| `blocked` | Blocked — reason required | Unblock via `reservation:reserve` / `reservation:release` / `reservation:cancel` → OPS_RESERVE_RELEASE; `reservation:override` → `SUPER_ADMIN` only | Urgent |
| `released` | Released (terminal) | Read-only | — |
| `expired` | Expired (terminal) | Read-only | — |
| `fulfilled` | Fulfilled (terminal) | Read-only | — |
| `cancelled` | Cancelled (terminal) | Read-only | — |
| Unknown | `Status unavailable` | None | Fail-safe |

Open statuses: `pending`, `reserved`, `partially_reserved`, `blocked` — `reservationLifecycle.ts` L34–36

### ATP availability (code formula — not persisted)

```text
available = physical_stock - reserved_open - blocked_inventory - damaged_inventory - expired_inventory - quarantine_inventory
```

Sources: `docs/EXECUTION_OS_PHASE4A_INVENTORY_RESERVATION.md` L24–33; `src/lib/inventory-reservations/reservationAvailability.ts` L5–14

| Formula term | TS field (`InventoryAvailabilitySnapshot`) | Authoritative source when populated | Notes |
|---|---|---|---|
| `physical_stock` | `physicalStock` | `inventory_stock_balances.available_qty + reserved_qty` per location | Derived in `buildAvailabilitySnapshotFromBalance` — not a stored column |
| `reserved_open` | `reservedOpen` | Sum of open reservation holds (`sumOpenReservedQtyForSku` in `reservationBoardQueries.ts`) | Open statuses: `pending`, `reserved`, `partially_reserved`, `blocked` |
| `blocked_inventory` | `blockedInventory` | **REVIEW-BACKEND** — hardcoded `0` in `buildAvailabilitySnapshotFromBalance` | Stock bucket deduction; **not** the same as `reservation_status = 'blocked'` |
| `damaged_inventory` | `damagedInventory` | `inventory_stock_balances.damaged_qty` | Snapshot builder currently passes `0` — **REVIEW-BACKEND** |
| `expired_inventory` | `expiredInventory` | `inventory_stock_balances.expired_qty` | Snapshot builder currently passes `0` — **REVIEW-BACKEND** |
| `quarantine_inventory` | `quarantineInventory` | `inventory_stock_balances.quarantine_qty` | Snapshot builder currently passes `0` — **REVIEW-BACKEND** |

**Distinct concepts — do not conflate:**

- `reservation_status = 'blocked'` — governed reservation workflow state (row cannot proceed until unblocked).
- `blockedInventory` in the ATP formula — physical stock bucket excluded from availability (currently always `0` in the builder).

**REVIEW-BACKEND:** No verified RPC/view returns `InventoryAvailabilitySnapshot` for ICC consumption. Reservation board builds snapshots per selected SKU/location only.

### Stock finalization (TS projection — not ICC scope)

`pending_dispatch_finalization` → `consumption_blocked` | `variance_detected` | `ready_for_consumption` → `consumption_finalized` | `consumption_reversed`

Source: `src/lib/stock-finalization/stockFinalizationTypes.ts` — **BLOCKED-BY-BACKEND** for Wave 2 ICC write UI.

### Inventory OS design-time lifecycle (parallel — not DB)

`draft` → `verification_required` → `pending_approval` → `approved` → `released` | `expired` | `cancelled`

Source: `src/lib/inventory-operating-system/reservationLifecycle.ts` — comment in `inventoryTypes.ts`: design-time until persistence ships. **REVIEW-BACKEND:** reconcile with 4A DB states.

---

## 7. Authority matrix action identifiers

### Reservation actions (app-layer — `src/lib/inventory-authority/inventoryAuthorityMatrix.ts`)

| Action ID | Permitted roles (summary) | Segregation |
|---|---|---|
| `reservation:create` | INVENTORY_FULL, OPERATIONS_MANAGER | Finance denied |
| `reservation:reserve` | same | — |
| `reservation:partial_reserve` | same | — |
| `reservation:release` | OPS_RESERVE_RELEASE | — |
| `reservation:expire` | INVENTORY_FULL, OPERATIONS_MANAGER | — |
| `reservation:fulfill` | INVENTORY_FULL (not dispatch board channel) | Dispatch via golden chain only |
| `reservation:cancel` | OPS_RESERVE_RELEASE | — |
| `reservation:override` | SUPER_ADMIN only | Requires override |

Write channels: `reservation_board` | `golden_chain_operator` — `inventoryAuthorityTypes.ts`

### Stock actions (app-layer — `src/lib/stock-authority/stockAuthorityGuard.ts`)

| Action ID | Permitted roles | Audit requirement |
|---|---|---|
| `stock:finalize_consumption` | INVENTORY_MANAGER, DISPATCH_HEAD, ADMIN, SUPER_ADMIN | SUPER_ADMIN needs `overrideReason` |
| `stock:reverse_consumption` | INVENTORY_MANAGER, SUPER_ADMIN | `reversalReason` required |
| `stock:record_variance` | INVENTORY_MANAGER, ADMIN, SUPER_ADMIN | `varianceReason` required |
| `stock:quarantine` | INVENTORY_MANAGER, ADMIN, SUPER_ADMIN | — |
| `stock:release_quarantine` | INVENTORY_MANAGER, ADMIN, SUPER_ADMIN | — |

Forbidden: `stock:silent_deduct`, `stock:auto_adjust`, `stock:delete_ledger`

### Page read authority

| Action | Gate | Verified |
|---|---|---|
| View ICC | `inventory` module + `AdminRouteGuard` | ✅ |
| ICC mutations | None exposed | ✅ (no write UI) |

### RLS vs app authority — REVIEW-BACKEND

`is_internal_staff()` includes `STORE_INCHARGE`, `DISPATCH_HEAD` but **not** `STORE_READY_GOODS`, `RGS_ADMIN`, `INVENTORY_MANAGER` — `supabase/migrations/20260601142000_fix_is_internal_staff_dispatch_head.sql` L15–21.

Those roles appear in `inventoryAuthorityMatrix.ts` L16–23 but may fail RLS on Phase 4A/4G tables.

---

## 8. Exceptions, shortages, damage, reconciliation

| Path | Verified backend | ICC exposure |
|---|---|---|
| Reservation blocked | `reservation_status = blocked` | REVIEW-BACKEND — not wired to ICC |
| Shortage signal | No authoritative view | **BLOCKED-BY-BACKEND** |
| Damage / quarantine | `inventory_stock_balances.damaged_qty`, `quarantine_qty` | REVIEW-BACKEND — table exists, no ICC read |
| Variance | `stock:record_variance` + `lineage_type = variance_recorded` | **BLOCKED-BY-BACKEND** for ICC |
| Reconciliation backlog | `inventoryRiskDerive` projection inputs only | REVIEW-BACKEND — design-time |
| Stock finalization | Golden chain prerequisites (`dispatchLineageId`, scan ref) | **BLOCKED-BY-BACKEND** |

---

## 9. Realtime / event requirements

| Requirement | Verified today | Target |
|---|---|---|
| Reservation changes | Not subscribed on ICC | REVIEW-BACKEND — define channel (Supabase realtime on `inventory_reservations`?) |
| Stock balance changes | Not subscribed | REVIEW-BACKEND |
| Stale data indicator | Not implemented on ICC | Required per device matrix |
| Event audit | `operational_events` + `inventory_movements` append-only | REVIEW-BACKEND — join contract for ICC timeline |

---

## 10. UI state semantics (when wired)

| State | Condition | Display |
|---|---|---|
| Loading | Fetch in progress | Skeleton / spinner |
| Empty | No open signals | Role-specific no-work message |
| Stale | Freshness SLA exceeded (data present but aged) | Visible stale banner with timestamp |
| Blocked | Backend reachable; user lacks authority or resource is policy-blocked (RLS deny, `authority_denied`) | Diagnostic; no synthetic KPIs |
| Backend-unavailable | Phase 4 tables missing, migration drift, or probe/query hard-failure (`tablesOk === false` pattern from reservation board) | Fail-safe unavailable |

**Precedence (mutually exclusive):** Evaluate `Backend-unavailable` before `Blocked`. If the backend cannot be reached or Phase 4 tables are absent, show `Backend-unavailable` — not `Blocked`.

Unknown backend states must not coerce to normal/completed — per `.ai-intent/APPVERSE_WAVE1_UX_CONTRACT.md`.

---

## 11. Relationship to specialist surfaces

| Surface | Relationship | Status |
|---|---|---|
| `/admin/reservation-board` | Specialist deep tool — **reads/writes Phase 4A tables today** via `ReservationGovernancePanel` | REVIEW-BACKEND — lens vs separate domain; not an ICC wiring substitute |
| `/admin/inventory-risk-board` | Specialist risk analysis | REVIEW-BACKEND |
| `/admin/stock-finalization` | BLOCKED-BY-BACKEND writes | Excluded from Phase A ICC |
| `/admin/store-coordination` | Sibling — factory snapshot read | Factory qty not ICC primary feed until backend defines |

---

## 12. Unresolved gaps (sign-off blockers)

| # | Gap | Classification |
|---|---|---|
| G1 | No authoritative shortage/ATP view or RPC for ICC | **BLOCKED-BY-BACKEND** |
| G2 | ICC not connected to any live inventory feed (specialist board wiring does not satisfy ICC) | **ICC wiring** — reservation board has live 4A path |
| G3 | Phase 4A/4G tables absent from generated `types.ts` | **REVIEW-BACKEND** |
| G4 | Remote migration apply status unknown | **REVIEW-BACKEND** — `docs/MIGRATION_DRIFT_VERIFICATION_PACK.md` |
| G5 | `is_internal_staff` role list vs app authority matrix mismatch | **REVIEW-BACKEND** |
| G6 | Parallel reservation state machines (4A DB vs Inventory OS design) | **REVIEW-BACKEND** |
| G7 | Execution satisfaction flags source for ICC (War Room) | **BLOCKED-BY-BACKEND** |
| G8 | Bin/outlet allocation model for command center | **BLOCKED-BY-BACKEND** |
| G9 | Realtime/freshness SLA | **REVIEW-BACKEND** |
| G10 | ICC queue model (inclusion, sort, SLA) undefined | **BLOCKED-BY-BACKEND** |

**Sign-off eligibility:** **NOT eligible.** G1–G2 and at least one of G3–G6 must be closed by backend thread before sign-off.

---

## 13. Sign-off

| Role | Name | Date | Signature |
|---|---|---|---|
| Backend owner | — | — | ⬜ |
| Frontend owner | — | — | ⬜ |

**Sign-off recorded in:** [`../APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md`](../APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md)
