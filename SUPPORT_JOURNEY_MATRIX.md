# SUPPORT JOURNEY MATRIX

**Scope:** Journey D — customer raises ticket → persisted → ownership assigned → Support queue → acknowledgement → communication → escalation → department response → customer update → SLA/escalation → resolution → customer-visible closure → audit retention.
**Repos:** `oasisbaklawa2006/oasis-supabase-core`, `oasisbaklawa2006/oasis-baklawa`, `oasisbaklawa2006/Oasis-Baklawa-Central`. All `main`.

## CRITICAL CONTEXT — TWO UNCONNECTED SYSTEMS EXIST

**(A) Legacy `support_tickets`** — the system actually wired to the Buyer UI and the Central `/admin/support` queue. This is what the mission's journey maps to and what this document traces.

**(B) `commercial_complaints` / `delivery_proofs` / `commercial_adjustments`** (Finance Exit, `20260830143800_delivery_complaint_remedy_authority.sql`) — a separate, far more rigorously governed append-only complaint→remedy pipeline (10-day window, immutable event log). **No UI caller of `file_commercial_complaint_v1` or `record_delivery_proof_v1` was found in either Buyer or Central** (confirmed independently by both the Support-journey pass and the Golden-Order-Pipeline pass — see GOLDEN_ORDER_PIPELINE_MATRIX.md §8). This governed system is entirely DB-only and orphaned from any frontend, while the actually-used system (A), traced below, is architecturally the weaker one.

---

## JOURNEY (A) TRANSITION-BY-TRANSITION

### 1. Customer raises ticket

| Field | Evidence |
|---|---|
| RPC | `submit_customer_support_ticket_v1` (baseline `20260723161256`, hardened for order-ownership in `20260918010000_auth01_buyer_rpc_identity_gate_hardening.sql`); idempotent successor `submit_customer_support_ticket_v2` (`20260917170000_support_ticket_idempotency_v2.sql`, advisory-lock dedup, `p_idempotency_key` required). Both `SECURITY DEFINER`, granted to `authenticated` only (anon/public revoked in `20260730170000`) |
| Defense-in-depth | `support_ticket_set_customer_context()` BEFORE INSERT trigger — validates order belongs to caller's company (or admin/super_admin bypass), forces `status='open'`, nulls SLA/assignment/rating fields — fires regardless of which RPC (or raw insert) is used |
| Calling UI | Buyer `customerGateway.ts` (`submitTicket` → v1) + `src/lib/support-ticket-idempotency.ts` (v2 path) |
| **Classification** | **PROVEN** |

### 2. Ticket persisted / DB state

| Field | Evidence |
|---|---|
| Table | `public.support_tickets` (baseline `20260723161256`, ~line 7927). `status` is **free-text, default `'open'`, no CHECK constraint, no enum**. Observed values: `open`, `resolved`, `rejected`, `cancelled`, plus whatever staff type |
| Derived customer status | Computed only inside `customer_support_tickets_v1()` (not stored) — so Central's raw queries and the Buyer RPC can and do diverge (see FAIL-485-class finding below) |
| **Second, ungoverned write path** | Central `src/components/ClaimModal.tsx` does `supabase.from("support_tickets").insert({...})` **directly — no RPC**, setting severity/SLA timers/routed_to_department client-side. Still gated by the trigger's non-admin branch, which requires the actor to resolve as a *buyer* company — so this Central-side insert **only succeeds for literal `admin`/`super_admin`**; any other staff role (e.g. `support_executive`) raising a claim on a customer's behalf gets `'approved customer company required'` and **fails**. |
| **Classification** | **PARTIALLY PROVEN** — grants locked down correctly; status has no governed enum; staff-claim path **BROKEN** for non-admin roles |

### 3. Ownership assigned to Support

| Field | Evidence |
|---|---|
| Mechanism | **No RPC exists.** Central `AdminSupport.tsx handleAssign()` does a raw `supabase.from("support_tickets").update({assigned_employee_id, sla_first_response_due:+2h, sla_action_due:+24h, sla_resolution_due:+72h})` |
| Defect | SLA timer values (2h/24h/72h) are **hardcoded client-side constants**, not server policy — nothing server-side re-derives or checks them |
| Audit | **None written on assignment** (only `resolve` writes an audit row — see step 8) |
| **Classification** | **BROKEN / PARTIALLY PROVEN** — works only for `admin`/`super_admin` (see RBAC finding below), no audit trail |

### 4. Support role sees the queue — HEADLINE DEFECT (RBAC)

| Field | Evidence |
|---|---|
| Mechanism | Central `AdminSupport.tsx` fetches with a raw `SELECT * FROM support_tickets ORDER BY created_at DESC` — **no RPC**. Visibility governed entirely by RLS in baseline `20260723161256` (~line 14430): `support_tickets_admin_all` — `FOR ALL TO authenticated USING (u.role = ANY(ARRAY['admin','super_admin']))` — a **literal role-string match**, not `is_internal_staff()`. Confirmed no other policy exists on this table (zero other `CREATE POLICY support_tickets` hits in migration history) |
| Intended owner vs actual gate | Central's own routing intends `SUPPORT_EXECUTIVE`/`support_executive` to own this queue: `auth-routing.ts` (`SUPPORT_EXECUTIVE: "/admin/support"`), `roleAccess.ts` (`SUPPORT_EXECUTIVE: [...,"support",...]`), `queueOwnership.ts` (`{queueId:"customer_support_queue", ownerRole:"support_executive"}`). `support_executive` **is** treated as internal staff everywhere else in Core (`is_internal_staff()` role array, WhatsApp operator-reply grants) |
| **The break** | `support_tickets_admin_all` does **not** check `is_internal_staff()`. A user with `role='support_executive'` matches neither `admin_all` (wrong literal role) nor the customer policies (not a buyer) → **zero rows returned, full stop.** UI navigation succeeds (SUPPORT_EXECUTIVE is on `ADMIN_STAFF_ROLES`, passes `RoleProtectedRoute`) — the page renders, but the queue is silently empty for the exact role designed to own it. Only literal `admin`/`super_admin` accounts can see or act on tickets in production today. |
| **Classification** | **BROKEN** — UI-reachable but DB-empty for the intended primary actor. Worse than a count/list mismatch: the list itself never appears |

### 5. Acknowledgement / first response

| Field | Evidence |
|---|---|
| Mechanism | No dedicated "acknowledge" RPC or UI action exists. Proxy field `sla_first_response_at` is **never written anywhere** in either repo (grep confirms only reads + the trigger nulling it on insert) |
| Consequence | `customer_support_tickets_v1()`'s `in_progress` branch (`sla_first_response_at IS NOT NULL`) is **dead code** given current write paths |
| **Classification** | **UNPROVEN / NOT FOUND** — confirmed absent, not merely undiscovered |

### 6. Communication with customer

| Field | Evidence |
|---|---|
| Mechanism | **No message-thread table exists** — zero hits for `ticket_message(s)` across Core baseline and both app repos. `Oasis-Baklawa-Central/docs/APP_VERSE_POINT_6_CANONICAL_ENTITY_REGISTER_2026-07-23.md` documents a "Ticket Message" entity — **aspirational documentation with no backing schema** |
| Staff text | Only `resolution_notes` exists, and it is **not returned** to the customer by `customer_support_tickets_v1()`'s SELECT list — buyer never sees staff-written text, only a derived status enum |
| Buyer "communication log" | `src/lib/buyer-communication-log.ts` is a client-side merge-sort of ticket + general-query rows into one feed — a projection, not a conversation |
| Corroboration | Central's own `docs/WHATSAPP_COMPLETE_MODULE_BUILD_AUDIT.md`: "Complaint/ticket detection | Partial | 35%" |
| **Classification** | **BROKEN / UNPROVEN** — no two-way communication capability exists at all |

### 7. Internal escalation to another department

| Field | Evidence |
|---|---|
| Mechanism | `src/components/sales/crm-lite/SalesSupportEscalationDialog.tsx` → `submitSalesSupportTicket()` calls `submit_customer_support_ticket_v1` — the **customer-raise RPC**, misused as an escalation mechanism |
| Defect | Neither the RPC's `customer_buyer_eligible_company_id()` check (post-`20260918010000`) nor the trigger's admin/buyer-only branches have a case for `sales_executive` or any non-admin/non-buyer role — a genuine Sales-staff caller **will always raise `SUPPORT_TICKET_BUYER_CONTEXT_REQUIRED`/`'approved customer company required'`**. The dialog's own UI text ("Sales staff cannot access the admin support queue") acknowledges the one-way nature, but the write itself is not proven to succeed for a Sales actor at all |
| Department routing | `routed_to_department` is a **client-computed label only** (`routeDepartment(issueType)`, duplicated in `ClaimModal.tsx` and `AdminSupport.tsx`) — no queue, notification, or RPC actually routes work. Confirmed by Central's own `src/lib/department-queues/departmentQueueRoutingContract.ts`: *"blockedPrerequisite: Core order-advance trigger or RPC to auto-create customer_support_queue work from canonical orders ... support_tickets exists but has no governed auto-queue producer"* |
| **Classification** | **BROKEN** (Sales escalation dialog will fail for its intended actor) / **UNPROVEN** (department routing has no execution behind the label — self-documented by the codebase) |

### 8. Department response → customer update → resolution → closure

| Field | Evidence |
|---|---|
| Mechanism | Only "resolve" exists: `AdminSupport.tsx handleResolve()` — raw `UPDATE {status:'resolved', sla_resolved_at:now(), sla_state:'On Time'}` |
| **Defect** | `sla_state` is **hardcoded to `'On Time'` regardless of whether the SLA was actually breached** — a ticket resolved 10 days late is still stamped "On Time" |
| Audit | Only the resolve action writes an audit row, to a **Central-local** `audit_logs` table (`action_type:'resolve_support_ticket'`) — **not** the Core governed `operational_events` ledger. Assignment and admin-rating actions write **no audit record at all** |
| **Classification** | **PARTIALLY PROVEN** — resolution + partial audit trail exist, but SLA-state stamping is provably wrong and two of three staff actions are unaudited |

### 9. Notification to customer

| Field | Evidence |
|---|---|
| Mechanism | Grepped the full Core baseline for `notification_outbox` call sites tied to `support_tickets` — **zero hits**. No trigger on `support_tickets` and no code path in submission, assignment, or resolve ever calls the outbox enqueue function |
| **Classification** | **UNPROVEN / NOT FOUND** — ticket lifecycle is silent on the notification layer; UI-toast-only, no actual outbound WhatsApp/email/SMS ever queued |

### 10. Audit ledger (governed `operational_events`)

| Field | Evidence |
|---|---|
| Mechanism | Searched for `append_operational_event_v1(...'support_ticket'...)` — **zero hits**. `operational_events` is append-only, RLS/trigger-hardened, and actively used elsewhere (e.g. `emit_rgs_handover_escalations()`), but never for support tickets |
| **Classification** | **UNPROVEN / NOT FOUND** for governed audit retention; **PARTIALLY PROVEN** for the weaker Central-local log (resolve only) |

### 11. SLA/escalation timeout automation

| Field | Evidence |
|---|---|
| Mechanism | Grepped Core for `pg_cron`/`cron.schedule` tied to `support_tickets`/`sla_state` — **zero results**. Direct confirmation from the codebase's own commit message in `20260824140000_lane1_b2_rgs_escalation_bridge.sql`: *"Deliberately NOT a new escalation mechanism, NOT a cron job (no scheduler infrastructure exists in this repo for that)"* — the team states no scheduler infra exists anywhere in Core, for any domain |
| Client-side breach detection | Computed **twice, with different logic**: `AdminSupport.tsx computeSlaState()` (4-branch, uses 4 SLA fields) vs `AdminDashboard.tsx` (separate raw count query, single-field `sla_resolution_due` predicate only) |
| **Classification** | **UNPROVEN / NOT FOUND** — confirmed absent (not merely undiscovered); breach is a UI badge color only, nothing escalates automatically |

---

## FAIL-485-STYLE KPI/COUNT DESYNC — CONFIRMED PRESENT

The same defect class the prior #462 UAT audit found once (Admin Clients pending-count KPI) recurs here, independently, across three uncoordinated predicates over the same table:

| Surface | File | "Open/active" predicate | "SLA breached" predicate |
|---|---|---|---|
| Admin dashboard KPI tile | `AdminDashboard.tsx` | `.eq("status","open")` (exact) | `.neq("status","resolved").lt("sla_resolution_due", now())` (server-side count) |
| Support queue "Active" tab | `AdminSupport.tsx` | `tickets.filter(t => t.status !== "resolved")` (client-side, includes `rejected`/`cancelled`/anything-not-resolved) | client-computed `computeSlaState(t)` — wider (also checks `sla_action_due`/`sla_first_response_due`) |
| Buyer-facing status | `customer_support_tickets_v1()` | derived CASE (resolved/closed → resolved/closed; else open/in_progress) | not exposed to buyer |
| Exceptions view | `AdminExceptions.tsx` | `.eq("status","open")` | n/a |

Because `status` has no CHECK constraint (finding #2), any free-text value is possible, and the dashboard's exact-match "Open Tickets" count will **undercount** relative to AdminSupport's "Active" tab whenever a ticket sits in `rejected`/`cancelled`/anything else non-`open`/non-`resolved`. The dashboard's "SLA Breached" KPI will likewise **undercount** relative to AdminSupport's wider badge logic. No shared view/RPC exists as a single source of truth — contrast with the properly governed `commercial_complaint_window_v1` in system (B), which *is* a single canonical predicate but has no UI caller at all.

---

## SUMMARY TABLE

| Transition | Mechanism | Classification |
|---|---|---|
| Raise ticket | `submit_customer_support_ticket_v1`/`v2` | **PROVEN** |
| Persist / status model | table, no enum | **PARTIALLY PROVEN** |
| Staff-side raw insert on behalf of customer | none (raw insert) | **BROKEN** for non-admin staff |
| Ownership assignment | none (raw UPDATE) | **BROKEN / PARTIALLY PROVEN** |
| Support queue visibility | RLS role-literal mismatch | **BROKEN** — support_executive sees 0 rows |
| Acknowledgement | none — field never written | **UNPROVEN / NOT FOUND** |
| Customer communication | none — no message table | **BROKEN / UNPROVEN** |
| Internal escalation | misused customer-raise RPC | **BROKEN** |
| Department response routing | client-string label only | **UNPROVEN** — no execution behind it |
| Resolution/closure | raw UPDATE, mis-stamps SLA | **PARTIALLY PROVEN** |
| Customer notification | none — no outbox write | **UNPROVEN / NOT FOUND** |
| Audit ledger (governed) | none | **UNPROVEN** (governed) / **PARTIALLY PROVEN** (local log) |
| SLA/escalation automation | none — no scheduler infra in repo | **UNPROVEN / NOT FOUND** |
| RBAC (Support role vs DB) | role-literal vs is_internal_staff() mismatch | **BROKEN** |
| Parallel governed complaint system (B) | fully built, no UI caller anywhere | **UNPROVEN** — orphaned |
| KPI/list count desync | 3+ divergent predicates | **BROKEN — confirmed present** |

No code was modified during this investigation; all findings are read-only citations from `main` in the three named repositories.
