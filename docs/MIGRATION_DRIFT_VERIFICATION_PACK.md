# Migration Drift Verification Pack

**Date:** 2026-06-09  
**Method:** Static — `supabase/migrations/`, `supabase/functions/`, frontend/backend grep. **No `db push`, no SQL apply, no production connection.**

**Drift context:** `docs/SUPABASE_MIGRATION_DRIFT_REPORT.md` — remote/local migration history mismatch blocks `db push`. Objects below may exist in repo SQL but **remote presence is unverified** here unless noted in staging evidence docs.

---

## 1. Relevant migration files (in scope)

| # | File | Scope |
|---|------|--------|
| 1 | `20260525230000_execution_os_phase3a3d_foundation.sql` | Phase 3A/3D queues + events |
| 2 | `20260526010000_execution_os_phase3c_barcode_execution.sql` | Barcode / scan records |
| 3 | `20260526020000_execution_os_phase3i_operational_search_index.sql` | Operational search index |
| 4 | `20260526030000_execution_os_phase4a_inventory_reservation.sql` | Inventory reservations |
| 5 | `20260526120000_execution_os_phase4b_dispatch_readiness.sql` | Dispatch readiness evidence |
| 6 | `20260526130000_execution_os_phase4c_finance_governance.sql` | Finance review evidence |
| 7 | `20260526140000_execution_os_phase4d_dispatch_completion.sql` | Dispatch completion evidence |
| 8 | `20260526150000_execution_os_phase4e_dispatch_finalization.sql` | Dispatch release lineage |
| 9 | `20260526160000_execution_os_phase4g_stock_finalization.sql` | Stock balances + consumption lineage |
| 10 | `20260601142000_fix_is_internal_staff_dispatch_head.sql` | `is_internal_staff()` — governance RLS helper |
| 11 | `20260601180000_phase25b_catalogue_product_mappings.sql` | Catalogue connector mappings |
| 12 | `20260604120000_wa_stage1_inbox_reader_rls.sql` | WA inbox reader RLS + `is_whatsapp_inbox_reader` |
| 13 | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` | WA audit tables (drift: local-only per drift report) |
| 14 | `20260605120000_wa_sprint9_sales_order_drafts_staging.sql` | SO draft tables + RLS |
| 15 | `20260606120000_wa_sprint9_sales_order_draft_transition_rpc.sql` | `transition_sales_order_draft_status` |
| 16 | `20260606130000_wa_sprint9_sales_order_draft_create_atomic_rpc.sql` | `create_sales_order_draft_atomic` |
| 17 | `20260606140000_wa_sprint9_sales_order_draft_operator_final_rpc.sql` | `update_sales_order_draft_operator_final` |
| 18 | `20260606150000_wa_sprint9_sales_order_draft_submit_review_atomic_rpc.sql` | `submit_sales_order_draft_for_review_atomic` |
| 19 | `20260606160000_wa_sprint9_sales_order_draft_approve_reject_atomic_rpc.sql` | `approve_*`, `reject_*`, `validate_sales_order_draft_readiness` |
| 20 | `20260606170000_wa_sprint9_sales_order_draft_extraction_version_rpc.sql` | Hardened operator-final + submit RPCs |
| 21 | `20260606180000_wa_sprint9_sales_order_draft_approve_extraction_readiness_hardening.sql` | Hardened `approve_sales_order_draft_for_so_atomic` |

**Edge function (not a migration):** `supabase/functions/barcode-scan-ingest/index.ts` — inserts into `operational_scan_records` when deployed.

**Catalogue approval:** No migration file in repo for `catalogue_tag_drafts`, `catalogue_alias_drafts`, or `approve_catalogue_*` / `reject_catalogue_*` RPCs (present in `src/integrations/supabase/types.ts` only).

---

## 2. Required remote DB objects — verification checklist

Legend: **In repo** = defined in scoped migration SQL. **Remote verify** = must confirm on target DB (drift blocks blind apply).

| Object | Type | Migration file | Code dependents | In repo migrations | Remote verify |
|--------|------|----------------|-----------------|-------------------|---------------|
| `operational_queue_items` | table | `20260525230000` | `useDepartmentExecutionBoard`, `useOperationalExecution`, `useExecutionCommandCenter` | YES | **YES** |
| `operational_queue_assignments` | table | `20260525230000` | `operationalExecutionService` | YES | **YES** |
| `operational_events` | table | `20260525230000` | `useExecutionCommandCenter`, `useCustomerTimelinePreview`, golden-chain queries | YES | **YES** |
| `prevent_operational_event_mutation` | function | `20260525230000` | append-only enforcement | YES | **YES** |
| `operational_scan_records` | table | `20260526010000` | `supabaseScanRepository`, `useBarcodeExecution`, dispatch/reservation panels, `barcode-scan-ingest` edge | YES | **YES** |
| `prevent_operational_scan_mutation` | function | `20260526010000` | immutability trigger | YES | **YES** |
| `operational_search_index` | table | `20260526020000` | `supabaseSearchIndexRepository`, `OperationalGlobalSearch` | YES | **YES** |
| `inventory_reservations` | table | `20260526030000` | `ReservationGovernancePanel`, `supabaseReservationRepository` | YES | **YES** |
| `inventory_reservation_allocations` | table | `20260526030000` | reservation service | YES | **YES** |
| `inventory_movements` | table | `20260526030000` | `createGovernedReservation`, stock finalization | YES | **YES** |
| `prevent_inventory_movement_mutation` | function | `20260526030000` | immutability | YES | **YES** |
| `dispatch_readiness_evidence` | table | `20260526120000` | `DispatchReadinessBoard`, `supabaseDispatchEvidenceStore`, golden-chain | YES | **YES** |
| `dispatch_readiness_evidence_immutable` | function | `20260526120000` | immutability | YES | **YES** |
| `finance_review_evidence` | table | `20260526130000` | `FinanceGovernanceBoard`, `supabaseFinanceEvidenceStore`, golden-chain | YES | **YES** |
| `finance_review_evidence_immutable` | function | `20260526130000` | immutability | YES | **YES** |
| `dispatch_completion_evidence` | table | `20260526140000` | `DispatchCompletionBoard`, completion store | YES | **YES** |
| `dispatch_completion_evidence_immutable` | function | `20260526140000` | immutability | YES | **YES** |
| `dispatch_release_lineage` | table | `20260526150000` | `DispatchFinalizationBoard`, finalization store | YES | **YES** |
| `dispatch_release_lineage_immutable` | function | `20260526150000` | immutability | YES | **YES** |
| `inventory_stock_balances` | table | `20260526160000` | `StockFinalizationBoard`, `supabaseStockFinalizationStore` | YES | **YES** |
| `stock_consumption_lineage` | table | `20260526160000` | stock finalization service | YES | **YES** |
| `prevent_stock_consumption_lineage_mutation` | function | `20260526160000` | immutability | YES | **YES** |
| `is_internal_staff` (DISPATCH_HEAD fix) | function | `20260601142000` | governance RLS policies, `auth-routing` | YES | **YES** |
| `catalogue_product_mappings` | table | `20260601180000` | `AdminCatalogueSyncStatus`, catalogue connector | YES | **YES** |
| `is_whatsapp_inbox_reader` | function | `20260604120000` | inbox reader RLS | YES | **YES** (staging applied as `20260604034227` — version skew) |
| `whatsapp_override_log` | table | `20260518220000` | WA audit (indirect) | YES | **YES** (drift: pending per drift report) |
| `whatsapp_suggestions_log` | table | `20260518220000` | WA audit (indirect) | YES | **YES** (drift: pending) |
| `sales_order_drafts` | table | `20260605120000` | `salesOrderDraftRepository`, Operator Inbox | YES | **YES** |
| `sales_order_draft_lines` | table | `20260605120000` | `salesOrderDraftRepository` | YES | **YES** |
| `sales_order_draft_audit_log` | table | `20260605120000` | `salesOrderDraftRepository` | YES | **YES** |
| `enforce_sales_order_draft_immutable_fields` | function | `20260605120000` | draft integrity trigger | YES | **YES** |
| `create_sales_order_draft_atomic` | RPC | `20260606130000` | `salesOrderDraftRepository` | YES | **YES** |
| `update_sales_order_draft_operator_final` | RPC | `20260606140000`, `20260606170000` | `salesOrderDraftRepository` | YES | **YES** |
| `submit_sales_order_draft_for_review_atomic` | RPC | `20260606150000`, `20260606170000` | `salesOrderDraftRepository` | YES | **YES** |
| `approve_sales_order_draft_for_so_atomic` | RPC | `20260606160000`, `20260606180000` | `salesOrderDraftRepository` | YES | **YES** |
| `reject_sales_order_draft_atomic` | RPC | `20260606160000` | `salesOrderDraftRepository` | YES | **YES** |
| `validate_sales_order_draft_readiness` | RPC | `20260606160000` | called by approve RPC | YES | **YES** |
| `transition_sales_order_draft_status` | RPC | `20260606120000` | **not called by app** (superseded) | YES | LOW priority |
| `catalogue_tag_drafts` | table | — | `ApprovalInbox`, `catalogueApprovalService` | **NO** | **YES** |
| `catalogue_alias_drafts` | table | — | `ApprovalInbox`, `catalogueApprovalService` | **NO** | **YES** |
| `approve_catalogue_tag_draft` | RPC | — | `catalogueApprovalService` | **NO** | **YES** |
| `approve_catalogue_alias_draft` | RPC | — | `catalogueApprovalService` | **NO** | **YES** |
| `reject_catalogue_tag_draft` | RPC | — | `catalogueApprovalService` | **NO** | **YES** |
| `reject_catalogue_alias_draft` | RPC | — | `catalogueApprovalService` | **NO** | **YES** |
| Edge `barcode-scan-ingest` | function | deploy artifact | hardware ingest path (not UI-invoked) | N/A (uses `operational_scan_records`) | **YES** (deploy + secrets) |

**Required DB objects listed:** **44** (40 in-repo + 4 catalogue approval objects missing from repo + edge deploy row)

---

## 3. Objects NOT found in repo migrations

| Object | In `types.ts` | Frontend/backend caller |
|--------|---------------|-------------------------|
| `catalogue_tag_drafts` | YES | `src/lib/catalogue-approval/catalogueApprovalService.ts`, `ApprovalInbox.tsx` |
| `catalogue_alias_drafts` | YES | same |
| `approve_catalogue_tag_draft` | YES | `catalogueApprovalService.approveTagDraft` |
| `approve_catalogue_alias_draft` | YES | `catalogueApprovalService.approveAliasDraft` |
| `reject_catalogue_tag_draft` | YES | `catalogueApprovalService.rejectTagDraft` |
| `reject_catalogue_alias_draft` | YES | `catalogueApprovalService.rejectAliasDraft` |

**Likely origin:** remote-only migration(s) among drift report §2 remote-only versions (e.g. `20260514185811`–`20260518210953`) — **not reconciled in this repo**.

---

## 4. Drift vs scoped migrations

| Migration group | In repo | In drift report local-only list | Remote verification |
|-----------------|---------|--------------------------------|---------------------|
| Phase 3–4 (`20260525*`–`20260526*`) | YES (9 files) | Not listed | **Required** — `db push` blocked globally |
| WA Sprint 9 drafts (`20260605*`–`20260606*`) | YES (8 files) | Not listed | **Required** |
| WA inbox RLS (`20260604120000`) | YES | Not listed | Staging evidence: applied as different version `20260604034227` |
| C2A WA audit (`20260518220000`) | YES | **Listed local-only** | **Required** — known pending |
| Catalogue approval | **NO migration** | N/A | **Required** — may exist only on remote |

---

## 5. Highest-risk missing / unverified objects

1. **`catalogue_tag_drafts` / `catalogue_alias_drafts` + four `approve_catalogue_*` / `reject_catalogue_*` RPCs** — UI depends on them; **no repo migration**
2. **Phase 4 governance tables** (`finance_review_evidence`, `dispatch_*_evidence`, `dispatch_release_lineage`, stock tables) — boards fall back to in-memory/demo if absent
3. **`sales_order_drafts` + atomic RPCs** — Operator Inbox draft workflow fails without apply
4. **`operational_scan_records`** — barcode boards + ingest edge; Scan Timeline still unwired
5. **Migration history reconciliation** — until drift fixed, **none** of the above can be trusted as applied via pipeline

---

## 6. Remote verification procedure (read-only checklist)

Do **not** apply SQL from this pack. On target DB, confirm each:

- [ ] `SELECT to_regclass('public.<table>')` for all 22 scoped tables
- [ ] `SELECT proname FROM pg_proc WHERE proname IN (...)` for 15 RPCs/functions listed
- [ ] `supabase migration list` — local file version matches remote row for each scoped migration
- [ ] Edge function `barcode-scan-ingest` deployed with `BARCODE_APP_SCAN_SIGNING_SECRET` / `CENTRAL_SCAN_SIGNING_SECRET`
- [ ] Catalogue approval tables/RPCs — if missing, `ApprovalInbox` approve/reject will fail at runtime

---

*Verification pack complete. No SQL applied, no migrations created, no application code modified.*
