# Wave 2 Gate: Stores / Inventory Backend Contract Reconciliation

Status: **IN PROGRESS** — Wave 2 coding blocked until Phase A criteria are complete. Phase B modules remain blocked until their own handoffs finish.

Wave 1 is frozen at baseline `717b66eb` (see `.ai-intent/APPVERSE_WAVE1_BASELINE.md`). This document is the only active pre-Wave-2 workstream.

## Purpose

Reconcile backend truth for Stores/Inventory modules before any Wave 2 frontend implementation. Frontend must not invent operational behaviour for these surfaces.

Use `.ai-intent/BACKEND_FRONTEND_MODULE_HANDOFF_TEMPLATE.md` for each module sign-off.

## Modules in scope (Wave 2 gate)

| Module | Canonical route(s) | Disposition | Handoff status | Owner |
|---|---|---|---|---|
| Inventory command center | `/admin/inventory-command-center` | SIMPLIFY | **Draft** — [handoff](handoffs/PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md) | Backend thread |
| Store coordination | `/admin/store-coordination` | SIMPLIFY | **Draft** — [handoff](handoffs/PHASE_A_STORE_COORDINATION_HANDOFF.md) | Backend thread |
| Third-party store | `/admin/3pcs-store` | SIMPLIFY | **Not started** | Backend thread |
| Reservation board | `/admin/reservation-board` | SPECIALIST | **Not started** | Backend thread |
| Inventory risk board | `/admin/inventory-risk-board` | SPECIALIST | **Not started** | Backend thread |
| Stock finalization | `/admin/stock-finalization` | BLOCKED-BY-BACKEND | **Blocked** — no UI write until contract frozen | Backend thread |

## Reconciliation checklist (per module)

Copy into each module's handoff record when complete:

- [ ] Canonical entities and identifiers documented
- [ ] Source-of-truth tables/views/RPCs named
- [ ] Role and permission boundaries defined
- [ ] State machine with frontend projection for every canonical state
- [ ] Authority matrix action identifiers for every primary operator action
- [ ] Exceptions, overrides, and escalation paths defined
- [ ] Audit evidence requirements specified
- [ ] Data freshness / realtime expectations stated
- [ ] Mobile/handheld requirements identified (if applicable)
- [ ] Unknown-state fallback defined (fail-safe, no coercion)

## Open questions (must resolve before Wave 2 UI freeze)

1. Which view/RPC is authoritative for **shortage** vs **reservation** vs **available-to-promise**?
2. What is the terminal state model for **store transfers** and who may approve exceptions?
3. Which actions on **stock finalization** require dual control or audit reason capture?
4. How do reservation board and inventory risk board relate to the command center — filtered lenses or separate domains?
5. What is the 3PCS store-specific stock rule set vs standard store coordination?

## Gate criteria

### Phase A — Wave 2 primary surfaces (required before any Wave 2 coding)

Only **inventory command center** and **store coordination** may enter Wave 2 implementation. All Phase B modules remain blocked.

| Criterion | Status |
|---|---|
| Inventory command center handoff — AS-IS documented, gaps resolved, **signed off** | 🔄 [Draft](handoffs/PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md) |
| Store coordination handoff — AS-IS documented, gaps resolved, **signed off** | 🔄 [Draft](handoffs/PHASE_A_STORE_COORDINATION_HANDOFF.md) |
| `BLOCKED-BY-BACKEND` routes (incl. `/admin/stock-finalization`) excluded from Wave 2 write UI | ⬜ |
| Backend thread sign-off for both Phase A modules recorded below | ⬜ |
| Wave 1 baseline tests green on `main` | ✅ (frozen at `717b66eb`) |

**Policy:** Wave 2 coding may start only when **every** Phase A criterion is complete. Draft handoffs document current code reality; sign-off requires backend closure of all open questions.

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
| Inventory command center | [PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md](handoffs/PHASE_A_INVENTORY_COMMAND_CENTER_HANDOFF.md) | — | — | Phase A — draft |
| Store coordination | [PHASE_A_STORE_COORDINATION_HANDOFF.md](handoffs/PHASE_A_STORE_COORDINATION_HANDOFF.md) | — | — | Phase A — draft |
| Third-party store | — | — | — | Phase B |
| Reservation board | — | — | — | Phase B |
| Inventory risk board | — | — | — | Phase B |
| Stock finalization | — | — | — | Blocked until backend contract frozen |

## After Phase A gate opens

1. Draft `.ai-intent/APPVERSE_WAVE2_UX_CONTRACT.md` (presentation only).
2. Add `src/lib/appverse/wave2.ts` following the `wave1.ts` pattern.
3. Extend launchpad additively; do not modify Wave 1 invariants without baseline evidence.

## Wave 2 clusters (post Stores/Inventory)

After Stores/Inventory Phase A/B complete, reconcile backend contracts for:

- Dispatch / Trace management surfaces (Wave 1 shell already includes `trace-dispatch` container)
- Governance management surfaces (Wave 1 shell already includes `governance` container)
