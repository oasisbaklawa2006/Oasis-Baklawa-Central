# Phase 4E staging validation — Governed dispatch finalization

## Prerequisites

- [ ] PRs through Phase 4D merged; migrations 4A–4D applied and validated
- [ ] Phase 4D completion attestation verified append-only
- [ ] Phase 4C commercially_released + finance signal ready on sample orders
- [ ] Phase 4B gate_eligible on same sample orders
- [ ] No production admin route uses in-memory finalization store when Supabase is configured

## Migration

- [ ] Apply `20260526150000_execution_os_phase4e_dispatch_finalization.sql`
- [ ] `dispatch_release_lineage` UPDATE/DELETE fails (append-only + REVOKE)
- [ ] RLS: dispatch roles INSERT; staff SELECT; `SALES_EXECUTIVE` denied

## Release eligibility

- [ ] All 4B+4C+4D prerequisites met → `dispatch_release_ready`
- [ ] Missing attestation → `dispatch_release_pending`
- [ ] Manual blocker → `dispatch_release_blocked`

## Governed finalize proof

- [ ] `dispatch:finalize` inserts lineage row (`release_type=finalize`)
- [ ] `orders.status` transitions `cleared_for_dispatch` (or allowed source) → `dispatched` **only** via repository
- [ ] `order_status_history` row inserted with correlation to finalize
- [ ] Optimistic lock: concurrent finalize with stale `expectedPreviousStatus` fails with `stale_status`
- [ ] Event `dispatch_finalized` emitted (customer_safe visibility)

## Attested but direct UI blocked

- [ ] `/admin/dispatch-finalization` has no direct `supabase.from('orders').update` in page component
- [ ] Network tab: status change follows service call, not ad-hoc PATCH from UI
- [ ] Legacy `/admin/dispatch-mgmt` unchanged — document dual path until migration

## Customer publication

- [ ] After finalize, `publish_customer_release` shows preview: Dispatched, In transit
- [ ] Reversal / finance / override titles suppressed from customer preview
- [ ] No WhatsApp/SMS/email API calls from finalization module

## Reversal

- [ ] `requestDispatchReversal` + `completeDispatchReversal` require `reversalReason`
- [ ] Compensating `release_type=reversal` lineage appended
- [ ] No DELETE on lineage table
- [ ] Customer feed does not show reversal detail

## Stock confirmation intent

- [ ] `confirm_stock_consumption` appends lineage only
- [ ] No `inventory_movements` deduction / stock table mutation from finalization

## Forbidden proofs

- [ ] Grep: no `capturePayment`, `generateInvoice`, `eway`, `razorpay`, `deductStock`, `sendNotification` in `dispatch-finalization`
- [ ] Grep: no `.delete(` in finalization libs
- [ ] `.update(` only in `supabaseDispatchFinalizationStore.ts` (orders status)

## Authority

- [ ] `DISPATCH_HEAD` can finalize; `FINANCE_HEAD` denied
- [ ] `SUPER_ADMIN` finalize requires `overrideReason`
- [ ] Reversal: `DISPATCH_HEAD` only (not `DISPATCH_MANAGER`)

## Route / module

- [ ] `/admin/dispatch-finalization` under dispatch module
- [ ] Nav “Dispatch finalization” visible for dispatch roles

## Grep exception table

| Pattern | File | Reason |
|---------|------|--------|
| `.insert(` | `supabaseDispatchFinalizationStore.ts` | Lineage + status history |
| `.update(` | `supabaseDispatchFinalizationStore.ts` | Governed `orders.status` only, with `.eq('status', expected)` |

No other `.update(` / `.delete(` in `src/lib/dispatch-finalization/` or UI board.
