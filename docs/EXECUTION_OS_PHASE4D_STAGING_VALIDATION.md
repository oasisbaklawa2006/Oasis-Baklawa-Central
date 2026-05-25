# Phase 4D staging validation — Controlled dispatch completion governance

## Prerequisites

- [ ] PRs #105–#116 merged; Phase 4A/4B/4C migrations applied
- [ ] `dispatch_readiness_evidence` and `finance_review_evidence` verified append-only
- [ ] No production route uses in-memory completion store when Supabase configured

## Migration

- [ ] Apply `20260526140000_execution_os_phase4d_dispatch_completion.sql`
- [ ] `dispatch_completion_evidence` UPDATE/DELETE fails (append-only)
- [ ] RLS: dispatch roles INSERT; staff SELECT; `SALES_EXECUTIVE` denied

## Completion eligibility chain

- [ ] Order with `readinessStatus=gate_eligible` + `financeSignal=ready` + `commercially_released` → `completion_eligible`
- [ ] Missing gate → `prerequisites_pending`
- [ ] Finance blocked → `prerequisites_pending` or `completion_blocked`
- [ ] Open completion hold → `completion_blocked`
- [ ] `orderAlreadyDispatched=true` → `already_dispatched` (no attest)

## Attestation proof

- [ ] `dispatch:attest_completion` inserts `completion_attestation` evidence
- [ ] Emits `dispatch_completion_attested` operational event
- [ ] Attest without `attestationReason` fails
- [ ] Attest when not `completion_eligible` fails

## Attested but not dispatched

- [ ] Projection shows `completion_attested` after attest
- [ ] Copy states attestation ≠ `orders.status` dispatched
- [ ] Network: no `orders` PATCH/UPDATE to `dispatched` from `/admin/dispatch-completion`
- [ ] Grep: no `markDispatched`, `dispatchComplete`, `status: "dispatched"` in `dispatch-completion` lib

## Integration with 4B / 4C

- [ ] Sample eligible order uses `projectDispatchReadiness` → `gate_eligible`
- [ ] Uses `projectFinanceRelease` → `commercially_released` and `resolveDispatchFinanceSignal` → `ready`
- [ ] Dispatch readiness board still forbids completion buttons
- [ ] Finance governance board still forbids “Mark Dispatched”

## Authority

- [ ] `DISPATCH_MANAGER` may `dispatch:attest_completion`
- [ ] `FINANCE_HEAD` denied completion actions
- [ ] `SUPER_ADMIN` attest requires `overrideReason`

## Forbidden proofs

- [ ] Grep: no `generateInvoice`, `capturePayment`, `deductStock`, `eway` in `dispatch-completion` / `dispatch-completion-authority`
- [ ] No stock table writes
- [ ] No customer timeline publish from completion events

## Route / module

- [ ] `/admin/dispatch-completion` — dispatch module (`DISPATCH_MANAGER`, etc.)
- [ ] Nav item “Dispatch completion” visible under Operations
- [ ] `SALES_EXECUTIVE` blocked from `/admin/*`

## Grep exception table

| Pattern | File | Reason |
|---------|------|--------|
| `.insert(` | `supabaseDispatchCompletionEvidenceStore.ts` | Append-only completion evidence |

No `.update(` / `.delete(` in `src/lib/dispatch-completion/` or `src/lib/dispatch-completion-authority/`.
