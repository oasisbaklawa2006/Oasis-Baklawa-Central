# Governance Boards E2E Evidence Runbook - 2026-07-07

Generated: 2026-07-07
Scope: `oasisbaklawa2006/Oasis-Baklawa-Central`, the 5 governance-board admin screens flagged in `GOVERNANCE_BOARD_EVIDENCE_CAPTURE.md` as needing runtime evidence before any `BUILT_VALIDATED` claim.

## Purpose

This runbook exists to prepare — not perform — real runtime validation of the 5 governance-board screens. It is the controlled procedure a human (or an AI engine with explicit human approval at each mutating step) follows to walk one real test order through each board and record what actually happened.

**No mutation has been executed as part of producing this document.** No Supabase query was run. No order was selected. No registry status has been changed. This document defines the *how*, not the *result*. A board may only be upgraded from `BUILT_NEEDS_EVIDENCE` to `BUILT_VALIDATED` after this runbook has actually been executed against a real order, the Evidence Template below has been filled in with real values, and a human has reviewed the result — never as a byproduct of writing or reading this runbook itself.

---

## Target Screens

| Route | Component | Current status | Required evidence to validate |
|---|---|---|---|
| `/admin/dispatch-readiness` | `DispatchReadinessBoard.tsx` | `BUILT_NEEDS_EVIDENCE` | A real order shows up as a live card (not a preview card); "Record readiness review (evidence)" produces a real `dispatch_readiness_evidence` row; UI reflects the new evidence after `boardState.reload()`. |
| `/admin/dispatch-completion` | `DispatchCompletionBoard.tsx` | `BUILT_NEEDS_EVIDENCE` | Same order (post-readiness) shows correct prerequisite checklist; Step 1 review and Step 2 attest each produce a real `dispatch_completion_evidence` row; attestation does not change `orders.status`. |
| `/admin/dispatch-finalization` | `DispatchFinalizationBoard.tsx` | `BUILT_NEEDS_EVIDENCE` | Same order (post-completion) shows `canFinalize: true`; "Finalize dispatch (governed)" produces a real `dispatch_release_lineage` row AND updates `orders.status` to `dispatched`; this is the one screen where a real, observable order-status change is the evidence. |
| `/admin/stock-finalization` | `StockFinalizationBoard.tsx` | `BUILT_NEEDS_EVIDENCE` | Same order (post-finalization, `orders.status = dispatched`) appears as a stock-finalization candidate; "Finalize consumption" produces a real `stock_consumption_lineage` row and correctly decrements the matching `inventory_stock_balances` row via the `expectedBalanceVersion` optimistic-lock path; board must show `persistenceLabel = "Supabase persistence"`, not demo mode. |
| `/admin/finance-governance` | `FinanceGovernanceBoard.tsx` | `BUILT_NEEDS_EVIDENCE` | A real order shows a live card; Step 1 review and Step 2 commercial release each produce a real `finance_review_evidence` row; neither step captures payment or generates an invoice. |

---

## Test Order Selection Criteria

An order is only eligible for this runbook if **all** of the following hold:

1. **Test/internal order only.** Created specifically for this evidence pass, or an existing order already known to be non-live/test data (e.g. seeded staging data). Never a real customer's in-flight order.
2. **Not a customer live order.** If the environment has no dedicated test-order mechanism, this runbook must be run in a staging/non-production Supabase project, or explicitly deferred until one exists — do not run it against production customer data to "see what happens."
3. **Reversible or low-risk where possible.** Prefer an order whose `dispatch_release_lineage`/`dispatch_readiness_evidence`/etc. rows can be identified and, if necessary, manually corrected afterward by someone with direct database access. The one genuinely hard-to-reverse step is `DispatchFinalizationBoard`'s `orders.status → dispatched` transition — treat this as the point of no easy return in the sequence and get explicit sign-off before it.
4. **Order ID recorded before any action.** Capture the full order UUID (not just the last-4-digit display fragment shown in the UI) before touching any board.
5. **Not invoice/dispatch/stock-critical live production order.** Must not be an order any real customer, finance team member, or warehouse operator is actively relying on for real fulfillment, payment, or delivery tracking.

If no such order exists yet, the first sub-step of execution is creating one (out of scope for this document — that decision belongs to whoever executes the runbook, with human approval, not to this planning pass).

---

## Read-Only Preflight

Before touching any board, capture and record all of the following for the selected test order:

- **Order ID** (full UUID).
- **Current `orders.status`** (exact string value from the `orders` table).
- **Current `orders.sales_order_value`, `advance_required`, `advance_paid`, `payment_status`** — these feed the finance-signal fusion used by multiple boards.
- **Existing `dispatch_readiness_evidence` rows** for this order (if any) — type, status, timestamp.
- **Existing `dispatch_completion_evidence` rows** for this order (if any).
- **Existing `finance_review_evidence` rows** for this order (if any).
- **Existing `dispatch_release_lineage` rows** for this order (if any) — release_type, next_status.
- **Existing `operational_scan_records` rows** for this order (if any) — scan_type, verification_status, barcode_value.
- **Existing `inventory_reservations` rows** for this order (if any) — reservation_number, reserved_qty, reservation_status.
- **Existing `stock_consumption_lineage` rows** for this order (if any).
- **The matching `inventory_stock_balances` row(s)** for the order's SKU(s) at the relevant `location_code` — record `available_qty`, `reserved_qty`, and `version` (the optimistic-lock field `StockFinalizationBoard` depends on).
- **Which env flags are active**: `VITE_EXECUTION_PREVIEW_FALLBACK` (should be unset/false for a real evidence run — if true, live rows are still preferred over preview, but keeping it off avoids ambiguity) and `VITE_STOCK_FINALIZATION_DEMO` (must be unset/false — demo mode uses an in-memory service and produces no real evidence).
- **Timestamp of preflight capture** (so before/after can be compared against a known baseline).

All of the above should be captured via the read-only SQL templates below, before any board's UI is opened for a mutating action.

---

## Screen-by-Screen Evidence Checklist

### 1. `/admin/dispatch-readiness`
- **URL:** `/admin/dispatch-readiness`
- **Expected load result:** Board loads without error; `GovernanceBoardLiveNotice` shows either the live-signals line or (if the test order isn't yet in the `cleared_for_dispatch` / `packed_ready` / `ready_for_dispatch` / `awaiting_final_payment` status set) the empty-live message.
- **Live/preview/empty state expected:** **Live**, showing the real test order as a card — not a preview card. If it shows a preview card, the order does not currently match the loader's `orders.status` filter and must be adjusted (or a different order chosen) before evidence is meaningful.
- **Exact UI evidence to capture:** Screenshot or copy of the order's card (readiness status badge, gate-eligibility badge, missing-requirements list); the "Record readiness review (evidence)" button's enabled/disabled state and the reason shown if disabled.
- **Exact table/row evidence to capture if applicable:** New row in `dispatch_readiness_evidence` after clicking review — `id`, `evidence_type`, `evidence_status`, `created_at`.
- **Read-only or mutating:** Mutating (evidence-only, append-only; no `orders.status` change).
- **Risk level:** Low-Medium.

### 2. `/admin/dispatch-completion`
- **URL:** `/admin/dispatch-completion`
- **Expected load result:** Loads without error; shows the same test order once readiness evidence exists.
- **Live/preview/empty state expected:** Live.
- **Exact UI evidence to capture:** Prerequisite checklist state (all 7 checks, e.g. "Readiness gate_eligible", "Finance signal ready"); Step 1 / Step 2 button enabled/disabled states and any blocking-reason text.
- **Exact table/row evidence to capture if applicable:** New rows in `dispatch_completion_evidence` after Step 1 (review) and Step 2 (attest) — `id`, `evidence_type`, `evidence_status`, `evidence_ref`, `created_at`.
- **Read-only or mutating:** Mutating (evidence-only; screen's own banner confirms it does not set `orders.status`).
- **Risk level:** Low-Medium.

### 3. `/admin/dispatch-finalization`
- **URL:** `/admin/dispatch-finalization`
- **Expected load result:** Loads without error; shows the same test order once completion evidence exists.
- **Live/preview/empty state expected:** Live.
- **Exact UI evidence to capture:** `canFinalize` state and blocker list before the action; "Finalize dispatch (governed)" button state; the `dispatch_release_lineage` release-type/status shown post-action; the customer-publication text preview (a real derived preview, not fake data).
- **Exact table/row evidence to capture if applicable:** New row in `dispatch_release_lineage` (`release_type`, `next_status`, `gate_reference`, `completion_reference`, `transporter_reference`, `created_at`); **and** the `orders.status` value for this order **before and after** — this is the one screen where the before/after order-status diff itself is the primary evidence.
- **Read-only or mutating:** **Real status mutation.** This is the single most consequential action in the whole runbook.
- **Risk level:** **High** — proceed only with explicit human approval on the specific test order, per the Mutation Permission Gates section below.

### 4. `/admin/stock-finalization`
- **URL:** `/admin/stock-finalization`
- **Expected load result:** Loads without error; order appears in the candidate list only after `orders.status = dispatched` (set by step 3 above) and `dispatch_release_lineage` shows a finalize/dispatched row.
- **Live/preview/empty state expected:** Live candidate row in the order selector (not the "Dispatch finalized (ready)" / "Pre-finalization (blocked)" preview-toggle buttons, which only appear when `showPreviewCards` is true).
- **Exact UI evidence to capture:** `persistenceLabel` value (must read "Supabase persistence", not "Demo in-memory (non-production)"); reconciliation status, consumable qty, and any `finalizeBlockers` shown before the action; success/failure `message` text after clicking "Finalize consumption".
- **Exact table/row evidence to capture if applicable:** New row in `stock_consumption_lineage`; the matching `inventory_stock_balances` row's `available_qty`/`reserved_qty`/`version` **before and after** (version must increment, confirming the optimistic-lock write path was exercised, not bypassed).
- **Read-only or mutating:** **Stock persistence action** — real inventory-balance mutation.
- **Risk level:** **High** — proceed only with explicit human approval, and only in real Supabase persistence mode (confirm `VITE_STOCK_FINALIZATION_DEMO` is not `true` in the environment used for this test).

### 5. `/admin/finance-governance`
- **URL:** `/admin/finance-governance`
- **Expected load result:** Loads without error; shows the test order as a live card (this board's loader is also the shared upstream finance-signal source the other 4 boards consume, so it is reasonable to validate this one first or in parallel with readiness).
- **Live/preview/empty state expected:** Live.
- **Exact UI evidence to capture:** Release-status badge, commercial-risk badge, dispatch-signal badge, gate-eligible badge; any persisted `finance_review_evidence` list shown in the card; Step 1 / Step 2 button states.
- **Exact table/row evidence to capture if applicable:** New rows in `finance_review_evidence` after Step 1 (`review_type = credit_review`) and Step 2 (`review_type = commercial_release`, `review_status = released`) — `id`, `review_type`, `review_status`, `created_at`.
- **Read-only or mutating:** Mutating (evidence-only; screen's own text confirms neither step dispatches or captures payment).
- **Risk level:** Low-Medium.

---

## Mutation Permission Gates

| Category | Screens | Rule |
|---|---|---|
| Read-only evidence only | None of the 5 — every board has at least one write action | N/A |
| Append-only evidence action | `DispatchReadinessBoard`, `DispatchCompletionBoard`, `FinanceGovernanceBoard` | Writes only to a dedicated `*_evidence` table; never touches `orders.status` or stock. Still requires human awareness before running (it is a real write), but the blast radius is a single audit row. |
| Real status mutation | `DispatchFinalizationBoard` | Writes `dispatch_release_lineage` **and** changes `orders.status` to `dispatched`. This is the hardest-to-casually-reverse step in the chain. |
| Stock persistence action | `StockFinalizationBoard` | Writes `stock_consumption_lineage` **and** decrements a real `inventory_stock_balances` row. Financial/inventory consequence; must run in real persistence mode, not demo mode, for the evidence to count. |

**Hard rule: no mutation action in this runbook may be executed unless a human has explicitly approved both the selected test order (by its recorded order ID) and the specific action about to be taken, immediately before that action is taken.** This applies to every category above, including the append-only ones — "explicit approval" for those can be a single upfront approval covering the low-risk evidence writes, but the real-status-mutation and stock-persistence steps each require their own explicit, separate approval at the time they are about to run, not a blanket approval given at the start of the session.

---

## Supabase Verification Queries

Read-only templates only. No destructive SQL. No secrets or service-role keys are included or required — these are `select` statements intended to be run with the same read access the app itself uses. Replace `<ORDER_ID>` with the approved test order's UUID before running any of these.

```sql
-- Preflight: current order status and finance-relevant fields
select id, status, sales_order_value, advance_required, advance_paid, payment_status, created_at, is_waste
from orders
where id = '<ORDER_ID>';

-- Dispatch readiness evidence for this order
select id, order_id, evidence_type, evidence_status, evidence_ref, created_at
from dispatch_readiness_evidence
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Dispatch completion evidence for this order
select id, order_id, evidence_type, evidence_status, evidence_ref, created_at
from dispatch_completion_evidence
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Finance review evidence for this order
select id, order_id, review_type, review_status, created_at
from finance_review_evidence
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Dispatch release lineage for this order (finalization evidence + order-status transitions)
select id, order_id, release_type, next_status, gate_reference, completion_reference, transporter_reference, created_at
from dispatch_release_lineage
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Operational scan records for this order (gate/carton scan evidence)
select order_id, scan_type, verification_status, barcode_value, created_at
from operational_scan_records
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Inventory reservations linked to this order
select id, reservation_number, order_id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status
from inventory_reservations
where order_id = '<ORDER_ID>';

-- Stock consumption lineage for this order (stock-finalization evidence)
select order_id, reservation_id, lineage_type, created_at
from stock_consumption_lineage
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Stock balance row(s) for the order's SKU(s) — replace <SKU> and <LOCATION_CODE>
-- with the values read from the inventory_reservations query above.
-- Record available_qty / reserved_qty / version BEFORE and AFTER the
-- Stock Finalization Board action — "version" must increment on a
-- successful optimistic-lock write.
select product_id, sku, location_code, available_qty, reserved_qty, version
from inventory_stock_balances
where sku = '<SKU>' and location_code = '<LOCATION_CODE>';
```

Do not run any `insert`, `update`, `delete`, or `upsert` statement as part of this runbook. All state changes must happen through the actual board UI, so that the evidence captured reflects the real application write path (including its role checks, `canExecuteWrites` gating, and service-layer validation) — not a hand-written SQL shortcut that would bypass the very code this evidence pass exists to validate.

---

## Evidence Template

Blank tables for recording actual results. Duplicate a row per screen tested. Leave every cell blank until the corresponding real action has been taken — do not pre-fill with expected values.

### Dispatch Readiness

| Field | Value |
|---|---|
| route | `/admin/dispatch-readiness` |
| tested_at | |
| tester | |
| order_id | |
| before state | |
| action taken | |
| after state | |
| row id / audit id / evidence id | |
| screenshot reference if any | |
| result | |
| notes | |

### Dispatch Completion

| Field | Value |
|---|---|
| route | `/admin/dispatch-completion` |
| tested_at | |
| tester | |
| order_id | |
| before state | |
| action taken | |
| after state | |
| row id / audit id / evidence id | |
| screenshot reference if any | |
| result | |
| notes | |

### Dispatch Finalization

| Field | Value |
|---|---|
| route | `/admin/dispatch-finalization` |
| tested_at | |
| tester | |
| order_id | |
| before state (include `orders.status`) | |
| action taken | |
| after state (include `orders.status`) | |
| row id / audit id / evidence id | |
| screenshot reference if any | |
| result | |
| notes | |

### Stock Finalization

| Field | Value |
|---|---|
| route | `/admin/stock-finalization` |
| tested_at | |
| tester | |
| order_id | |
| before state (include stock balance version) | |
| action taken | |
| after state (include stock balance version) | |
| row id / audit id / evidence id | |
| screenshot reference if any | |
| result | |
| notes | |

### Finance Governance

| Field | Value |
|---|---|
| route | `/admin/finance-governance` |
| tested_at | |
| tester | |
| order_id | |
| before state | |
| action taken | |
| after state | |
| row id / audit id / evidence id | |
| screenshot reference if any | |
| result | |
| notes | |

---

## Pass / Fail Criteria

For each of the 5 boards:

- **`BUILT_VALIDATED`** — only when the Evidence Template row for that screen is fully filled in with real values, the recorded row IDs have been independently confirmed via the read-only verification query, the UI showed the correct before/after state, no unexpected error occurred, and a human has reviewed the filled-in evidence and agrees it demonstrates the full path (UI action → real database write → UI reflects the change).
- **`BUILT_NEEDS_EVIDENCE`** (current status for all 5) — remains the status until the above is complete. This is not a failure state; it is the honest default until proof exists.
- **`PARTIAL`** — would apply only if, during the runbook, the evidence reveals that some sub-path is real but another is not (e.g. the UI writes evidence correctly but the read model never reflects it back, or a documented forbidden action turns out to be reachable). Downgrade to `PARTIAL` with a specific note of what's broken, rather than leaving the stale `BUILT_NEEDS_EVIDENCE` label if a real gap is found.
- **`BLOCKED`** — would apply only if the runbook cannot proceed at all for structural reasons (e.g. no test order can be safely created, the Supabase environment used has no write access, or a prerequisite table genuinely does not exist in the target environment as confirmed by the `probeTable()` checks each loader already performs). None of the 5 are expected to hit this today based on the code-level evidence already captured in `GOVERNANCE_BOARD_EVIDENCE_CAPTURE.md`, but the runbook execution may discover otherwise.

If a real bug is discovered while executing this runbook, stop, record it in the "notes" field of the relevant Evidence Template row, and report it separately rather than silently patching code in the same pass — this keeps evidence-capture and bug-fixing as distinct, separately-reviewed pieces of work per this project's Quality Gates and Cursor Cost Control policies.

---

## Final Registry Update Rule

`SCREEN_REGISTRY.md` status for any of these 5 rows (#73, #122, #123, #124, #125) may only be changed to `BUILT_VALIDATED` **after** this runbook has actually been executed against a real order, the corresponding Evidence Template section above has been filled in with real, verifiable values, and a human has reviewed and approved the result. Producing or reading this runbook document is not evidence. No registry row is changed by this document — that update, if and when it happens, belongs to the PR that actually executes the runbook and records real results.
