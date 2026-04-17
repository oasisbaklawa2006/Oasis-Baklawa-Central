---
name: Credit Rescue & Month-End Lock Protocol
description: System Credit Lock with 70% rescue unlock, accrued tracking, month-end auto-freeze, and 28th soft ledger
type: feature
---

# Credit Rescue Protocol

## Schema (companies)
- `is_frozen` (bool) — when TRUE, buyer dashboard blocked + DB trigger rejects new orders
- `total_outstanding` (numeric) — auto-maintained via triggers on orders + order_payments
- `rescue_payment_date` (timestamptz) — set when 70% rescue threshold met
- `settlement_deadline` (timestamptz) — last second of current IST month after rescue

## Triggers
- `update_outstanding_on_order` — adds sales_order_value when credit order leaves draft/cart, reverses on cancel
- `handle_credit_payment` — reduces outstanding on payment; auto-unlocks if `payment_type='rescue'` and cumulative ≥70% of frozen balance
- `block_orders_when_frozen` — BEFORE INSERT/UPDATE on orders raises P0001 'CREDIT_FROZEN' if company is frozen (allows draft/cart only)

## RPCs
- `manual_unlock_credit(_company_id, _notes)` — staff-only, sets is_frozen=false + month-end deadline, logs to credit_rescue_events
- `run_month_end_credit_lock()` — called by cron on 1st 00:01 IST; freezes all credit companies with outstanding > 0

## Cron jobs (register via SQL Editor)
- `credit-month-end-lock` — `31 18 L * *` UTC (= 00:01 IST 1st) → calls `run_month_end_credit_lock` RPC
- `rescue-ledger-28th` — `30 22 28 * *` UTC (= 04:00 IST 29th) → calls `generate-rescue-ledger` edge function

## UI
- `CreditLockOverlay` mounted in AppShell → shows full-screen lock to buyers when company.is_frozen; staff bypass; realtime unlock without refresh
- `LedgerDisputesPanel` (AdminFinance → Ledger tab) → per-company status chip (FROZEN/ACCRUED/CLEAR), Verify 70% button (calls manual_unlock + triggers rescue ledger), Freeze button

## Edge functions
- `generate-rescue-ledger` — soft-tone PDF showing rescue balance + accrued purchases since rescue_payment_date; sent via Click2API; cron on 28th targets all credit companies with outstanding > 0

## Audit
- `credit_rescue_events` table logs: frozen, rescue_payment, unlocked, month_end_lock, manual_override
