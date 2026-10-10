# GOLDEN ORDER PIPELINE MATRIX

**Scope:** Journey C — SO READY → ADVANCE → PRODUCTION → QC & INVOICE → BALANCE → PACKING → DISPATCH → GATEKEEPER → COMPLETE.
**Repos:** `oasisbaklawa2006/oasis-supabase-core` (migrations), `oasisbaklawa2006/Oasis-Baklawa-Central` (UI/RPC callers), both `main`.
**Method:** Read-only code citation. Classification per transition: PROVEN / PARTIALLY PROVEN / UNPROVEN / BROKEN / PHYSICAL-UAT REQUIRED.
**Audit budget note:** Full SQL of Pre-Factory/Finance-Exit chain (SO → clearance → dispatch-gate → delivery/complaint) was read in depth. RGS (production) and 3PGS (packing) migration bodies were **not** read line-by-line this pass — confirmed to exist by filename/grep only. Those sections are explicitly marked NOT FULLY VERIFIED, not fabricated as proven.

---

## 1. SO READY (commercial authority)

| Field | Evidence |
|---|---|
| RPC | `create_sales_order_commercial_version_v1`, `amend_sales_order_commercial_v1`, `promote_sales_order_draft_to_order_governed_v1` |
| Migration | `supabase/migrations/20260827063731_pre_factory_so_commercial_authority.sql` |
| RBAC | `amend_sales_order_commercial_v1` requires `is_internal_staff(auth.uid())`; blocked once order items touch packing/production/dispatch (`SALES_ORDER_ALREADY_ENTERED_OPERATIONS`) |
| Idempotency | `sales_order_commercial_versions.idempotency_key UNIQUE`, advisory xact lock per order, monotonic version numbers, trigger `trg_order_items_governed_commercial_mutation` blocks unscoped mutation |
| Central UI caller | **NOT FOUND** — `amend_sales_order_commercial_v1` has no confirmed caller in Central via code search; WhatsApp draft-promotion path likely fires from an Edge Function/service-role job instead |
| **Classification** | **PARTIALLY PROVEN** — RPC+DB fully proven; UI caller for direct amendment not located |

## 2. SO → ADVANCE (30% payment: PI issuance + payment record/verify)

| Field | Evidence |
|---|---|
| PI RPCs | `create_sales_order_proforma_invoice_v1`, `issue_sales_order_proforma_invoice_v1`, `cancel_sales_order_proforma_invoice_v1` — `20260827204931_pre_factory_pi_authority.sql` |
| Payment RPCs | `record_order_payment_proof_v1`, `verify_order_payment_v1`, `reject_order_payment_v1` — `20260829110000_pre_factory_payment_authority.sql` |
| Advance formula | `calculate_sales_order_advance_v1`: originally `ceil(30%/500)*500`; corrected in `20260830143300_advance_nearest_500_rule_v2.sql` to `greatest(500, round(30%/500)*500)` |
| RBAC | ISSUE/CANCEL PI require Finance role (`FINANCE_HEAD/FINANCE_EXEC/ADMIN/SUPER_ADMIN/OWNER`) + AAL2 step-up (`has_step_up_auth()`); payment verify/reject Finance-only + AAL2 |
| Central UI caller | Payment verify/reject: **CONFIRMED** — `src/lib/finance-authority/financeAuthorityMap.ts` (`/admin/finance-board`), legacy quarantined `/admin/finance`. Clearance decision: **CONFIRMED** — `src/lib/order-authority/financeClearanceAuthorityClient.ts` + `financeHoldReleaseAuthorityClient.ts`, with unit + cert tests. PI create/issue: **NOT FOUND** anywhere in Central |
| Idempotency (duplicate payment) | PROVEN — `ORDER_PAYMENT_REFERENCE_CONFLICT`/`ORDER_PAYMENT_PROOF_CONFLICT` (23505) on reused reference/proof, partial unique indexes excluding rejected rows |
| Adverse path: missing/underpaid | PROVEN — `get_finance_operations_clearance_facts_v1` computes `covered_amount` vs `required_advance`; `decide_finance_operations_clearance_v1` raises `FINANCE_OPERATIONS_CLEARANCE_NOT_FUNDED` (55000) if uncovered |
| **DEFECT** | `get_finance_operations_clearance_facts_v1` (created in `20260830143000`, one migration **before** the `20260830143300` rounding-rule fix) hardcodes `round(value*0.30/500)*500` instead of calling `calculate_sales_order_advance_v1()`. Two live formulas (ceil vs round) disagreed for a window; going forward any change to the canonical advance function will silently NOT propagate to clearance eligibility. DRY violation / drift risk — see JOURNEY_FAILURE_LEDGER FL-GOP-01. |
| **Classification** | **PROVEN** for payment record/verify/reject + clearance decision; **PARTIALLY PROVEN** for PI create/issue (RPC solid, UI caller not located) |

## 3. ADVANCE → PRODUCTION (Finance Operations Clearance → manufacturing release)

| Field | Evidence |
|---|---|
| RPC | `release_order_to_manufacturing_v1` / `release_order_to_in_production_v1` — `20260830143100_pf6c_enforce_clearance_on_operations_release.sql` |
| RBAC | `assert_order_transition_role('release_manufacturing')` (role list not independently re-verified — helper's own definition not read this pass) |
| Guard | `assert_active_operations_clearance_v1` fails closed (55000/40001/P0001) unless clearance GRANTED for the exact current commercial version + PI (stale-version protection) |
| Central UI caller | **CONFIRMED** — `src/lib/order-authority/orderAuthorityClient.ts`, referenced in `orderManagementSurfaceGuard.test.ts` and `tests/factory-operations-order-production-release.cert.spec.ts` |
| Idempotency | Naturally idempotent — returns `already_applied:true` if order already in manufacturing/beyond |
| **Classification** | **PROVEN** |

## 4. PRODUCTION → QC → FINAL INVOICE

| Field | Evidence |
|---|---|
| Production-side (RGS) | `20260817100000_rgs_production_governed_authority.sql`, `20260817110000_rgs_production_lifecycle_completion.sql`, `20260817120000_rgs_production_intake_rpcs.sql`, `20260817130000_rgs_quick_log_production_rpc.sql`, `20260817150000_rgs_authority_hardening.sql` — **NOT read line-by-line**. `rgs_quick_log_production`/`rgs_production_intake` found only in a reconciliation doc, no confirmed live Central caller |
| DPL receipt | `receive_finance_dpl_v1` — `20260830143400_finance_dpl_receipt_authority.sql`. SECURITY DEFINER, `authenticated`. Validates DPL against exact commercial version, per-line qty ≤ ordered, whole-packet SHA-256 fingerprint match (`FINANCE_DPL_FINGERPRINT_MISMATCH`), duplicate/empty-line and duplicate-carton-id rejection — this is the quantity-discrepancy guard, PROVEN at the RPC/DB layer |
| Final Invoice | `issue_final_invoice_v1` — `20260830143500_final_invoice_settlement_authority.sql`. Derives quantities only from the frozen DPL receipt, prices only from the frozen commercial-version snapshot; fails closed on non-zero non-line charges (`FINAL_INVOICE_NON_LINE_CHARGE_TAX_AUTHORITY_REQUIRED` — known gap, not a bug). Invoice + lines immutable (UPDATE/DELETE blocked by trigger) |
| **DEFECT — naming mismatch** | Migration creates `receive_finance_dpl_v1`; Central's `financeAuthorityMap.ts` (`/admin/accounts-release`) references a **differently-named** `receive_submitted_b2b_dispatch_dpls_v1` via `financeExitAuthorityClient.ts`. Not resolved — either two distinct RPCs (a B2B-dispatch-submission-side one feeding the core one) or a stale map reference. See JOURNEY_FAILURE_LEDGER FL-GOP-02. |
| **Classification** | Finance-side DPL receipt + Final Invoice: **PROVEN** (RPC/DB) / **PARTIALLY PROVEN** (UI wiring, pending naming-mismatch resolution). Production→QC (RGS side): **UNPROVEN** — not read, no confirmed Central caller |

## 5. INVOICE → BALANCE PAYMENT

| Field | Evidence |
|---|---|
| Settlement facts | `get_final_settlement_facts_v1`: `net_due = gross_total - verified - wallet - credit`; `settled_for_dispatch = (net_due <= 0.01)` |
| Mechanism | Balance reuses the **same** `record_order_payment_proof_v1`/`verify_order_payment_v1` RPCs as advance (`payment_type='balance'`) — no separate balance-specific RPC |
| Central UI | `/admin/accounts-release` lists `get_sales_order_pi_final_payment_request_v1` / `issue_sales_order_pi_final_payment_request_v1` in `financeAuthorityMap.ts` — **not independently read** this pass |
| **Classification** | **PARTIALLY PROVEN** — settlement math + reused payment RPC proven; final-payment-request RPC pair not read |

## 6. BALANCE → PACKING / E-WAY / DISPATCH CLEARANCE

| Field | Evidence |
|---|---|
| E-way evidence | `record_eway_bill_evidence_v1` — immutable, one decision per invoice (`EWAY_BILL_DECISION_ALREADY_RECORDED`) |
| Finance dispatch clearance | `decide_finance_dispatch_clearance_v1` — requires `settled_for_dispatch=true` + valid/not-required e-way; fails closed (`FINANCE_DISPATCH_CLEARANCE_BALANCE_OUTSTANDING` / `..._EWAY_REQUIRED`). Independent second gate from Operations Clearance — good defense-in-depth, PROVEN |
| Dispatch release | `clear_order_for_dispatch_v1` flips `orders.status → 'cleared_for_dispatch'`, guarded by `assert_active_dispatch_clearance_v1` + `assert_order_transition_role('clear_dispatch')` |
| Central UI | All three RPCs present in `financeAuthorityMap.ts`; `clear_order_for_dispatch_v1` call-site evidence weaker (only the map file matched, no confirmed calling client beyond the declaration) |
| Packing (3PGS) | `20260820100000_3pgs_governed_fulfilment_authority.sql` and related — **NOT read**; no confirmed Central caller found via `"packed_ready"` search |
| **Classification** | Finance dispatch-clearance gate: **PROVEN** (RPC+DB) / **PARTIALLY PROVEN** (UI call-site evidence weaker). Packing/3PGS mechanics: **UNPROVEN** — not read, no wiring located |

## 7. DISPATCH → GATEKEEPER (physical gate release)

| Field | Evidence |
|---|---|
| RPC | `release_carton_at_dispatch_gate_v1` — `20260830143700_gate_dispatch_proof_authority.sql`. Validates scan-evidence exact match, order status, active clearance, carton membership in frozen DPL `carton_ids`, valid e-way. On any blocker writes `dispatch_gate_decisions(decision='denied')` and returns blockers **without raising** — soft-fail with audit trail. Idempotent (`already_released:true` on re-scan) |
| Shipment proof freeze | `record_dispatch_proof_packet_v1` — requires every DPL carton_id to have an independent `released` gate decision; frozen once per order |
| Central UI | `release_carton_at_dispatch_gate_v1`: **CONFIRMED** in `orderAuthorityClient.ts` + unit tests + GHA cert workflow. `record_dispatch_proof_packet_v1`: **CONFIRMED** in `financeExitAuthorityClient.ts` |
| **Classification** | **PROVEN** for both RPCs at the code layer; the physical barcode scan itself is **PHYSICAL-UAT REQUIRED** — cannot be certified by code reading alone |

## 8. GATEKEEPER → COMPLETE (delivery, complaint, closure)

| Field | Evidence |
|---|---|
| Delivery proof | `record_delivery_proof_v1` — `20260830143800_delivery_complaint_remedy_authority.sql`. One per order (unique constraint), `delivered_at >= dispatched_at`, sets 10-day complaint window |
| Complaint filing | `file_commercial_complaint_v1` — buyer (own company) or staff; window-enforced (`COMPLAINT_WINDOW_EXPIRED`); staff late-filing requires AAL2 + reason (`COMPLAINT_LATE_EXCEPTION_AAL2_REQUIRED`) |
| Complaint resolution | `resolve_commercial_complaint_v1` — append-only `commercial_adjustments`, one resolution per complaint, 12 typed remedy types with type-specific evidence (REFUND_TO_WALLET routes through `record_wallet_entry_v1`) |
| **CRITICAL FINDING** | `search_code` for `"delivery_proofs"`, `"commercial_complaints"`, `record_delivery_proof_v1`, `file_commercial_complaint_v1` across **both** `oasis-supabase-core` and `Oasis-Baklawa-Central` returned matches **only inside oasis-supabase-core** (migrations + tests). **Zero matches in Central.** No admin route, no client wrapper, no test references these RPCs/tables in Central. Independently reconfirmed by the Support-journey pass (see SUPPORT_JOURNEY_MATRIX.md), which also found this system has no UI caller in the Buyer app either. |
| Commercial closure | `20260830143900_commercial_closure_financial_projection.sql` — filename confirmed only, content **not read** |
| **Classification** | Delivery proof + complaint filing + resolution RPCs: **fully governed at the DB layer, UNPROVEN at the UI layer — no discoverable caller in Central or Buyer.** This is the single largest gap in the entire pipeline audit. Commercial closure: **UNPROVEN**, not read. |

---

## ADVERSE / EXCEPTION PATHS — SUMMARY

| Path | Classification | Evidence |
|---|---|---|
| Payment missing/underpaid | **PROVEN** | Both clearance gates (`decide_finance_operations_clearance_v1`, `decide_finance_dispatch_clearance_v1`) fail closed (55000) |
| Payment duplicated | **PROVEN** | Partial unique indexes + explicit conflict error codes |
| Order edited/cancelled after SO | **PROVEN** | `SALES_ORDER_ALREADY_ENTERED_OPERATIONS`, `CANCELLED_ORDER_PI_FORBIDDEN`, `SALES_ORDER_PI_FROZEN` triggers |
| Production delayed / QC failed | **UNPROVEN** | RGS SQL not read this pass |
| Quantity discrepancy | **PROVEN** at Finance/DPL boundary (`receive_finance_dpl_v1`, `issue_final_invoice_v1` cross-validation); **UNPROVEN** at packing/3PGS stage |
| Packing discrepancy (3PGS) | **UNPROVEN** | File not read |
| Dispatch failure/abort | **PARTIALLY PROVEN** | Gate RPC soft-fails with audit trail; no explicit "abort after clearance" reversal RPC found, only Finance-side clearance REVOKE |
| Duplicate click/idempotency | **PROVEN** broadly | `p_idempotency_key` + fingerprint pattern applied consistently across nearly every governed RPC in the pipeline |
| Concurrent staff action | **PROVEN** | `pg_advisory_xact_lock` scoped keys throughout, plus `STALE_SALES_ORDER_VERSION` (40001) optimistic-concurrency checks |
| Session expiry mid-action | **PARTIALLY PROVEN** | AAL2 step-up re-checked per privileged call; step-up refresh/expiry mechanics not verified |

---

## NOT COVERED THIS PASS (explicit, not silently assumed proven)

- Full SQL: `20260817090000`–`20260817160000` RGS range, `20260818090000_rgs_six_tv_department_correction.sql`, `20260819100000`/`101000_fwd_rgs_*`, `20260820100000_3pgs_governed_fulfilment_authority.sql` + related 3PGS files, `20260822085000`–`20260822160000` 3PGS/dispatch range, dispatch shipment/consignment/carton-creation RPC bodies, `20260901100000_fact_dispatch_source_acceptance.sql`, `20260902083000_final_payment_pi_revision_authority.sql`, `20260830143900_commercial_closure_financial_projection.sql`, `20260830143650_dispatch_gate_lineage_metadata.sql`.
- `assert_order_transition_role()`'s defining migration (role list per transition unverified beyond transition-name strings observed).
- Not every Central route/component exhaustively checked for RPC call sites — relied on GitHub code search (reliable for literal matches, could miss dynamically-constructed RPC names).
