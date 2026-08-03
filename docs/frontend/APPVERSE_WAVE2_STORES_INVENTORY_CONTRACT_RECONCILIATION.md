# Wave 2 Gate: Stores / Inventory Backend Contract Reconciliation

Status: **IN PROGRESS** — Wave 2 coding blocked until Phase A criteria are complete. Phase B modules remain blocked until their own handoffs finish.

Wave 1 is frozen at baseline `717b66eb` (see `.ai-intent/APPVERSE_WAVE1_BASELINE.md`). This document is the only active pre-Wave-2 workstream.

**Last contract review:** `main` @ `144e9d8d` (2026-08-03) — repository evidence audit for Phase A handoffs. Both modules remain **Draft**; not eligible for sign-off.

## Purpose

Reconcile backend truth for Stores/Inventory modules before any Wave 2 frontend implementation. Frontend must not invent operational behaviour for these surfaces.

Use `.ai-intent/BACKEND_FRONTEND_MODULE_HANDOFF_TEMPLATE.md` for each module sign-off.

## Modules in scope (Wave 2 gate)

| Module | Canonical route(s) | Disposition | Handoff status | Owner |
|---|---|---|---|---|
| Inventory command center | `/admin/inventory-command-center` | SIMPLIFY | **Draft** — [handoff](handoffs/PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md) (10 blockers) | Backend thread |
| Store coordination | `/admin/store-coordination` | SIMPLIFY | **Draft** — [handoff](handoffs/PHASE_A_STORE_COORDINATION_HANDOFF.md) (10 blockers) | Backend thread |
| Third-party store | `/admin/3pcs-store` | SIMPLIFY | **Not started** | Backend thread |
| Reservation board | `/admin/reservation-board` | SPECIALIST | **Not started** | Backend thread |
| Inventory risk board | `/admin/inventory-risk-board` | SPECIALIST | **Not started** | Backend thread |
| Stock finalization | `/admin/stock-finalization` | BLOCKED-BY-BACKEND | **Blocked** — no UI write until contract frozen | Backend thread |

## Reconciliation checklist (per module)

| Item | ICC | Store coordination |
|---|---|---|
| Canonical entities and identifiers documented | ✅ (with gaps marked) | ✅ (with gaps marked) |
| Source-of-truth tables/views/RPCs named | ✅ verified + gaps | ✅ verified + gaps |
| Role and permission boundaries defined | ⚠️ REVIEW-BACKEND (RLS vs app matrix) | ⚠️ REVIEW-BACKEND |
| State machine with frontend projection | ⚠️ 4A DB states documented; ICC not wired | ⚠️ local drafts only; DB states separate |
| Authority matrix action identifiers | ✅ app-layer IDs documented | ⚠️ reads only; writes BLOCKED |
| Exceptions, overrides, escalation paths | ⚠️ partial | ⚠️ partial |
| Audit evidence requirements specified | ⚠️ append-only ledgers named | ⚠️ BLOCKED for mutations |
| Data freshness / realtime expectations stated | ⚠️ REVIEW-BACKEND | ⚠️ REVIEW-BACKEND |
| Mobile/handheld requirements identified | ⬜ deferred to Wave 2 UX | ⬜ deferred to Wave 2 UX |
| Unknown-state fallback defined | ✅ fail-safe rule stated | ✅ confidence + error paths |

Legend: ✅ = documented from repo evidence; ⚠️ = partial / needs backend closure; ⬜ = not yet applicable.

## Open questions (must resolve before Wave 2 UI freeze)

| # | Question | Finding (repo evidence) | Classification |
|---|---|---|---|
| 1 | Shortage vs reservation vs ATP authority? | ATP formula in `reservationAvailability.ts`; balances in `inventory_stock_balances`; no view/RPC | **BLOCKED-BY-BACKEND** |
| 2 | Store transfer terminal states and approvers? | `store_requisitions` table exists, unwired; no state enum in migrations | **REVIEW-BACKEND** |
| 3 | Stock finalization dual-control / audit? | `stockAuthorityGuard.ts` requires reasons; golden-chain prerequisites documented | **BLOCKED-BY-BACKEND** (excluded from Phase A) |
| 4 | Reservation/risk board vs command center? | Specialist routes; 4A tables serve reservation board | **REVIEW-BACKEND** |
| 5 | 3PCS store rule set vs standard coordination? | `/admin/3pcs-store` is Phase B; not audited here | Phase B |

## Gate criteria

### Phase A — Wave 2 primary surfaces (required before any Wave 2 coding)

Only **inventory command center** and **store coordination** may enter Wave 2 implementation. All Phase B modules remain blocked.

| Criterion | Status |
|---|---|
| Inventory command center handoff — AS-IS documented, gaps resolved, **signed off** | 🔄 [Draft](handoffs/PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md) |
| Store coordination handoff — AS-IS documented, gaps resolved, **signed off** | 🔄 [Draft](handoffs/PHASE_A_STORE_COORDINATION_HANDOFF.md) |
| `BLOCKED-BY-BACKEND` routes (incl. `/admin/stock-finalization`) excluded from Wave 2 write UI | ✅ Documented — excluded in both handoffs §12/§15 |
| Backend thread sign-off for both Phase A modules recorded below | ⬜ |
| Wave 1 baseline tests green on `main` | ✅ (frozen at `717b66eb`) |

**Policy:** Wave 2 coding may start only when **every** Phase A criterion is complete. Draft handoffs document current code reality; sign-off requires backend closure of all open questions.

### Phase B — specialist modules (required before Wave 2 UAT sign-off)

| Criterion | Status |
|---|---|
| Third-party store handoff template **complete** | ⬜ |
| Reservation board handoff template **complete** | ⬜ |
| Inventory risk board handoff template **complete** | ⬜ |
| Stock finalization contract frozen or remains explicitly blocked | ⬜ |

Wave 2 **coding** may start after Phase A only. Phase B must complete before Wave 2 release certification.

## Sign-off record

| Module | Handoff doc / PR | Signed off by | Date | Notes |
|---|---|---|---|---|
| Inventory command center | [PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md](handoffs/PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md) | — | — | Phase A — **Draft** (not eligible) |
| Store coordination | [PHASE_A_STORE_COORDINATION_HANDOFF.md](handoffs/PHASE_A_STORE_COORDINATION_HANDOFF.md) | — | — | Phase A — **Draft** (not eligible) |
| Third-party store | — | — | — | Phase B |
| Reservation board | — | — | — | Phase B |
| Inventory risk board | — | — | — | Phase B |
| Stock finalization | — | — | — | Blocked until backend contract frozen |

## Verified backend inventory (repo evidence summary)

| Capability | Verified in repo | Wired to Phase A UI |
|---|---|---|
| `factory_inventory` read | ✅ types + RLS | Store coordination only |
| Phase 4A reservations (`inventory_reservations`, allocations, movements) | ✅ migrations | Reservation board (not ICC / store coord) |
| Phase 4G stock balances + consumption lineage | ✅ migrations | Stock finalization board (BLOCKED writes for Wave 2) |
| ATP formula (code) | ✅ `reservationAvailability.ts` | Neither Phase A surface |
| Outlet registry | Static `DEFAULT_RETAIL_OUTLETS` only | Store coordination |
| Per-outlet shelf stock | ❌ | ❌ |
| Inventory business RPCs | ❌ | ❌ |
| SQL views for inventory/ATP | ❌ | ❌ |

**Cross-cutting REVIEW-BACKEND:** Phase 4 tables missing from `types.ts`; `is_internal_staff()` role list vs `inventoryAuthorityMatrix.ts` mismatch; migration remote-apply status per `docs/MIGRATION_DRIFT_VERIFICATION_PACK.md`.

## After Phase A gate opens

1. Draft `.ai-intent/APPVERSE_WAVE2_UX_CONTRACT.md` (presentation only).
2. Add `src/lib/appverse/wave2.ts` following the `wave1.ts` pattern.
3. Extend launchpad additively; do not modify Wave 1 invariants without baseline evidence.

## Wave 2 clusters (post Stores/Inventory)

After Stores/Inventory Phase A/B complete, reconcile backend contracts for:

- Dispatch / Trace management surfaces (Wave 1 shell already includes `trace-dispatch` container)
- Governance management surfaces (Wave 1 shell already includes `governance` container)
