# Central #554 Leap 7 — Leap 13 physical UAT (Order→Gate)

**Authority:** Central macro PR #556 (`cursor/macro-order-dispatch-completion`).  
**Software status:** Internal order-to-gate journey is software-certified on exact head.  
**Physical status:** `NOT_CLEARED` — scanner/TV/gate PASS remains Leap 13 operator UAT.

Machine-readable hook registry: `src/lib/macro-order-dispatch/macroLeap13PhysicalUatHooks.ts`  
Playwright hook probe (software only): `tests/macro-leap13-uat-hooks.spec.ts`

## Deferred physical pass keys

These keys are declared in `MACRO_PHYSICAL_UAT_DEFERRED` and must **not** be claimed until operator evidence is accepted:

| Key | Scope |
|-----|-------|
| `physical_scanner_pass` | Dispatch floor carton/item barcode scanners |
| `physical_tv_pass` | Factory wall-TV production/assembly surfaces |
| `physical_gate_pass` | Independent security gate exit scanners |

## Evidence hook bindings (journey stage → `data-testid`)

| Stage | Route | Hook |
|-------|-------|------|
| Order Pool | `/admin/central-pool` | `macro-order-pool-surface` |
| Finance Release | `/admin/finance-board` | `macro-finance-release-surface` |
| Production Execution | `/operations-controller` | `macro-production-execution-surface` |
| P&A Assembly | `/admin/assembly-tasks` | `macro-assembly-surface` |
| Ready Goods Store | `/admin/ready-goods` | `macro-ready-goods-surface` |
| 3PGS Procurement | `/admin/3pgs-procurement-queue` | `macro-three-pgs-surface` |
| Dispatch Readiness | `/admin/dispatch-readiness` | `macro-dispatch-readiness-surface` |
| Packing / Carton / DPL | `/admin/dispatch-mgmt` | `macro-packing-carton-surface` |
| Golden Chain Operator | `/admin/golden-chain-operator` | `macro-golden-chain-surface` |
| Finance Dispatch Clearance | `/admin/accounts-release` | `macro-finance-clearance-surface` |
| Security Gate scanner | `/security-gate` | `macro-security-gate-scanner` |
| Gate dispatch proof | `/security-gate` | `macro-security-gate-dispatch-proof` |
| Complaint window handoff | `/security-gate` | `macro-security-gate-complaint-window` |
| Customer dispatch comm | `/security-gate` | `macro-security-gate-customer-comm` |
| Factory TV (example) | `/tv/arabic-sweets` | `macro-factory-tv-surface` |

Finance clearance action button: `macro-finance-clearance-action` on Accounts Release.

## Executable operator scenarios

Run on **staging or disposable certification** with controlled test orders. Record operator role, order/SO id, timestamps, and capture (screenshot or short video). Do **not** mutate production data.

### LEAP13-001 — Order pool census

1. Sign in as Operations/Admin role with central-pool access.
2. Open `/admin/central-pool`.
3. Confirm `[data-testid="macro-order-pool-surface"]` is visible.
4. Verify Priority, Owner and SLA columns render for at least one live row.
5. **Evidence:** operator role, screenshot, sample order id.

### LEAP13-002 — Finance release gateway

1. Sign in as `FINANCE_HEAD` or `FINANCE_EXEC`.
2. Open `/admin/finance-board`.
3. Confirm `[data-testid="macro-finance-release-surface"]` is visible.
4. Identify a held vs cleared order without using shadow ledger paths.
5. **Evidence:** order id, release state, operator role.

### LEAP13-003 — Production execution (physical TV/handheld) — DEFERRED

1. Open `/operations-controller` on a **physical handheld** or verify `/tv/*` on a **wall-mounted display**.
2. Confirm production queue surfaces (`macro-production-execution-surface` or `macro-factory-tv-surface`).
3. Execute start/pause/complete on a governed test job.
4. **Deferred pass key:** `physical_tv_pass`.

### LEAP13-004 — Dispatch carton scan — DEFERRED

1. Sign in as `DISPATCH_MANAGER` or `PACKING_SUPERVISOR`.
2. Open `/admin/dispatch-mgmt`; confirm `macro-packing-carton-surface`.
3. Scan governed carton barcode with **physical scanner**; confirm RPC resolution and rejection of invalid duplicates.
4. **Deferred pass key:** `physical_scanner_pass`.

### LEAP13-005 — Finance Dispatch Clearance

1. Sign in as authorized finance actor.
2. Open `/admin/accounts-release`; confirm `macro-finance-clearance-surface`.
3. Select order with frozen DPL and E-way evidence.
4. Click `[data-testid="macro-finance-clearance-action"]` — Grant Finance Dispatch Clearance.
5. **Evidence:** order id, clearance timestamp, e-way reference.

### LEAP13-006 — Security gate carton scan — DEFERRED

1. Sign in as `SECURITY_GATE` / gate operator.
2. Open `/security-gate`; focus `[data-testid="macro-security-gate-scanner"]`.
3. Scan Finance-cleared DPL carton; confirm release or governed denial message.
4. **Deferred pass key:** `physical_gate_pass`.

### LEAP13-007 — Immutable gate-exit dispatch proof

1. After all cartons pass gate scan for one order.
2. Complete transporter fields in `[data-testid="macro-security-gate-dispatch-proof"]`.
3. Freeze dispatch proof; confirm immutable proof id and complaint deadline load.
4. **Evidence:** order id, dispatch proof id, transporter, vehicle number.

### LEAP13-008 — Customer dispatch communication + complaint window

1. After proof freeze, confirm `[data-testid="macro-security-gate-complaint-window"]` shows invoice-anchored deadline.
2. Click `[data-testid="macro-security-gate-customer-comm"]` when eligible.
3. Confirm window state remains anchored to final invoice date (10-calendar-day semantics).
4. **Evidence:** invoice number, complaint deadline, window state OPEN/EXPIRED.

### LEAP13-009 — Factory wall-TV — DEFERRED

1. Open `/tv/arabic-sweets` (or department-specific TV route) on wall display.
2. Confirm `[data-testid="macro-factory-tv-surface"]` and open job count matches governed `production_jobs`.
3. **Deferred pass key:** `physical_tv_pass`.

## Dispatch least privilege (software regression)

Dispatch floor roles must **not** reach admin war-room, finance, central pool, or production handheld surfaces. Automated coverage: `tests/macro-order-to-gate-journey.spec.ts` (Dispatch Manager least privilege block).

## Strike checklist (Leap 13 physical)

Mission Control may accept Leap 13 physical UAT when **all** deferred scenarios (003, 004, 006, 009) have named operator evidence and software hook probes pass on exact head. This does **not** clear full programme stage 11 or claim `PR MERGED == STAGE CLEARED`.
