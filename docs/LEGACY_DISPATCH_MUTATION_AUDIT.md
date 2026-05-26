# Legacy dispatch mutation audit — Phase 4F

**Date:** 2026-05-26  
**Governed path:** `src/lib/dispatch-finalization/` → `updateOrderDispatchStatus()` (Phase 4E)  
**Route:** `/admin/dispatch-finalization`

## Classification key

| Class | Action in 4F |
|-------|----------------|
| **safe read-only** | No change |
| **must remove** | Delete direct `orders.status → dispatched` |
| **must route through 4E** | Link/banner to governed board |
| **legacy compatibility** | Read-only UI + partial operational writes (no status) |

---

## Admin surfaces

| File | Prior behavior | Class | 4F treatment |
|------|----------------|-------|--------------|
| `AdminPackingDispatch.tsx` | Full dispatch: `orders.update({ status: dispatched })`, history, `notifyOrderDispatched` | **must remove** | Partial legs only; full closure blocked + banner |
| `DispatchManagement.tsx` | DPL finalize → `awaiting_final_payment` only | **safe read-only** | No dispatched mutation; readiness badge read-only |
| `AdminSecurityGate.tsx` | Gate pass closed order → `dispatched` + WhatsApp alerts | **must remove** | Carton release only; order stays open until 4E |
| `OrderManagement.tsx` | Pipeline action "Mark Dispatched" | **must route through 4E** | Block `nextStatus === dispatched` in `handleAction` |
| `AdminOrders.tsx` | Pipeline advance to dispatched | **must route through 4E** | Already blocked with toast (preserved) |
| `AdminAccountsRelease.tsx` | Finance gate pass → `dispatched` + notify | **must remove** | Gate pass data only; status via 4E |
| `DispatchFinalizationBoard.tsx` | Governed finalize | **safe (4E)** | Unchanged — sole mutation path |
| `DispatchReadinessBoard.tsx` | Readiness only | **safe read-only** | Unchanged |
| `DispatchCompletionBoard.tsx` | Attestation only | **safe read-only** | Unchanged |

---

## Hooks / utilities

| Symbol | Location | Class | 4F treatment |
|--------|----------|-------|--------------|
| `notifyOrderDispatched` | `utils/notifyEvent.ts` | **legacy compatibility** | Removed from packing/accounts dispatched paths (no auto notify on bypass) |
| `markDispatched` | — | **must remove** | Not present as helper; grep enforced |
| `dispatchComplete` / `forceDispatch` | — | **must remove** | Grep test |

---

## Database writes (orders.status = dispatched)

| Writer (pre-4F) | Post-4F |
|-----------------|---------|
| `supabaseDispatchFinalizationStore.ts` | **Allowed** — optimistic status guard |
| `AdminPackingDispatch.tsx` | **Removed** |
| `AdminSecurityGate.tsx` | **Removed** |
| `AdminAccountsRelease.tsx` | **Removed** |
| All other files | Unchanged / out of dispatch charter |

---

## Routes

| Route | Role post-4F |
|-------|----------------|
| `/admin/packing-dispatch` | Read-only queues + partial `dispatches` leg; banner |
| `/admin/dispatch` | Alias to packing-dispatch (same) |
| `/admin/dispatch-mgmt` | Scan/pack read-only |
| `/admin/dispatch-finalization` | **Authoritative** status → dispatched |

---

## Remaining known bypasses (out of 4F scope)

- None intended in dispatch charter files after 4F merge.
- Re-run grep on `src/pages/admin` before production promotion.
