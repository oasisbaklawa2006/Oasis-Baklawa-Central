# Governance Boards E2E Read-Only Preflight Selection - 2026-07-07

Generated: 2026-07-07
Scope: `oasisbaklawa2006/Oasis-Baklawa-Central`, the 5 governance-board admin screens covered by `GOVERNANCE_BOARDS_E2E_EVIDENCE_RUNBOOK.md`.

## Purpose

This is the **final read-only gate** before any real evidence execution against the 5 governance boards. Everything in this document is inspection only — no order has been selected yet, no mutation has been run, no registry status has changed, and nothing here constitutes evidence. Its job is to give a human everything needed to look at real candidate orders, pick exactly one safe order, and formally record approval for which specific write actions may be executed against it — before anyone opens a board and clicks a mutating button.

This document does not replace `GOVERNANCE_BOARDS_E2E_EVIDENCE_RUNBOOK.md`; it is the concrete selection step that runbook's "Test Order Selection Criteria" and "Read-Only Preflight" sections describe in the abstract. Once a human has selected and approved an order here, execution proceeds using the runbook's Screen-by-Screen Evidence Checklist, Supabase Verification Queries, and Evidence Template.

---

## Required Validation Order

This order is fixed by `GOVERNANCE_BOARDS_E2E_EVIDENCE_RUNBOOK.md` (corrected after a Bugbot finding on PR #213 — Finance Governance must run before Dispatch Completion, since Completion's Step 2 attestation depends on Finance Governance's commercial-release evidence already existing):

1. Dispatch Readiness (`/admin/dispatch-readiness`)
2. Finance Governance (`/admin/finance-governance`)
3. Dispatch Completion (`/admin/dispatch-completion`)
4. Dispatch Finalization (`/admin/dispatch-finalization`)
5. Stock Finalization (`/admin/stock-finalization`)

---

## Safe Test Order Criteria

A candidate order is only eligible for selection if it is:

- **Internal/test only** — created specifically for this evidence pass, or existing seeded/staging data already known to be non-live.
- **Not customer-critical** — no real customer is currently relying on this order for delivery, communication, or account history.
- **Not invoice-critical** — no invoice has been issued or is pending issuance against this order that a real finance workflow depends on.
- **Not dispatch-critical** — no warehouse/dispatch team is currently tracking this order for a real shipment.
- **Not stock-critical unless explicitly approved** — the order should not hold a reservation against scarce/high-demand real inventory unless a human has explicitly approved consuming that specific stock as part of this test. Prefer an order against low-consequence or clearly-test SKUs if one exists.
- **Safe to snapshot before/after** — its current state (status, evidence rows, reservations, stock balances) can be fully captured before any action, so any change is attributable and reviewable.
- **Safe to abandon if validation fails** — if a board behaves unexpectedly partway through the sequence, the order can be left in whatever partial state results without harming a real business process. This rules out orders where a partial state (e.g. `dispatch_readiness_evidence` written but completion never reached) would itself cause confusion for a real operator later.

If no such order currently exists, the first sub-step of execution — not of this preflight — is creating one. That decision, and the decision of *how* to create it, belongs to whoever executes the runbook with human approval, not to this read-only planning pass.

---

## Candidate Order Selection Queries

Read-only templates only. No secrets, no service-role keys, no destructive SQL — every statement below is a plain `select`. Run these first with no `<ORDER_ID>` filter to browse candidates, then re-run the order-specific queries once a candidate is chosen.

```sql
-- Step 1: Browse recent orders to find a candidate — id, status, customer, date.
-- Prefer orders NOT already at a late pipeline status (dispatched / cleared_for_dispatch
-- with existing lineage) so the full 5-board sequence can be walked from a clean state.
select
  o.id,
  o.order_number,
  o.status,
  o.company_id,
  c.business_name as customer_name,
  o.sales_order_value,
  o.advance_required,
  o.advance_paid,
  o.payment_status,
  o.is_waste,
  o.created_at
from orders o
left join companies c on c.id = o.company_id
order by o.created_at desc
limit 25;

-- Step 2: Order lines/items for a specific candidate.
-- replace <ORDER_ID> after candidate selection
select
  oi.id,
  oi.quantity,
  oi.pack_size,
  oi.actual_packed_qty,
  oi.production_status,
  p.name as product_name
from order_items oi
left join products p on p.id = oi.product_id
where oi.order_id = '<ORDER_ID>';

-- Step 3: Dispatch readiness evidence already on file for this candidate
-- replace <ORDER_ID> after candidate selection
select id, order_id, evidence_type, evidence_status, evidence_ref, created_at
from dispatch_readiness_evidence
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Step 4: Finance governance evidence already on file for this candidate
-- replace <ORDER_ID> after candidate selection
select id, order_id, review_type, review_status, created_at
from finance_review_evidence
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Step 5: Dispatch completion evidence already on file for this candidate
-- replace <ORDER_ID> after candidate selection
select id, order_id, evidence_type, evidence_status, evidence_ref, created_at
from dispatch_completion_evidence
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Step 6: Dispatch finalization status — lineage rows and current order status together.
-- If any row here already shows next_status = 'dispatched', this order has already
-- been through finalization and is NOT a clean candidate for a fresh walkthrough
-- (see Stop Conditions below).
-- replace <ORDER_ID> after candidate selection
select id, order_id, release_type, next_status, gate_reference, completion_reference, transporter_reference, created_at
from dispatch_release_lineage
where order_id = '<ORDER_ID>'
order by created_at desc;

-- Step 7: Stock finalization mode/evidence — reservations, consumption lineage, and
-- the matching stock balance rows. If stock_consumption_lineage already has rows for
-- this order, stock has already been deducted for it (see Stop Conditions below).
-- replace <ORDER_ID> after candidate selection
select id, reservation_number, order_id, product_id, sku, requested_qty, reserved_qty, fulfilled_qty, released_qty, reservation_status
from inventory_reservations
where order_id = '<ORDER_ID>';

-- replace <ORDER_ID> after candidate selection
select order_id, reservation_id, lineage_type, created_at
from stock_consumption_lineage
where order_id = '<ORDER_ID>'
order by created_at desc;

-- replace <SKU> and <LOCATION_CODE> with values read from the inventory_reservations
-- query above, once a candidate order and its SKU(s) are known.
select product_id, sku, location_code, available_qty, reserved_qty, version
from inventory_stock_balances
where sku = '<SKU>' and location_code = '<LOCATION_CODE>';

-- Step 8: Audit/scan rows and timestamps — operational scan records tied to this order,
-- useful for confirming gate/carton scan evidence already exists or is missing.
-- replace <ORDER_ID> after candidate selection
select order_id, scan_type, verification_status, barcode_value, created_at
from operational_scan_records
where order_id = '<ORDER_ID>'
order by created_at desc;
```

No `insert`, `update`, `delete`, or `upsert` statement appears anywhere in this document. All state changes must happen through the actual board UI once an order is approved, per the runbook's own rule — this preflight is inspection only.

---

## Human Approval Gate

Blank until a human fills it in. No mutation may be executed against the selected order until every relevant field below is filled and the approval is explicit — a blank or partially-filled row means no approval exists yet.

| Field | Value |
|---|---|
| selected_order_id | |
| selected_by | |
| approval_time | |
| approved screens | |
| explicitly approved append-only writes (Dispatch Readiness, Finance Governance, Dispatch Completion): yes/no | |
| explicitly approved status mutation (Dispatch Finalization — `orders.status → dispatched`): yes/no | |
| explicitly approved stock persistence (Stock Finalization — real balance deduction): yes/no | |

Per the runbook's Mutation Permission Gates: the three append-only approvals may be covered by a single upfront "yes," but the status-mutation and stock-persistence approvals must each be their own explicit "yes," confirmed at the time that specific action is about to run — not assumed from the append-only approval alone.

---

## Evidence Capture Plan

For each board, in the required order:

### 1. Dispatch Readiness (`/admin/dispatch-readiness`)
- **What to open:** The board with the approved order visible as a live card.
- **What to screenshot:** The order's readiness card (status badge, gate-eligibility badge, missing-requirements list) before and after clicking "Record readiness review (evidence)."
- **What row/table evidence to capture:** New row in `dispatch_readiness_evidence` — `id`, `evidence_type`, `evidence_status`, `created_at`.
- **Write type:** Append-only evidence.
- **Must be confirmed before proceeding:** The order actually appears as a **live** card, not a preview card (confirms the loader's `orders.status` filter matched); the new evidence row is visible via the Candidate Order Selection Step 3 query re-run.

### 2. Finance Governance (`/admin/finance-governance`)
- **What to open:** The board with the same order visible as a live card.
- **What to screenshot:** Release-status/commercial-risk/dispatch-signal/gate-eligible badges before and after Step 1 (review) and Step 2 (commercial release).
- **What row/table evidence to capture:** New rows in `finance_review_evidence` for `review_type = credit_review` then `review_type = commercial_release, review_status = released`.
- **Write type:** Append-only evidence.
- **Must be confirmed before proceeding:** Step 2's commercial-release row actually exists (re-run Step 4 query) — this is the hard prerequisite Dispatch Completion needs next.

### 3. Dispatch Completion (`/admin/dispatch-completion`)
- **What to open:** The board with the same order, after readiness and finance-governance evidence both exist.
- **What to screenshot:** The full 7-item prerequisite checklist (must show "Finance commercially released" as satisfied); Step 1 / Step 2 button states before and after each click.
- **What row/table evidence to capture:** New rows in `dispatch_completion_evidence` for the review step then the attest step.
- **Write type:** Append-only evidence.
- **Must be confirmed before proceeding:** Step 2 (attest) actually became enabled — if it did not, stop and check the Finance Governance evidence from step 2 above rather than assuming Dispatch Completion is broken (this was the exact sequencing bug PR #213 fixed at the runbook-ordering level; the same trap applies at execution time).

### 4. Dispatch Finalization (`/admin/dispatch-finalization`)
- **What to open:** The board with the same order, after completion evidence exists. **Confirm the Human Approval Gate's status-mutation approval is explicitly "yes" before clicking anything here.**
- **What to screenshot:** `canFinalize` state and blocker list before the action; the order's `orders.status` value immediately before and immediately after clicking "Finalize dispatch (governed)."
- **What row/table evidence to capture:** New row in `dispatch_release_lineage`; the `orders.status` before/after diff itself (re-run the Step 1 candidate query to confirm the new status).
- **Write type:** **Real status mutation** — the one hard-to-reverse step in the sequence.
- **Must be confirmed before proceeding:** The status-mutation approval box in the Human Approval Gate is filled "yes" for this specific order, immediately before this action — not inferred from an earlier approval.

### 5. Stock Finalization (`/admin/stock-finalization`)
- **What to open:** The board with the same order, after `orders.status = dispatched`. **Confirm the Human Approval Gate's stock-persistence approval is explicitly "yes," and confirm `persistenceLabel` reads "Supabase persistence" (not demo mode), before clicking anything here.**
- **What to screenshot:** Reconciliation status, consumable qty, and any `finalizeBlockers` before the action; the success/failure message after clicking "Finalize consumption."
- **What row/table evidence to capture:** New row in `stock_consumption_lineage`; the matching `inventory_stock_balances` row's `available_qty` / `reserved_qty` / `version` before and after (version must increment).
- **Write type:** **Stock persistence action** — real inventory-balance mutation.
- **Must be confirmed before proceeding:** The stock-persistence approval box is filled "yes" for this specific order, immediately before this action, and the board is confirmed to be in real Supabase persistence mode.

---

## Stop Conditions

Stop immediately, do not proceed to the next board or the next action, and report the exact state observed, if any of the following occur:

- **Wrong customer/order** — the order visible in the UI does not match the `selected_order_id` recorded in the Human Approval Gate.
- **Real customer order selected** — evidence surfaces (e.g. a recognizable real `business_name`, a real-looking order value, or any other signal) that the selected order is not actually internal/test data.
- **Status already dispatched/finalized** — the Candidate Order Selection Step 6 query shows an existing `next_status = 'dispatched'` row for this order before Dispatch Finalization has even been opened; this order is not a clean candidate.
- **Stock already deducted** — the Step 7 query shows existing `stock_consumption_lineage` rows for this order before Stock Finalization has been opened.
- **Finance/commercial signal missing before Dispatch Completion** — Dispatch Completion's Step 2 (attest) button is disabled and the prerequisite checklist shows "Finance commercially released" as unmet, after Finance Governance's Step 2 has already been completed and confirmed via the database query. This indicates a real gap between the UI and the data, not a sequencing mistake, and must be reported rather than worked around.
- **Any unexpected mutation** — any table changes that were not the direct, intended result of the specific button just clicked (e.g. an unrelated row appears in an unrelated table, or a second order's data changes).
- **Any RLS/auth error** — any "permission denied," unexpected empty result where data was expected, or authentication failure while using the approved tester's normal role-based access.

On any stop condition, halt the sequence, do not attempt to "fix forward" by running additional actions to compensate, and record what was observed in the Evidence Template's `notes` field for the relevant board (once evidence capture begins per the runbook) or in a preflight addendum if the stop happens during this selection phase itself.

---

## Next Step After This Preflight

After a human has selected one candidate order using the queries above, filled in the Human Approval Gate with explicit approvals, and confirmed no Stop Condition applies to that order — create and fill in `.ai-intent/GOVERNANCE_BOARDS_E2E_EVIDENCE.md`, following `GOVERNANCE_BOARDS_E2E_EVIDENCE_RUNBOOK.md`'s Screen-by-Screen Evidence Checklist and Evidence Template, walking the 5 boards in the required order above. Only after that file is filled with real, verifiable values and reviewed by a human should any of the 5 `SCREEN_REGISTRY.md` rows (#73, #122, #123, #124, #125) be considered for a `BUILT_VALIDATED` status change — and that change belongs to the PR that records the real evidence, not to this preflight document or to any prior planning-only pass.
