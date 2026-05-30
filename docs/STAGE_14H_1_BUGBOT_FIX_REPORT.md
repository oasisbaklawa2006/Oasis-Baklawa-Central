# STAGE 14H.1 BUGBOT FIX REPORT

**PR:** https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/132  
**Branch:** `cursor/stage-14h-stock-override-reason-a394`

---

## Bugbot comments addressed

### 1. `ReservationGovernancePanel.tsx` — context loading & stale context

| Issue | Fix |
|-------|-----|
| `contextLoading` stuck when `selectedLine` null or effect cancelled | `setContextLoading(false)` in early return, `finally` always clears loading (not gated on `cancelled`) |
| Stale context after order/line/location change | Clear `context` immediately on change; reload clears context before fetch; `reservationContextMatchesSelection` gates UI |
| Create & reserve with wrong context | Button disabled unless context matches current `orderId`, `activeLine` SKU/product, and `locationCode` |

### 2. `createGovernedReservation.ts` — compensation & error precedence

| Issue | Fix |
|-------|-----|
| Post-create lookups not isolated | Balance + `sumOpenReservedQtyForSku` wrapped in dedicated `try/catch` |
| Orphan reservation on lookup/reserve failure | `compensateOpenReservationAfterFailure()` called before rethrowing primary error |
| `getReservation` failure blocks cancel | Falls back to `created.reservation.id` / `version` from create response |
| Masking reserve error | Primary `lookupError` / `reserveError` always rethrown after best-effort cancel |

---

## Files changed

| File | Change |
|------|--------|
| `src/components/admin/ReservationGovernancePanel.tsx` | Loading lifecycle, stale context clearing, `canCreateAndReserve` gating |
| `src/lib/inventory-reservations/reservationBoardQueries.ts` | `activeLine`, `reservationContextKey`, `reservationContextMatchesSelection` |
| `src/lib/inventory-reservations/createGovernedReservation.ts` | Lookup isolation + exported compensation helper |
| `src/lib/inventory-reservations/__tests__/createGovernedReservation.compensation.test.ts` | Compensation + getReservation-failure cases |
| `src/lib/inventory-reservations/__tests__/reservationBoardQueries.test.ts` | Context match tests |
| `docs/STAGE_14H_1_BUGBOT_FIX_REPORT.md` | This report |

---

## Tests

| Command | Result |
|---------|--------|
| `npm run typecheck` | PASS |
| `npm run build` | PASS |
| `npm test -- --run src/lib/inventory-reservations` | **31 passed** |
| `npm test -- --run src/lib/stock-finalization src/lib/stock-authority` | **36 passed** |

---

## Remaining open Bugbot comments

None identified in-repo for these two files after this pass. (Prior medium findings on `dcb624a` for reservation flow are addressed above.)

---

## Verdict

| | |
|--|--|
| **READY TO MERGE PR #132** | **YES** |

Governance preserved: no migrations, no production access, no authority bypass, no `stock_consumption_lineage` UI writes, no `orders.status` mutation, no auto stock finalization.
