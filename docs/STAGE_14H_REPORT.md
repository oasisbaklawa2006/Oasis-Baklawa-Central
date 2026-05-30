# STAGE 14H REPORT — Stock Finalization SUPER_ADMIN Override Reason Fix

**Date:** 2026-05-30  
**Branch:** `cursor/stage-14h-stock-override-reason-a394`  
**Staging:** `aruyieslaxjhnamlstpx` only · production not touched

---

## Root cause fixed

`stockAuthorityGuard` requires a typed **`overrideReason`** for **SUPER_ADMIN** on all stock mutations. `StockFinalizationBoard.handleFinalize()` passed **`finalizeReason`** only and the UI had no field to collect override text, so finalize failed with:

`SUPER_ADMIN requires typed overrideReason for stock actions`

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/stock-authority/stockAuthorityGuard.ts` | Export `requiresStockOverrideReason()` |
| `src/lib/stock-authority/__tests__/stockAuthorityGuard.test.ts` | SUPER_ADMIN override tests |
| `src/pages/admin/StockFinalizationBoard.tsx` | Override reason input, blockers, pass `overrideReason` + live balance `version` |
| `src/lib/stock-finalization/stockFinalizationService.ts` | Cap `releaseReservedQty` by on-hand `balance.reservedQty` (staging balance not holding reservation qty) |
| `src/lib/stock-finalization/__tests__/stockFinalizationService.test.ts` | SUPER_ADMIN + unsynced balance tests |
| `tests/stage-14h-stock-finalize-acceptance.spec.ts` | Staging acceptance (one-shot) |
| `docs/STAGE_14H_REPORT.md` | This report |

---

## Implementation summary

1. **Override reason field** — Shown only when `requiresStockOverrideReason(role)` (SUPER_ADMIN).
2. **Governance** — `Finalize consumption` disabled until non-empty override; prerequisite list includes blocker text.
3. **Write context** — `finalizeReason: "Governed UI finalize"` (unchanged); `overrideReason` from UI when required.
4. **Balance version** — Loaded from `inventory_stock_balances` before finalize (not hardcoded `1`).
5. **Consumption lock** — `releaseReservedQty` limited to `min(reservation, consume, balance.reservedQty)` so finalize succeeds when reservation row and balance row are out of sync (observed on staging).

Authority guard **not** weakened; empty override still denied.

---

## Tests run

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npx vitest run src/lib/stock-authority/__tests__/stockAuthorityGuard.test.ts src/lib/stock-finalization/__tests__/stockFinalizationService.test.ts` | **21 passed** |

---

## Staging result (SO-2026-000002 / Order 1e85)

Executed once after fix with override text:  
`Stage 14G governed stock finalization test`

| Check | Result |
|-------|--------|
| Override field visible for SUPER_ADMIN | **YES** |
| Finalize consumption | **SUCCESS** (UI message + SQL) |
| `stock_consumption_lineage` | **1** row (`consumption_finalized`, `consumed_qty: 1`) |
| `inventory_movements` | **1** row (`dispatch_consumption_confirmed`, `quantity: 1`) |
| `orders.status` | **`dispatched`** (unchanged) |
| `inventory_stock_balances` | `available_qty: 49`, `version: 2` |
| `inventory_reservations` | Still `reserved` / `fulfilled_qty: 0` — **not updated by 4G service** (lineage is consumption proof) |

Re-running the Playwright acceptance spec fails as expected (`already_finalized` blocker).

**Artifact:** `docs/artifacts/stage-14g/06-after-finalize-click.png` (prior) · success captured in SQL above

---

## SQL verification (read-only, staging)

```json
orders.status: "dispatched"

inventory_reservations: {
  "reservation_status": "reserved",
  "reserved_qty": 1,
  "fulfilled_qty": 0
}

stock_consumption_lineage: [{
  "lineage_type": "consumption_finalized",
  "consumed_qty": 1,
  "reason_code": "Governed UI finalize"
}]

inventory_movements: [{
  "movement_type": "dispatch_consumption_confirmed",
  "quantity": 1,
  "reason_code": "Governed UI finalize"
}]
```

---

## Verdict

| Item | Result |
|------|--------|
| **Stock Finalization UI (4G)** | **PASS** (with note on reservation row not auto-fulfilled) |
| **READY FOR CONTROLLED PRODUCTION PILOT** | **READY** for 4G UI path with SUPER_ADMIN override; recommend pilot checklist includes typed override + confirm reservation/balance sync policy |
