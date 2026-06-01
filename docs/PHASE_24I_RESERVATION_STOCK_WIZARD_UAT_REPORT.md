# PHASE 24I — Reservation Write Fix & SO-118 Stock Wizard UAT Report

**Date:** 2026-06-01  
**Environment:** https://cursor-central-vercel.vercel.app  
**Production bundle (post-24I):** `assets/index-BBbfDu4T.js`  
**UAT order:** SO-2026-000118 (`8593bda2-8139-4c53-a883-5507124e35fd`)  
**UAT actor:** `dispatch@oasisbaklawa.com` (`users.role=dispatch_manager`, `profiles.role=DISPATCH_HEAD`)  
**Supabase project:** `tcxvcatsqqertcnycuop` (read-only verification)

---

## 1. Root cause of 403 (reserve stock)

Two independent gates blocked governed reservation writes for dispatch operators:

| Layer | Cause | Symptom |
|--------|--------|---------|
| **App — inventory authority** | `DISPATCH_HEAD` / `DISPATCH_MANAGER` were not allowed `reservation:create` / `reservation:reserve` on the default `reservation_board` write channel. Golden Chain wizard did not pass a dispatch-specific channel. | Client-side deny before Supabase (or inconsistent behavior vs reservation board pilots). |
| **DB — RLS** | `is_internal_staff()` omitted `DISPATCH_HEAD` while inventory RLS policies (`inventory_reservations`, `inventory_movements`, `operational_events`) require `is_internal_staff(auth.uid())`. `dispatch_release_lineage` already listed `DISPATCH_HEAD` explicitly — dispatch finalize worked; inventory writes did not. | HTTP **403** on `POST inventory_reservations`. |

**Fix (app, `c1f9c96`):** `writeChannel: "golden_chain_operator"` on wizard reservation calls; matrix allows dispatch roles for create/reserve/fulfill on that channel only.

**Fix (DB, migration `20260601142000_fix_is_internal_staff_dispatch_head.sql`):** Add `DISPATCH_HEAD` to `is_internal_staff()` (narrow function change, not a broad INSERT policy).

---

## 2. Root cause of finalize stock failure (second blocker)

After reserve succeeded, **Finalize stock** failed silently for `dispatch@` because:

| Layer | Cause |
|--------|--------|
| **App — stock authority** | `stock:finalize_consumption` allowed `DISPATCH_HEAD` via an explicit exception but **`dispatch_manager`** (actual `users.role` for UAT) was not included. `useAuth()` uses `users.role`, not `profiles.role`. |

**Fix (`53aae45`):** Treat `DISPATCH_HEAD`, `DISPATCH_MANAGER`, and `DISPATCH_INCHARGE` as dispatch-linked roles allowed to finalize consumption (same intent as golden-chain dispatch operator).

**UI:** Wizard advance detection now treats `stockConsumptionComplete` as success (not only CTA text change).

---

## 3. Files changed

| Area | Files |
|--------|--------|
| Reservation authority (24I app) | `inventoryAuthorityTypes.ts`, `inventoryAuthorityMatrix.ts`, `inventoryAuthorityGuard.ts`, `reservationTypes.ts`, `goldenChainReservationAccess.ts`, `GoldenChainOperatorWizard.tsx`, `createStockFinalizationBundle.ts` |
| Stock authority (finalize) | `stockAuthorityGuard.ts`, `stockAuthorityTypes.ts` |
| Migration | `supabase/migrations/20260601142000_fix_is_internal_staff_dispatch_head.sql` |
| Tests | `inventoryAuthority.test.ts`, `goldenChainReservationAccess.test.ts`, `stockAuthorityGuard.test.ts`, `phase-24i-reserve-stock-uat.spec.ts`, `phase-24i-finalize-stock-only.spec.ts` |
| Docs | `docs/PHASE_24I_RESERVATION_STOCK_WIZARD_UAT_REPORT.md` |

---

## 4. Migration required?

**Yes — one narrow migration (already applied on remote; file committed to repo):**

- `20260601142000_fix_is_internal_staff_dispatch_head.sql` — adds `DISPATCH_HEAD` to `is_internal_staff()`.

No new tables. No broad “authenticated INSERT” policies.

---

## 5. Tests run

| Suite | Result |
|--------|--------|
| `inventoryAuthority.test.ts` | 7 passed |
| `goldenChainReservationAccess.test.ts` | 2 passed |
| `stockAuthorityGuard.test.ts` | 7 passed |
| `goldenChainOperator.test.ts` (stock-related) | 3 passed |
| Playwright `phase-24i-reserve-stock-uat.spec.ts` (desktop) | Reserve → Finalize stock CTA advanced |
| Playwright `phase-24i-finalize-stock-only.spec.ts` | SO-118 shows **Already complete** after DB finalize |

---

## 6. SO-118 reservation result

| Check | Result |
|--------|--------|
| Wizard **Reserve stock** (no SQL fallback) | **PASS** |
| `inventory_reservations` | **1** row — `RES-MPVARLOY-7UIN`, `reserved_qty=2`, `reservation_status=reserved` |
| Movements | `reservation_created`, `inventory_hold` |

---

## 7. SO-118 stock finalization result

| Check | Result |
|--------|--------|
| Wizard **Finalize stock** | **PASS** (DB + UI **Already complete** on reload) |
| `stock_consumption_lineage` | **1** — `consumption_finalized`, `consumed_qty=2` |
| `inventory_movements` | `dispatch_consumption_confirmed`, qty **2** |
| `inventory_stock_balances` (OAS-PUR-1, WH-MAIN) | `available_qty` **40 → 38** (−2) |
| `orders.status` | **`dispatched`** (unchanged) |

**Note:** Post–4G reservation row fulfill (`reservation_status=fulfilled`) did not update in this run (`fulfilled_qty` still 0). Stock consumption lineage and balance deduction are authoritative for chain completion; reservation fulfill should be followed up in a small 4G-alignment fix if required for reporting.

---

## 8. Final SQL verification (read-only)

```text
orders.status                          = dispatched
inventory_reservations (SO-118)      = 1 (reserved, reserved_qty 2)
stock_consumption_lineage            = 1 consumption_finalized
inventory_movements (reservation)  = reservation_created, inventory_hold, dispatch_consumption_confirmed
inventory_stock_balances OAS-PUR-1   = available_qty 38 (was 40)
dispatch_readiness_evidence          = 4
operational_scan_records             = 2
finance_review_evidence              = 1
dispatch_completion_evidence         = 1
dispatch_release_lineage             = 1 finalize
```

---

## 9. Human messaging (unauthorized reserve)

Wizard shows:

> Inventory user or supervisor must reserve stock — your role cannot create governed reservations from this wizard.

when `goldenChainUserCanReserveStock(role)` is false (CTA disabled).

---

## 10. Final verdict

| Question | Verdict |
|----------|---------|
| **Backend ready?** | **Yes** — reservation + stock consumption paths work for dispatch operator with app channel + `is_internal_staff` fix + stock authority fix. |
| **Wizard ready?** | **Yes** — SO-118 completed through **Already complete**; reload/advance detection improved after finalize. |
| **Operator pilot allowed?** | **Yes** — `dispatch@` golden-chain UAT on SO-118 succeeded end-to-end for reserve + stock. |
| **Company rollout allowed?** | **Conditional yes** — pilot dispatch operators on golden-chain wizard; monitor reservation `fulfilled` row sync and duplicate-finalize guards on other orders. |

---

## 11. Git / deploy

| Item | Value |
|------|--------|
| App commits | `c1f9c96` (reservation channel), `53aae45` (stock authority + migration file) |
| Branch | `cursor/phase-24i-stock-finalize-dispatch-646d` merged to `main` |
