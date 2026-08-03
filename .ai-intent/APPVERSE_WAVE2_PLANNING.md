# App-Verse Wave 2 Planning and Backend Contract Reconciliation

Status: planning baseline (post Wave 1 landing on `main`)

## Purpose

Wave 1 delivered the App-Verse shell, role-aware Home, and three operational launchpad areas (Orders & Finance, Operations & Production, WhatsApp & Support). Wave 2 deepens the next three workspace clusters without duplicating backend authority.

This document reconciles frontend presentation intent with backend readiness using:

- `docs/frontend/APPVERSE_ROUTE_DISPOSITION_MATRIX.md` (route authority)
- `docs/frontend/APPVERSE_WORKSPACE_COMPLETION_BLUEPRINT.md` (completion sequence)
- `.ai-intent/BACKEND_FRONTEND_MODULE_HANDOFF_TEMPLATE.md` (module freeze gate)
- `docs/frontend/APPVERSE_BACKEND_FRONTEND_SYNC_CONTRACT.md` (authority order)

## Wave 2 scope

| Cluster | Primary personas | Canonical landing routes | Wave 1 overlap |
|---|---|---|---|
| Stores / Inventory | Stores manager, inventory controller, operations manager | `/admin/inventory-command-center`, `/admin/store-coordination`, `/admin/3pcs-store` | Partially surfaced under Operations launchpad |
| Dispatch / Trace | Packing lead, dispatch manager, gate/security, trace operator | `/admin/packing-dispatch`, `/admin/dispatch-readiness`, `/admin/dispatch-completion`, `/security-gate` | Execution dispatch board exists; trace evidence is specialist |
| Governance / Management | Super admin, admin, audit/compliance, executive | `/admin/users`, `/admin/settings`, `/admin/audit`, `/admin/heartbeat` | Executive heartbeat link exists; governance not yet workspace-native |

Wave 2 is presentation and contract reconciliation only. Schema, RLS, Edge Functions, and write authority remain owned by the backend thread.

## Non-goals

- No route deletion or redirect changes in Wave 2 planning.
- No implementation of `BLOCKED-BY-BACKEND` write surfaces until backend contracts are frozen.
- No duplication of AI Studio catalogue authority or Trace specialist internals inside Central.
- No dependency upgrade work (PR #314 and AI Studio Dependabot PRs remain quarantined).

## Backend contract reconciliation matrix

Each row must be completed using the module handoff template before Wave 2 UI freeze.

### A. Stores / Inventory

| Module | Canonical routes | Disposition | Backend contract status | Frontend Wave 2 deliverable |
|---|---|---|---|---|
| Inventory command center | `/admin/inventory-command-center` | SIMPLIFY | **Reconcile** — shortage/risk signals, reservation visibility, store transfer preconditions | Role-first shortage/attention queue with next valid action |
| Store coordination | `/admin/store-coordination` | SIMPLIFY | **Reconcile** — transfer request/approval states, evidence requirements | Transfer queue with blocker explanation |
| Third-party store | `/admin/3pcs-store` | SIMPLIFY | **Reconcile** — 3PCS-specific stock and coordination rules | Specialized store surface within inventory cluster |
| Reservation board | `/admin/reservation-board` | SPECIALIST | **Reconcile** — reservation lifecycle and override authority | Deep specialist lens, not primary nav |
| Inventory risk board | `/admin/inventory-risk-board` | SPECIALIST | **Reconcile** — risk scoring source and freshness | Management specialist view |
| Stock finalization | `/admin/stock-finalization` | BLOCKED-BY-BACKEND | **Blocked** — write contract undefined | Read-only structure only; no write affordances |

**Open backend questions**

1. Which view/RPC is authoritative for shortage vs reservation vs available-to-promise?
2. What is the terminal state model for store transfers and who may approve exceptions?
3. Which actions on stock finalization require dual control or audit reason capture?

### B. Dispatch / Trace

| Module | Canonical routes | Disposition | Backend contract status | Frontend Wave 2 deliverable |
|---|---|---|---|---|
| Packing / dispatch operations | `/admin/packing-dispatch`, `/admin/dispatch` | CONSOLIDATE | **Reconcile** — packing queue states, carton linkage | Unified dispatch preparation queue |
| Dispatch readiness | `/admin/dispatch-readiness` | SIMPLIFY | **Reconcile** — readiness criteria, hold reasons | Decision queue with evidence links |
| Dispatch completion | `/admin/dispatch-completion` | SIMPLIFY | **Reconcile** — completion evidence model | Completion queue with proof capture |
| Security gate | `/security-gate` | SIMPLIFY | **Reconcile** — handover verification and denial paths | Handheld-first gate surface |
| Trace evidence | `/admin/scan-timeline`, `/admin/carton-explorer` | KEEP | **Partial** — Central shows context; Trace owns authority | Deep links and evidence preview only |
| Label command center | `/admin/label-command-center` | KEEP | **Reconcile** — label issuance/reprint authority | Operator queue with audit trail |
| Dispatch finalization | `/admin/dispatch-finalization` | BLOCKED-BY-BACKEND | **Blocked** | No write controls until contract frozen |
| Golden chain operator | `/admin/golden-chain-operator` | BLOCKED-BY-BACKEND | **Blocked** | Sequential operator wizard waits on cross-domain contract |

**Open backend questions**

1. What is the single canonical dispatch state machine from packed -> readiness -> gate -> completion?
2. Which evidence objects (scan, photo, signature) are mandatory per transition?
3. Where does Trace remain system-of-record vs Central presentation?

### C. Governance / Management

| Module | Canonical routes | Disposition | Backend contract status | Frontend Wave 2 deliverable |
|---|---|---|---|---|
| Users / roles | `/admin/users`, `/admin/roles` | KEEP / CONSOLIDATE | **Mostly ready** — existing admin surfaces | Simplified governance workspace entry |
| Settings | `/admin/settings` | KEEP | **Mostly ready** | Grouped infrequent settings with search |
| Audit | `/admin/audit` | SPECIALIST | **Reconcile** — audit event taxonomy and retention | Specialist drill-down, not daily nav |
| Notifications / announcements | `/admin/notifications`, `/admin/announcements` | KEEP | **Reconcile** — targeting rules and approval | Governance subsection |
| Display management | `/admin/display-management` | KEEP | **Reconcile** — TV surface registry vs role exposure | Link to TV matrix in device spec |
| Executive intelligence | `/admin/heartbeat`, `/admin/target-vs-actual` | SPECIALIST | **Reconcile** — KPI source-of-truth per metric | Deep management views linked from Home |
| Entity graph / previews | `/admin/entity-graph-explorer`, preview routes | SPECIALIST | **Diagnostic** | Hidden behind governance/search |

**Open backend questions**

1. Which management metrics are authoritative today vs pending integration (no synthetic KPIs)?
2. What governance actions require reason capture and secondary approval?
3. Which TV/display surfaces are role-gated through existing module authority?

## Proposed Wave 2 implementation sequence

1. **Contract pass (backend thread)** — complete handoff template for Stores/Inventory and Dispatch/Trace modules marked **Reconcile** above.
2. **Launchpad extension** — add Wave 2 areas to `src/lib/appverse/wave2.ts` after module keys and route authority are confirmed (mirror Wave 1 pattern).
3. **Stores / Inventory simplification** — inventory command center and store coordination first; specialist boards second.
4. **Dispatch / Trace chain** — packing-dispatch -> readiness -> gate -> completion as one visible sequence; trace routes as evidence links.
5. **Governance workspace** — consolidate infrequent admin routes under a governance launchpad; keep audit/diagnostics specialist.
6. **Device surfaces** — apply `docs/frontend/APPVERSE_DEVICE_SURFACE_MATRIX.md` handheld rules to gate, packing, and stores execution paths.
7. **UAT** — role-by-role acceptance per route disposition; compatibility aliases must survive direct-link tests.

## Entry criteria (Wave 2 coding may start when)

- [ ] Backend handoff template completed for inventory command center and packing-dispatch chain.
- [ ] Authority matrix action identifiers exist for every Wave 2 primary action.
- [ ] `BLOCKED-BY-BACKEND` routes explicitly excluded from write UI scope.
- [ ] Route disposition matrix reviewed for Wave 2 routes (no new alias gaps).
- [ ] Wave 1 launchpad and role Home remain green in CI.

## Exit criteria (Wave 2 complete when)

- [ ] Three Wave 2 launchpad areas visible by module authority (stores/inventory, dispatch/trace, governance).
- [ ] Primary routes above answer: attention, blocker, next action for each persona.
- [ ] Handheld surfaces validated for gate and packing execution paths.
- [ ] No new backend authority duplicated in client conditions.
- [ ] Compatibility routes still pass Playwright smoke and direct-link checks.

## Dependencies and risks

| Risk | Mitigation |
|---|---|
| `stock-finalization` and `dispatch-finalization` remain backend-blocked | Keep read-only or hidden write affordances; link to backend thread |
| Trace duplication in Central | LINK-OUT pattern only; evidence preview, not trace internals |
| Wave 1 regression | Extend `wave1.test.ts` pattern for Wave 2 module visibility tests |
| Dependency churn (PR #314) | Keep quarantined; do not bundle with Wave 2 |

## Immediate next actions

1. Backend thread: schedule handoff sessions for **inventory command center** and **dispatch readiness/completion** using the module handoff template.
2. Frontend thread: draft `APPVERSE_WAVE2_UX_CONTRACT.md` once the first two handoffs are **Reconcile -> Ready**.
3. Product: confirm Wave 2 launchpad labels and persona mapping against `src/lib/appverse/roleAccess.ts`.
