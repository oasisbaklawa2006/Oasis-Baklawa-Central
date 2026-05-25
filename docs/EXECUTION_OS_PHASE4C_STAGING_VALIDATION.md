# Phase 4C staging validation — Finance governance + commercial release

## Prerequisites

- [ ] PRs #105–#116 merged; Phase 4A/4B migrations applied
- [ ] Operational events durability verified in staging
- [ ] No in-memory execution persistence on production paths

## Migration

- [ ] Apply `20260526130000_execution_os_phase4c_finance_governance.sql`
- [ ] `finance_review_evidence` UPDATE/DELETE fails (append-only)
- [ ] RLS: finance roles INSERT; staff SELECT

## Finance hold lifecycle

- [ ] Place hold → `finance_hold_created` event
- [ ] Release hold → `finance_hold_released` event
- [ ] Hold affects `dispatchFinanceSignal` = `blocked` in projection

## Advance verification

- [ ] `finance:verify_advance` inserts evidence with `review_type=advance_verification`
- [ ] No `payment_status` mutation from governance service

## Release blocked proof

- [ ] Order with `advance_unverified` → `commercially_blocked` or hold status
- [ ] `blocking_reasons[]` populated

## Commercially released but not dispatched

- [ ] Projection `commercially_released` + warning "not dispatched"
- [ ] Network: no `markDispatched`, no order status → `dispatched` from governance board
- [ ] No invoice API calls from `/admin/finance-governance`

## Dispatch finance signal proof

- [ ] `resolveDispatchFinanceSignal(governanceInput)` returns `ready` when commercially released
- [ ] Dispatch readiness board shows updated signal label (not placeholder)

## Override / rejection reason proof

- [ ] Reject without `rejectionReason` fails
- [ ] `SUPER_ADMIN` `finance:override_review` without `overrideReason` fails

## Forbidden proofs

- [ ] Grep: no `capturePayment`, `generateInvoice`, `razorpay`, `deductStock` in finance-governance
- [ ] No stock table writes
- [ ] No customer timeline events with finance governance kinds

## Route / module gating

- [ ] `/admin/finance-governance` — `FINANCE_HEAD`, `FINANCE_EXEC`, `ADMIN`, `SUPER_ADMIN`
- [ ] `DISPATCH_MANAGER` denied finance actions in API/service tests

## Grep exception table

| Pattern | File | Reason |
|---------|------|--------|
| `.insert(` | `supabaseFinanceEvidenceStore.ts` | Append-only finance evidence |

No `.update(` / `.delete(` in `src/lib/finance-governance/` or `src/lib/finance-authority/`.
