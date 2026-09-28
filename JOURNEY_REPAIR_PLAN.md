# JOURNEY REPAIR PLAN

Bounded implementation tranches for Cursor, derived from `JOURNEY_FAILURE_LEDGER.md`. Each tranche is sized to be a single bounded PR. Ordered by severity (P0→P3), then within severity by dependency (shared authority/root-contract → auth/RBAC → RPC/state-transition → module-local → polish), per the standing repair-queue convention already used in this programme.

**This document does not implement anything.** No code was written in the audit that produced it.

---

## P0 — silent loss / security / data corruption (5 tranches)

### TR-P0-1 — Fix support ticket queue RLS role check
- **Repo:** oasis-supabase-core
- **Defect:** FL-SUP-01
- **Change:** Replace `support_tickets_admin_all`'s literal `role IN ('admin','super_admin')` predicate with an `is_internal_staff()`-based policy scoped to the intended queue owner (`support_executive` + admin roles, per Central's own `queueOwnership.ts`).
- **Regression test required:** RLS test proving a `support_executive`-roled session can SELECT/UPDATE tickets; proving a non-staff buyer session still cannot see other companies' tickets.
- **Downstream to recertify:** SUPPORT_JOURNEY_MATRIX.md §4.

### TR-P0-2 — Fix SLA-state mis-stamping on resolution
- **Repo:** Oasis-Baklawa-Central
- **Defect:** FL-SUP-02
- **Change:** `AdminSupport.tsx handleResolve()` must compute actual SLA state (on-time vs breached) from `sla_resolution_due`/`sla_action_due`/`sla_first_response_due` at resolution time, not hardcode `'On Time'`.
- **Regression test required:** unit test resolving a ticket past its `sla_resolution_due` and asserting `sla_state` reflects breach.

### TR-P0-3 — Unify support-ticket KPI/count predicates
- **Repo:** Oasis-Baklawa-Central (consider a Core view/RPC as the real fix)
- **Defect:** FL-SUP-03
- **Change:** Replace the three independent predicates in `AdminDashboard.tsx`, `AdminSupport.tsx`, `AdminExceptions.tsx` with one canonical source (ideally a governed RPC/view in Core, matching the `commercial_complaint_window_v1` pattern already used elsewhere in this codebase).
- **Also add:** a CHECK constraint or enum on `support_tickets.status` (currently free-text) so future ad-hoc values can't silently widen the divergence.
- **Regression test required:** a single fixture ticket set where the three surfaces must report identical counts.

### TR-P0-4 — Fix general-query idempotency-conflict swallow
- **Repo:** oasis-supabase-core
- **Defect:** FL-CUST-01
- **Change:** Apply the same explicit-conflict-raise pattern `20260917170000` already applied to `submit_customer_support_ticket_v2` to `submit_customer_general_query_v1` — a payload-mismatched retry on the same idempotency key must raise a conflict, not be silently treated as a duplicate replay.
- **Regression test required:** contract test submitting two different payloads under the same idempotency key, asserting an explicit conflict error, not silent success.

### TR-P0-5 — Deduplicate advance-calculation formula
- **Repo:** oasis-supabase-core
- **Defect:** FL-GOP-01
- **Change:** `get_finance_operations_clearance_facts_v1` must call `calculate_sales_order_advance_v1()` instead of re-implementing the 30%/nearest-500 rounding rule inline.
- **Regression test required:** a case where the two formulas would have disagreed pre-fix (non-multiple-of-500 order value) — assert clearance eligibility now matches the canonical calculator.

---

## P1 — journey cannot complete (7 tranches)

### TR-P1-1 — Resolve DPL-receipt RPC naming ambiguity (investigate first, then fix)
- **Repos:** oasis-supabase-core + Oasis-Baklawa-Central
- **Defect:** FL-GOP-02
- **Change:** Determine whether `receive_submitted_b2b_dispatch_dpls_v1` (referenced in Central's `financeAuthorityMap.ts`) is a distinct upstream feeder RPC or a stale reference to `receive_finance_dpl_v1` (the migration-defined function). Fix whichever is wrong. **This tranche blocks confident work on TR-P1-2**, which depends on the same DPL/dispatch authority surface.

### TR-P1-2 — Build GATEKEEPER→COMPLETE UI
- **Repo:** Oasis-Baklawa-Central
- **Defect:** FL-GOP-03
- **Change:** Build the missing admin screens calling the already-governed `record_delivery_proof_v1`, `file_commercial_complaint_v1`, `resolve_commercial_complaint_v1`. No new DB authority needed — these RPCs are fully built, tested, and idempotent; only the UI layer is missing.
- **Depends on:** TR-P1-1 (same authority area, avoid rework).
- **Downstream to recertify:** GOLDEN_ORDER_PIPELINE_MATRIX.md §8.

### TR-P1-3 — Fix staff-on-behalf-of-customer ticket paths
- **Repo:** Oasis-Baklawa-Central
- **Defects:** FL-SUP-04, FL-SUP-05
- **Change:** Replace `ClaimModal.tsx`'s raw table insert with a proper RPC callable by any internal-staff role (not just admin/super_admin). Replace `SalesSupportEscalationDialog.tsx`'s misuse of the customer-raise RPC with a real staff-escalation path.
- **Depends on:** TR-P0-1 (same RLS/authority surface — fix the queue-visibility gate first so the new write paths land in a queue staff can actually see).

### TR-P1-4 — Resolve SALES_MANAGER orphaned role
- **Repo:** Oasis-Baklawa-Central
- **Defect:** FL-ROLE-01
- **Change:** Either add `SALES_MANAGER` to `STAFF_ROLE_DESTINATIONS`/`ADMIN_STAFF_ROLES` with a real landing route, or confirm the role is deprecated and remove it from the two RLS policies that still reference it in Core. **Requires an owner decision** on which direction — this is a scope question, not purely mechanical.

### TR-P1-5 — Build ticket communication + acknowledgement + notification
- **Repos:** oasis-supabase-core + Oasis-Baklawa-Central
- **Defect:** FL-SUP-06
- **Change:** Add a message-thread table + RPCs (the entity is already documented in Central's own canonical entity register — build the schema it describes); wire a write to `sla_first_response_at` on first staff action; wire ticket lifecycle events (assignment, response, resolution) into `notification_outbox` using the existing dual-channel pattern proven in `notify-event`.
- **This is the largest tranche in the plan** — recommend splitting into sub-PRs (schema, RPCs, UI, notification wiring) at implementation time.

### TR-P1-6 — Implement SLA/escalation timeout automation
- **Repo:** oasis-supabase-core (+ Edge Function if no pg_cron available)
- **Defect:** FL-SUP-07
- **Change:** Add a real scheduled job that detects SLA breaches and takes action (reassignment, notification, severity bump) — replacing the current client-only, twice-duplicated badge computation. Confirm whether pg_cron or an Edge Function on a schedule is the intended mechanism for this repo (none exists anywhere in Core today, per the codebase's own commit note) — this is a new capability, not a bug fix, and may need an infrastructure decision first.

### TR-P1-7 — Implement department-routing execution
- **Repos:** oasis-supabase-core + Oasis-Baklawa-Central
- **Defect:** FL-SUP-08
- **Change:** Build the governed queue producer Central's own `departmentQueueRoutingContract.ts` already documents as a blocked prerequisite — turn `routed_to_department` from a display label into work that actually appears in the named department's queue.

---

## P2 — journey completes incorrectly / manual workaround (5 tranches)

### TR-P2-1 — Fix `/sales/3pgs-visibility` role-gate inconsistency
- **Repo:** Oasis-Baklawa-Central. **Defect:** FL-ROLE-02. Add ADMIN/SUPER_ADMIN to the route's `allowedRoles`, matching every sibling route.

### TR-P2-2 — Verify/fix PACKING_SUPERVISOR landing route
- **Repo:** Oasis-Baklawa-Central. **Defect:** FL-ROLE-03. Trace nav reachability first; if no packing-specific screen is reachable at all, build or redirect to one.

### TR-P2-3 — Scope production RPC authorization to department roles
- **Repo:** oasis-supabase-core. **Defect:** FL-ROLE-04. Narrow the currently-blanket `is_internal_staff()` gate on production-mutation RPCs to the owning department's roles. Self-documented as accepted-scope in the original migration — confirm with owner before narrowing, in case broader access is intentional for a documented operational reason.

### TR-P2-4 — Consolidate or formally separate the two complaint systems
- **Repos:** oasis-supabase-core + Oasis-Baklawa-Central. **Defect:** FL-GOP-04. **Requires an architecture decision from the owner** before any code change: migrate `support_tickets` onto the governed `commercial_complaints` model, or explicitly scope the two to different purposes (e.g., general support vs. post-delivery commercial complaints) and document the boundary. Do not implement without that decision — this is exactly the kind of "architecturally significant" fork a repair agent should not resolve unilaterally.

### TR-P2-5 — Server-derive SLA assignment timers + add missing audit records
- **Repo:** Oasis-Baklawa-Central. **Defect:** FL-SUP-09. Move the 2h/24h/72h SLA constants server-side (policy table or RPC default), and add audit-log writes for assignment and rating actions to match the existing resolve-action audit pattern.

---

## P3 — usability / observability / polish (4 tranches)

### TR-P3-1 — Implement reorder flow
- **Repo:** oasis-baklawa. **Defect:** FL-CUST-02. Client-side "read past order → re-add each line via `add_customer_order_draft_line_v1`" is safe by construction (server re-validates MOQ/pricing) — this is a feature build, not an authority change.

### TR-P3-2 — Verify FINANCE_HEAD vs FINANCE_EXEC differential
- **Repos:** oasis-supabase-core + Oasis-Baklawa-Central. **Defect:** FL-ROLE-05. Confirm whether any intended authority split exists; if none, consider collapsing to one role to reduce confusion, or document the intended (currently unimplemented) split.

### TR-P3-3 — Trace and harden logout/session-expiry/recovery
- **Repo:** Oasis-Baklawa-Central. **Defect:** FL-ROLE-06. First a research pass (this was out of budget in the current audit), then fix/test whatever gaps it finds.

### TR-P3-4 — Exhaustive Select-in-Sheet + KPI/list-divergence scan
- **Repo:** Oasis-Baklawa-Central. **Defect:** FL-ROLE-07. Scan all ~90 `src/pages/admin/*.tsx` files for both defect classes beyond the 4 screens spot-checked in this audit (AdminClients, AdminSupport, SalesDashboard, OperationsController, AdminAccountsRelease). FL-SUP-03 already proves the KPI class recurs — treat this as confirmed-needed, not speculative.

---

## PARALLEL vs SERIAL

**Can run in parallel immediately:** TR-P0-2, TR-P0-3, TR-P0-4, TR-P0-5 (independent files/repos, no shared authority surface).

**Serial dependency:** TR-P0-1 → TR-P1-3 (fix the queue-visibility RLS before building new staff-write paths into that same queue). TR-P1-1 → TR-P1-2 (resolve the RPC-naming ambiguity before building UI on top of it).

**Needs an owner decision before implementation, not just an engineering pass:** TR-P1-4 (deprecate vs. wire up SALES_MANAGER), TR-P2-3 (narrow blanket RPC authority — may be intentional), TR-P2-4 (consolidate the two complaint systems), TR-P1-6 (introduce scheduler infrastructure that doesn't exist anywhere in the repo today).

**Everything else** can be assigned to Cursor as independent bounded PRs once P0 lands.
