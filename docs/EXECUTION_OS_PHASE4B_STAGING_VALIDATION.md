# Phase 4B staging validation — Dispatch readiness + gate eligibility

## Prerequisites

- [ ] PRs #105–#115 merged on `main`
- [ ] Apply `20260526120000_execution_os_phase4b_dispatch_readiness.sql`
- [ ] Phase 4A reservation tables + append-only movements verified
- [ ] No production route uses in-memory reservation store

## Migration

- [ ] `dispatch_readiness_evidence` exists
- [ ] UPDATE/DELETE on evidence raises exception
- [ ] RLS: internal staff SELECT/INSERT only

## Dispatch readiness sample order

- [ ] Open `/admin/dispatch-readiness`
- [ ] Sample order with all dimensions → `gate_eligible` badge
- [ ] Copy states **not dispatched**

## Blockers

- [ ] Missing packing evidence → `dispatch_missing_packing_evidence` in open exceptions
- [ ] Barcode mismatch → `dispatch_barcode_mismatch`
- [ ] Rejected gate scan → `dispatch_gate_rejected`
- [ ] Reservation pending → `dispatch_reservation_not_ready`
- [ ] Finance signal `blocked` → `dispatch_finance_signal_blocked`
- [ ] Missing document placeholder → `dispatch_document_placeholder_missing`

## Gate eligible but not dispatched

- [ ] `gate_eligible` status shown
- [ ] No `markDispatched` in codebase paths for this board
- [ ] Network tab: no order status transition to dispatched from readiness board
- [ ] Readiness review creates internal event only

## Forbidden proofs

- [ ] Grep: no `markDispatched`, `dispatchComplete`, `generateInvoice`, `eway`, `deductStock` in `dispatch-readiness` / `dispatch-authority`
- [ ] No invoice/e-way buttons on dispatch readiness UI
- [ ] No stock table writes from readiness service
- [ ] No customer timeline publish from dispatch readiness events

## Route / module

- [ ] `/admin/dispatch-readiness` requires admin staff role
- [ ] `DISPATCH_MANAGER` sees nav item (dispatch module)
- [ ] `SALES_EXECUTIVE` blocked from `/admin/*`

## Execution board integration

- [ ] Dispatch handheld (`/admin/dispatch-mgmt`) shows read-only readiness badge
- [ ] Badge does not enable dispatch completion

## Grep exception table

| Pattern | File | Reason |
|---------|------|--------|
| `.insert(` | `supabaseDispatchEvidenceStore.ts` | Append-only evidence |
| `.insert(` | `DispatchManagement.tsx` | Existing attachments (out of 4B scope) |

No `.update(` / `.delete(` in `src/lib/dispatch-readiness/` or `src/lib/dispatch-authority/`.
