# Sprint C2B unblock — decision memo

**Purpose:** Record what **may** proceed under **Sprint C2B** (auth / RLS track) while **migration history** and **write-path governance** constraints remain, using **Phase A read-only** findings and existing execution strategy.  
**Scope:** Documentation and decision only. **No** migration SQL, **no** `repair` / `db push` / `db pull`, **no** Supabase CLI, **no** app code edits, **no** deploy, **no** push from this memo.

**Sources:** `docs/SUPABASE_REMOTE_ONLY_MIGRATION_SQL_RECOVERY_WORKSHEET.md` (Phase A finance + WhatsApp, decision matrix), `docs/SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md`, `docs/SPRINT_C2_READINESS_REPORT.md`, `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`.

---

## 1. Executive decision

### What is **safe to proceed** (now)

- **Documentation and planning:** RLS/JWT threat models, role matrices, runbooks, and reconciliation worksheets—aligned with `SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` Phases A–C language.
- **UI-only read surfaces:** Operator inbox and suggestion panels that remain **read-only** (no new `.insert`/`.update`/`.delete` on governed tables; no “apply suggestion” that persists).
- **Non-mutating auth / RLS review:** Static review of policies, `verify_jwt` flags in `supabase/config.toml`, and Edge call graphs **without** shipping new SQL or new write Edge deploys.
- **Schema-confidence work that stays read-only:** Further catalog diffs, parity notes against `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`, and finance local files—**no** apply.

**Rationale:** Phase A shows **finance** and **WhatsApp core + audit** objects **present** on production and largely consistent with **local migration intent** for the bundles examined; the dominant residual risk is **migration history skew** and **policy posture**, not “tables missing entirely” for those areas.

### What **remains blocked** (until gates clear)

- **Production write-path expansion:** TOOL 5 manual overrides, new `SECURITY DEFINER` RPCs that mutate packets + audit, new RLS migrations, **`migration repair`**, **`db push` / `db pull`**, and **deploy** of new write-capable Edge functions.
- **Treating Phase A as “green” for `db push`:** `SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §4 still requires **history alignment** and explicit gates before push/repair—even when catalog matches.

---

## 2. Evidence

### Finance — Phase A (worksheet)

- Remote-only rows **`20260514185811`**, **`20260515073922`**, **`20260514185829`**, **`20260517072741`:** **exact** or **high-confidence** match to `20260515120000_*`, `20260515194500` (PART A), and `20260516200000_*` respectively for columns, indexes, FKs, and (where applicable) comments.
- **`20260515073940`:** **partial mismatch** — `storage.buckets` row `receipts` has **`public = true`** vs local migration intent **`public = false`** (security semantics; not a “missing table” gap).
- **Finance exec RLS remote `20260514185852`:** **not** part of the first Phase A slice; still **open** for catalog vs `add_finance_exec_rls_policies`.

### WhatsApp — Phase A (worksheet)

- **Six remote-only WhatsApp versions:** production has the **expected object graph** (nine `whatsapp_*` tables, indexes, FKs on core paths). **Stitcher Edge assumptions** (`whatsapp_messages` / `whatsapp_message_packets` columns) **verified** against catalog.
- **`whatsapp_stitched_packets` vs `whatsapp_message_packets`:** **no FK** between them; **parallel** models — stitcher uses **`whatsapp_message_packets`** only in repo.
- **C2A audit (`20260518220000_*`) vs prod:** **high** overlap on tables, FKs, indexes, and **policy expression bodies**; **gaps:** no **`whatsapp_override_log_priority_check`** on prod, **no** `COMMENT ON TABLE` on audit tables, **`numeric(3,2)`** on suggestions confidence vs bare `numeric` in file, and **policy role target** presentation (`pg_policies` **`{public}`** vs migration **`TO authenticated`**) needs explicit security sign-off.

### Remaining **migration-history** issue

- **Thirteen remote-only** version rows still lack matching **`supabase/migrations/<version>_*.sql`** files in git (per worksheet + recovery plan). **Local-only** pending migrations and **two-way drift** may still exist.
- **`db push` / `repair` / `db pull`** remain **process-blocked** per execution strategy until reconciliation confidence and org gates are met—**independent** of Phase A’s “objects exist” conclusion.

---

## 3. Safe C2B scope (allowed)

| Category | Examples |
|----------|----------|
| **Documentation** | C2B RLS matrix drafts, JWT/`verify_jwt` decision records, operator role allowlists, reconciliation appendices. |
| **UI-only read surfaces** | Inbox read paths, TOOL 3/4 display-only panels; **no** new persistence. |
| **Non-mutating auth / RLS review** | Code review of policies and Edge handlers **without** merging SQL or deploying functions. |
| **Explicit boundary** | **No production write-path expansion** — no new mutations on `whatsapp_message_packets`, `whatsapp_messages`, audit tables, or finance tables via app/Edge/RPC in this lane. |

---

## 4. Blocked C2B / C2C scope (not allowed yet)

| Item | Reason |
|------|--------|
| **TOOL 5 manual override writes** | Governance requires verified JWT, `auth.uid()`, transactional audit, and aligned schema/history (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`). |
| **New RLS migrations** | Are **DDL** and interact with **`db push`** / drift policy. |
| **`migration repair` / `db push` / `db pull`** | Blocked per `SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` until gates satisfied. |
| **Deploy of new write Edge functions** | Same blast radius as write-path expansion; must not outrun RLS + history alignment. |

---

## 5. Security findings (action: review, not ship)

1. **`whatsapp_message_packets` / `whatsapp_stitched_packets`** — `pg_policies` shows **`whatsapp_packets_*`** policies with role aggregate **`{public}`**. Even if `USING` clauses effectively deny anon in some paths, this is **wider** than Sprint C2 **least privilege** and **must** be a C2B review item (may tighten to `authenticated` + role checks per governance).
2. **Audit tables (`whatsapp_override_log` / `whatsapp_suggestions_log`)** — Policy **expression bodies** match C2A file intent, but **catalog vs migration** differs on **`TO authenticated`** wording and **`{public}`** listing; **role binding review** required before trusting parity.
3. **`verify_jwt = false` writer surfaces** (readiness report §3.3) — **separate** from migration drift: operator-reply and other service-role writers need **threat model + payload validation** review; **not** unblocked by Phase A catalog alone.

---

## 6. Recommended next implementation slice

**Primary:** **C2B read-only UI + auth review** — inventory all user-visible WhatsApp surfaces, map each to PostgREST/Edge calls, confirm **no new writes**, document required JWT posture for any future TOOL 5 slug.

**Secondary:** **Policy spreadsheet** — one row per `whatsapp_*` policy: roles, cmd, `USING`/`WITH_CHECK` summary, owner (service vs human), gap vs governance doc §4.

**Explicit non-slice:** **No database changes** (no new migration files, no `ALTER POLICY` in prod, no deploy).

---

## 7. Go / no-go checklist before **any** write-path work resumes

| # | Gate | Owner / evidence |
|---|------|------------------|
| 1 | **Product + eng sign-off** on TOOL 5 fields, TOOL 6 persistence default (none), and audit table names (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §Approval gate) | PO + lead |
| 2 | **Migration reconciliation** — remote-only rows have **honest** local SQL or signed alternate; `migration list` story acceptable for next apply (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §4) | DBA / eng |
| 3 | **RLS posture** — `public` vs `authenticated` + role `EXISTS` patterns reviewed for **packets**, **stitched**, **audit** | Security / eng |
| 4 | **JWT** — plan for **`verify_jwt = true`** on human write surfaces; service-only pattern documented if any exception | Security / eng |
| 5 | **Staging apply dry-run** of pending migrations (when allowed) — **not** production until checklist complete | Eng |
| 6 | **No placeholder migrations** / no blind `repair` | Whole team |

**No-go** if any of **1–4** are unanswered or **migration list** remains unexplained for versions in the release scope.

---

*End of memo.*
