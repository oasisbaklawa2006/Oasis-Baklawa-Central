# Sprint C2B — execution checklist

**Purpose:** Operational checklist for **Sprint C2B** work derived from governance and reconciliation documentation. Use this before starting each class of work (read-only UI, Edge writes, DB/RLS, CLI history ops).

**Scope:** Documentation only. This file does not authorize migrations, CLI, deploy, or code changes by itself.

**Primary sources:** `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`, `docs/SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md`, `docs/SPRINT_C2B_UNBLOCK_DECISION_MEMO.md`, `docs/SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md`, `docs/SPRINT_C2_READINESS_REPORT.md` (JWT / readiness), `docs/SUPABASE_REMOTE_ONLY_MIGRATION_SQL_RECOVERY_WORKSHEET.md` (Phase A evidence).

---

## 1. What is already safe

Work in these categories may proceed **without** lifting migration-history or write-path gates (per unblock memo and policy pack):

| Area | Safe activities |
|------|-----------------|
| **Documentation** | RLS/JWT matrices, runbooks, reconciliation appendices, policy spreadsheets, `verify_jwt` decision records, operator role allowlists. |
| **Read-only catalog / planning** | Further **read-only** introspection notes against production or clone; parity notes vs `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`; **no** apply. |
| **UI-only read surfaces** | Inbox **display** paths, TOOL 3/4 **suggestion** panels that **do not** add `.insert`/`.update`/`.delete` on governed tables; no “apply suggestion” persistence. |
| **Static security review** | Review of existing policies (from exports), `supabase/config.toml`, and Edge call graphs **without** merging SQL or deploying changes. |

**Evidence baseline:** Phase A indicates WhatsApp **core + audit** objects and finance objects are largely **present** on production; residual risk is **history skew** and **policy/JWT posture**, not wholesale missing tables for those bundles (see worksheet and unblock memo).

---

## 2. What remains blocked

Do **not** start these until the relevant section (§3–§6) checks and §7 approvals are satisfied:

| Blocked item | Why |
|--------------|-----|
| **TOOL 5** manual override implementation (UI + Edge + DB path) | Governance: JWT, `auth.uid()`, transactional audit, signed-off field list (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`). |
| **TOOL 6 persistence** (writes to `whatsapp_suggestions_log` or similar) | Default is **return-only**; persistence needs explicit product + security approval. |
| **New production write-path expansion** | New mutations on `whatsapp_message_packets`, `whatsapp_messages`, audit tables, or governed finance paths **beyond** what leadership explicitly scopes. |
| **New RLS / DDL migrations** in production | Interacts with drift and `db push` policy; needs reconciliation gates. |
| **`migration repair`**, **`db push`**, **`db pull`** | Blocked until `SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §4 gates and §6 checks pass. |
| **Deploy of new or changed write-capable Edge functions** | Same blast radius as write expansion; must not outrun RLS + history alignment. |
| **Treating Phase A as “green” for push** | Catalog match **does not** replace migration-list / history alignment. |

---

## 3. Exact checks before read-only UI work

Complete **all** before merging or shipping **read-only** UI changes (copy, layout, loading states) that still only **SELECT** and invoke **return-only** Edge tools (TOOL 3/4 pattern):

- [ ] **No new persistence:** Confirm no new `insert`/`update`/`delete` on `whatsapp_message_packets`, `whatsapp_messages`, `whatsapp_override_log`, `whatsapp_suggestions_log`, or related finance tables in the PR.
- [ ] **No “apply” actions:** No button or flow that persists suggestions or overrides (TOOL 6 / TOOL 5 freeze).
- [ ] **PostgREST scope:** Document which tables/columns the UI reads; ensure RLS still allows intended **authenticated** operator read (or document known gaps without widening policies in this step).
- [ ] **Realtime:** If subscribing to `whatsapp_message_packets` (or other tables), confirm events do not trigger client-side writes beyond refresh/display.
- [ ] **Regression on C1 contract:** TOOL 3/4 remain **return-only** from Edge (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §1).
- [ ] **Copy / UX:** Misleading labels (“saved”, “applied”) are absent unless data is actually persisted and governed.

---

## 4. Exact checks before any Edge write work

“Edge write work” means **any** change that adds or broadens **mutations** from Edge (new inserts/updates/deletes, new tables, new internal `fetch` to another function that writes) or changes **auth** on existing writers.

- [ ] **TOOL 5/6 freeze:** Product + eng **approval gate** satisfied for the specific feature (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §12, §Approval gate).
- [ ] **`verify_jwt`:** Target **`verify_jwt = true`** for **operator/browser-invoked** write slugs; any **`verify_jwt = false`** exception has a **written** service-to-service threat model (governance §5, §9).
- [ ] **Identity:** Operator identity from **`auth.uid()`** only for authorization and audit; **ignore** body `operator_id` / `user_id` for trust (governance §6).
- [ ] **Role checks:** Allowlisted role validation **in Edge** after JWT verification; stable **403** for forbidden roles (governance §7).
- [ ] **Atomicity:** Packet (or equivalent) update + audit insert in **one transaction** (prefer `SECURITY DEFINER` RPC) (governance §8).
- [ ] **RLS alignment:** Policies or RPCs reviewed so service-role paths cannot be replaced by anon abuse when JWT settings change.
- [ ] **Deploy plan:** Staging validation, rollback, and **no** production deploy until §7 sign-offs and (if applicable) migration gates are met.
- [ ] **No silent side effects:** “Informational” tools do not persist without explicit persistence contract (governance §6–7, §10).

---

## 5. Exact checks before any DB / RLS migration

Applies to **new** `supabase/migrations/*.sql` or manual DDL that touches **RLS**, **policies**, **SECURITY DEFINER** functions, or governed tables.

- [ ] **Reconciliation strategy:** Objects touched are **understood** in worksheet + execution strategy; no **placeholder** or **cosmetic rename-only** files (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §2).
- [ ] **Equivalence / idempotency:** Migration is **idempotent** or safe against **current** prod state; no assumed state contradicted by Phase A notes (e.g. finance `receipts` bucket `public`, WhatsApp C2A parity gaps).
- [ ] **RLS principles:** Matches governance §4 (least privilege, authenticated vs service_role, no silent broadening of `PUBLIC` unless explicitly approved).
- [ ] **Policy review:** For `whatsapp_*`, document impact on `whatsapp_packets_*`, audit tables, buffer, config, storage policies (see policy pack §3).
- [ ] **Peer review:** Second reviewer for anything touching **policies** or **SECURITY DEFINER** (execution strategy §5).
- [ ] **Staging first:** Apply and test on **staging** (see §6 ordering); not production until §7 and §8 are **Go**.

---

## 6. Exact checks before repair / db push / db pull

CLI and history operations **must not** run until:

- [ ] **Gate: mark equivalent** — For each version in scope, evidence meets execution strategy §4 (“at least two” strong signals where required).
- [ ] **Gate: repair** — Written proof per version; backup/clone checkpoint; no open **unknown** classifiers for those versions (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §4).
- [ ] **Gate: db push** — Remote-only set **either** represented by verified files **or** formally scoped out; local-only pending files reviewed; **`migration list`** has no unexplained skew for versions in the release (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §4).
- [ ] **No blind repair** — Team agrees there are **no** placeholder migrations and no timestamp-only renames without Phase C equivalence (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §2, §7).
- [ ] **db pull** — Purpose documented (e.g. capture baseline for comparison); **not** used to overwrite repo truth without review and merge plan.
- [ ] **Rollback** — Named owner and steps if push/repair causes skew or failure.

---

## 7. Required approvals

| Approval | Required from | Document reference |
|----------|----------------|----------------------|
| **TOOL 5** — allowed packet fields, actions, audit shape | Product owner + engineering lead | `SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §Approval gate, §9 |
| **TOOL 6** — persist vs return-only default | Product owner + engineering lead | Same; §10 |
| **Final table names, RLS matrix, Edge vs RPC split** | Product owner + engineering lead | Same |
| **RLS / `{public}` vs `authenticated` posture** | Security + engineering | Unblock memo §5; policy pack §2, §9 |
| **`verify_jwt` exceptions** on mutating or sensitive paths | Security + engineering | Governance §5, §9; readiness report |
| **Migration repair / db push / db pull** in an environment | DBA or delegated owner + second reviewer | `SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §4, §8 |

Until the **TOOL 5/6 / matrix** approval row is complete, **freeze** governed implementation (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §12).

---

## 8. Stop / go decision table

| Workstream | Preconditions (summary) | Decision |
|------------|-------------------------|----------|
| **Read-only UI** | §3 checklist complete | **Go** |
| **Docs / policy dashboard** | No code change required; align with memo safe scope | **Go** |
| **Edge write / TOOL 5 / new mutating path** | §4 + §7 (TOOL 5/6 approvals, JWT plan) | **Stop** until **Go** |
| **New DB / RLS migration** | §5 + §7 + migration list story | **Stop** until **Go** |
| **repair / db push / db pull** | §6 + execution strategy §4 gates | **Stop** until **Go** |
| **Production deploy** of schema or write Edge | §5–§7 + staging proof | **Stop** until **Go** |

**Hard no-go:** Any of §7 **TOOL 5/6 / matrix** items unanswered **or** `migration list` unexplained for in-scope versions **or** open **§5 RLS** sign-off for the same release (`SPRINT_C2B_UNBLOCK_DECISION_MEMO.md` §7).

---

## 9. Suggested implementation order

Execute in order; do not skip **B** or **C** before **D** if later steps touch schema or writers.

| Step | Label | Contents |
|------|-------|----------|
| **A** | **Read-only UI polish** | Complete §3; inbox and suggestions UI without persistence. |
| **B** | **Policy dashboard / doc** | Policy inventory spreadsheet or dashboard spec; export `pg_policies` / `pg_get_expr` per policy pack; gap vs governance §4. |
| **C** | **Edge authority review** | Complete Edge inventory and `verify_jwt` decision record (policy pack §4); webhook/stitcher/operator-reply/send-whatsapp blast radius documented. |
| **D** | **Staging-only dry-run** | When §5–§6 allow: apply migrations on **staging** only; run governance §11 testing checklist categories relevant to changed paths. |
| **E** | **Write-path pilot after approvals** | After §7 + §8 **Go** for Edge writes: limited pilot, monitoring, rollback; TOOL 5 transactional audit pattern; no production-wide enable until pilot passes. |

---

*End of checklist.*
