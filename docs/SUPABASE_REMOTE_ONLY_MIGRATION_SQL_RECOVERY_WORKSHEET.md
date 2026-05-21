# Remote-only migration SQL — recovery worksheet

**Purpose:** Track recovery of the **thirteen** migration versions present in **remote** `supabase_migrations.schema_migrations` but missing as `supabase/migrations/<version>_*.sql` in this repository.  
**Scope:** Documentation and evidence gathering only. **No** new migration files, **no** Supabase CLI, **no** `migration repair`, **no** `db push` / `db pull`, **no** deploy, **no** push.

**Project ref:** `tcxvcatsqqertcnycuop` (from `supabase/config.toml`).  
**Verified remote version + name pairs:** from Supabase `list_migrations` (read-only API), aligned with `docs/SUPABASE_REMOTE_ONLY_SQL_RESULTS.md`.

---

## Global rules

1. **No empty placeholder migrations.** A file whose body is empty or a no-op may satisfy filename checks but **lies** about what ran on the remote; new environments and audits will be wrong.

2. **Do not rename local migration files** to match remote version prefixes **without** a full **content and ordering** comparison against what remote history implies and what production actually contains. Renaming alone can hide duplicate DDL or wrong ordering.

3. **Every recovered file** (once drafted) must be **reviewed against production schema introspection** (read-only catalog queries, diff vs backups or clone) before any apply or history-alignment workflow—see `docs/SUPABASE_REMOTE_ONLY_MIGRATION_INTROSPECTION_PLAN.md` and `docs/SUPABASE_REMOTE_ONLY_INTROSPECTION_SQL_PACK.md`.

4. **C2B / C2 write-path work** stays blocked until drift is honestly reconciled per `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md`.

---

## Recommended recovery order

Process versions in **strict chronological order** by the `version` timestamp string (same as migration apply order on remote):

`20260423214633` → `20260514185811` → `20260514185829` → `20260514185852` → `20260515073922` → `20260515073940` → `20260517072741` → `20260517151438` → `20260517152907` → `20260517203808` → `20260518074624` → `20260518075520` → `20260518210953`

Reason: later migrations may assume objects created by earlier remote-only steps; recovery and review should respect dependency order.

---

## Worksheet entries

**Recovery status** legend: `unknown` (no trustworthy SQL yet) · `candidate` (possible source identified, not proven) · `verified` (exact applied SQL or equivalent provenance locked) · `rejected` (version spurious / duplicate / not to be recreated—document why).

Initial worksheet state: all **`unknown`** unless noted; use **notes** to flag **candidates** for investigation.

---

### 1. `20260423214633`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260423214633` |
| 2 | **remote name** | unknown *(empty in remote metadata)* |
| 3 | **likely affected tables / functions / policies** | Unknown until recovered. **Suspected:** same session as adjacent migrations touching `public.auth_logs` or related auth logging (see neighbors). |
| 4 | **local related files (different version prefixes)** | `supabase/migrations/20260423214346_f30d294b-923a-44da-9852-e4850ee33488.sql` (creates `auth_logs` + RLS), `supabase/migrations/20260423214837_bd2aae20-be63-418f-a62b-43366980cac7.sql` (`auth_logs.event_name`). |
| 5 | **required evidence source** | CI logs, dashboard SQL history, engineer notes, or ticket **between** `20260423214346` and `20260423214837`; optional `pg_dump --schema-only` diff vs backup at migration time. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Highest priority in April cluster: no descriptive remote `name`. Compare production `auth_logs` DDL to sum of the two neighbor files to infer gap. |

---

### 2. `20260514185811` — `add_finance_audit_columns_to_orders`

#### Recovery assessment (synthesized)

| Item | Conclusion |
|------|------------|
| **Status** | **candidate** — not `verified` until dashboard/CI SQL or production introspection confirms exact applied body (especially **`COMMENT ON COLUMN`**). |
| **Best candidate source (single file)** | **`supabase/migrations/20260515120000_orders_finance_audit.sql`** (current `main`). For a **body-only** slice matching the first git introduction (no column comments), use **`git show af99c86:supabase/migrations/20260515120000_orders_finance_audit.sql`**. |
| **Most likely original intent** (remote name `add_finance_audit_columns_to_orders`) | `ALTER TABLE public.orders` adding **`finance_verified_by`** (`uuid`, FK `auth.users`) and **`finance_verified_at`** (`timestamptz`); **add indexes** (`idx_orders_finance_verified_by`, `idx_orders_payment_status_finance`); **`COMMENT ON COLUMN`** on remote apply **maybe / maybe not** — **still unverified** (comments appear in git only from **`b4c3f55`** onward). |
| **Strong evidence** | **Timing:** remote `20260514185811` at **2026-05-14 18:58:11 UTC** immediately precedes **`af99c86`** (~**2026-05-14 19:38 UTC**) introducing the same DDL under **`20260515120000_*`**. **Same feature scope** (golden pipeline finance verification on `orders`). **Same finance audit objects** (`finance_verified_by` / `finance_verified_at` + indexes). **`af99c86`** is the first commit in `git log` touching this SQL path after the remote timestamp. |

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260514185811` |
| 2 | **remote name** | `add_finance_audit_columns_to_orders` |
| 3 | **likely affected** | `public.orders` (`finance_verified_by`, `finance_verified_at` per app/types + local migrations); indexes `idx_orders_finance_verified_by`, `idx_orders_payment_status_finance`; FK to `auth.users(id)`; optional `COMMENT ON COLUMN` if included in remote apply. |
| 4 | **local related files** | `supabase/migrations/20260515120000_orders_finance_audit.sql` (**different version prefix**). App: `src/pages/admin/FinanceReleaseBoard.tsx`; types: `src/integrations/supabase/types.ts` (and `database.types.ts`). |
| 5 | **required evidence source** | **History / provenance** still useful (logged SQL for remote version rows); **schema** side for this version satisfied by **Phase A** introspection (see **§Phase A**). |
| 6 | **recovery status** | **verified (Phase A — production catalog)** for **schema objects** covered by `20260515120000_orders_finance_audit.sql`; **migration history file** for remote version `20260514185811` still absent in git. |
| 7 | **notes** | Remote **2026-05-14 18:58:11 UTC** precedes first git introduction of the same DDL under `20260515120000_*` in **`af99c86`** (**~2026-05-14 19:38 UTC**), consistent with **remote-first apply** then repo commit under a **new** version. **`git log --all` never contains `20260514185811_*.sql`; pickaxe for version / remote name finds no `*.sql` outside docs.** |

#### Candidate SQL sources map (`20260514185811`)

| Priority | Source | How to retrieve | Contents vs remote name |
|----------|--------|-----------------|-------------------------|
| **A (primary body)** | Commit **`af99c86`** — `feat: finance release golden pipeline v1` | `git show af99c86:supabase/migrations/20260515120000_orders_finance_audit.sql` | `ALTER TABLE public.orders` adds `finance_verified_by`, `finance_verified_at`; two `CREATE INDEX IF NOT EXISTS`; **no** `COMMENT ON COLUMN`. Strongest **semantic** match for “add finance audit columns”. |
| **B (comments + format)** | Commit **`b4c3f55`** — `feat: add Golden Pipeline finance audit + receipt storage migrations` | `git show b4c3f55:supabase/migrations/20260515120000_orders_finance_audit.sql` | Same as (A) plus **`COMMENT ON COLUMN`** for both columns and wrapped `ALTER` / index DDL. Prefer if production **`pg_description`** shows these comments from the May 14 apply. |
| **C (current `main`)** | `supabase/migrations/20260515120000_orders_finance_audit.sql` | `git show HEAD:supabase/migrations/20260515120000_orders_finance_audit.sql` | Terminal state matches **(B)**. |
| **D (integration branch)** | `origin/cursor/integration-admin-stability-finance-golden-pipeline` | `git show origin/cursor/integration-admin-stability-finance-golden-pipeline:supabase/migrations/20260515120000_orders_finance_audit.sql` | Same **filename**; history includes `af99c86` / `b4c3f55` — **no** separate `20260514185811_*.sql` in that branch. |

**Searched — no in-repo artifact for version `20260514185811`**

| Area | Result |
|------|--------|
| **`rg` / `git log -S`** `20260514185811`, `add_finance_audit_columns_to_orders` on `*.sql`, `supabase/*` | Only **documentation** references (drift docs + this worksheet); **no** migration file ever used this version string. |
| **`git log -S 'finance_verified_by'`** / **`-S 'finance_verified_at'`** on `supabase/migrations/*.sql` | Commits **`b4c3f55`**, **`af99c86`** (orders finance audit file only). |
| **`.github/workflows/`** | **No** `supabase` / `migration` / `db push` steps; **no** in-repo CI log capture for this migration name or version. |
| **`gh pr list --search`** (`finance audit`, `migration`) | **No rows** returned in this environment — use GitHub UI / known PR URLs for run logs if needed. |

**Path to `verified`:** Compare production `orders` DDL + column comments to **(A)** then **(B)**; if comments were never applied remotely, recovered SQL for `20260514185811` should align with **(A)** only.

---

### 3. `20260514185829` — `add_payment_proof_audit_columns_to_order_payments`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260514185829` |
| 2 | **remote name** | `add_payment_proof_audit_columns_to_order_payments` |
| 3 | **likely affected** | `public.order_payments` (proof URL/path, verification columns, status, RLS); possibly `storage.objects` / buckets for receipts. |
| 4 | **local related files** | `supabase/migrations/20260515194500_buyer_payment_receipt_and_storage.sql` (extends `order_payments` + storage RLS — **different version**). |
| 5 | **required evidence source** | Same as §2; search logs for migration name string. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Part of May 14 triad (`…85811`, `…85829`, `…85852`)—recover evidence as one bundle if possible. |

---

### 4. `20260514185852` — `add_finance_exec_rls_policies`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260514185852` |
| 2 | **remote name** | `add_finance_exec_rls_policies` |
| 3 | **likely affected** | RLS `CREATE POLICY` / `ALTER POLICY` on `orders`, `order_payments`, or related finance views; may reference `user_role_map` / `roles.role_key`. |
| 4 | **local related files** | Policies may be embedded in `20260515120000_orders_finance_audit.sql`, `20260515194500_buyer_payment_receipt_and_storage.sql`, or other finance migrations—grep locally; **none** share this version. |
| 5 | **required evidence source** | SQL Editor history, PR branch, or `pg_policies` / `pg_class` introspection vs repo. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Completes May 14 triad; order should stay `85811` → `85829` → `85852` when reconstructing. |

---

### 5. `20260515073922` — `orders_finance_audit`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260515073922` |
| 2 | **remote name** | `orders_finance_audit` |
| 3 | **likely affected** | `public.orders` (audit columns / indexes); possible triggers or `audit_logs` references if naming is literal. |
| 4 | **local related files** | `supabase/migrations/20260515120000_orders_finance_audit.sql` (**semantic overlap** with remote name; **different** version prefix). |
| 5 | **required evidence source** | Proof whether remote row duplicates May 14 `add_finance_audit_columns_to_orders` or is a distinct change set; CI + production `information_schema.columns` diff. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | **Do not** assume local file equals remote version without diff—risk of double `ALTER` or column drift. |

---

### 6. `20260515073940` — `buyer_payment_receipt_and_storage`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260515073940` |
| 2 | **remote name** | `buyer_payment_receipt_and_storage` |
| 3 | **likely affected** | `public.order_payments`, `storage.buckets` / policies for buyer receipt uploads, grants on `storage.objects`. |
| 4 | **local related files** | `supabase/migrations/20260515194500_buyer_payment_receipt_and_storage.sql`. |
| 5 | **required evidence source** | Same as §5; confirm bucket names and RLS match production. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Pairs with `…73922` on same day—same operator/session hypothesis; bundle evidence. |

---

### 7. `20260517072741` — `orders_payment_rejection_reason`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260517072741` |
| 2 | **remote name** | `orders_payment_rejection_reason` |
| 3 | **likely affected** | `public.orders` column `payment_rejection_reason` (and comment); possibly related to `audit_logs` read model. |
| 4 | **local related files** | `supabase/migrations/20260516200000_orders_payment_rejection_reason.sql`. |
| 5 | **required evidence source** | Column DDL on production vs file body; CI for exact migration name. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Local file is minimal `ALTER TABLE orders ADD COLUMN`; confirm no extra constraints/indexes on remote. |

---

### 8. `20260517151438` — `20260517_whatsapp_messaging_backbone`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260517151438` |
| 2 | **remote name** | `20260517_whatsapp_messaging_backbone` |
| 3 | **likely affected** | WhatsApp core tables (e.g. conversations, messages, packets, or bridges to `whatsapp_config` / `whatsapp_buffer`—exact set TBD). |
| 4 | **local related files** | `20260410113938_*` (`whatsapp_config`), `20260417113513_*` (`whatsapp_buffer`); no local file matches this version. |
| 5 | **required evidence source** | Feature branch / Edge deploy ticket; `pg_tables` / `\d+` introspection for `whatsapp_*`; CI job name containing `20260517_whatsapp`. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Start of May 17 WhatsApp cluster—recover before provider abstraction row. |

---

### 9. `20260517152907` — `20260517_whatsapp_provider_abstraction`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260517152907` |
| 2 | **remote name** | `20260517_whatsapp_provider_abstraction` |
| 3 | **likely affected** | Provider/config tables, enums, or RPCs for multi-provider routing; may alter `whatsapp_config` or add new tables. |
| 4 | **local related files** | Same early WhatsApp migrations as §8; no version match. |
| 5 | **required evidence source** | Same as §8; schema diff after backbone migration. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | **~15 minutes** after `…51438` in version clock—likely same change train. |

---

### 10. `20260517203808` — `20260518_whatsapp_automations_table`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260517203808` |
| 2 | **remote name** | `20260518_whatsapp_automations_table` |
| 3 | **likely affected** | Table(s) for automations (e.g. `whatsapp_automations` or similar), indexes, RLS. |
| 4 | **local related files** | None with matching version; see `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` for **later** audit-side tables (override/suggestions log)—**not** assumed same migration. |
| 5 | **required evidence source** | CI + introspection for `whatsapp_%automation%` tables and policies. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Date in name (`20260518`) vs version date (`20260517`)—trust **version ordering** for apply sequence. |

---

### 11. `20260518074624` — `20260518_whatsapp_message_stitching_layer`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260518074624` |
| 2 | **remote name** | `20260518_whatsapp_message_stitching_layer` |
| 3 | **likely affected** | Stitching columns/tables/views (e.g. stitched message state, fragment links); may touch `whatsapp_message_packets` or predecessors. |
| 4 | **local related files** | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` references `whatsapp_message_packets` for FKs—production may already have stitching schema from **this** missing file. |
| 5 | **required evidence source** | Introspection of stitching-related objects; engineering design doc for “stitching layer”. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | May 18 pair with §12—bundle evidence. |

---

### 12. `20260518075520` — `20260518_whatsapp_raw_messages_and_packets`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260518075520` |
| 2 | **remote name** | `20260518_whatsapp_raw_messages_and_packets` |
| 3 | **likely affected** | `whatsapp_raw_messages`, `whatsapp_message_packets` (or similarly named), indexes, RLS, FK graph between raw and packet entities. |
| 4 | **local related files** | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` (depends on `whatsapp_message_packets` existing—**provenance** likely includes this missing migration). |
| 5 | **required evidence source** | Full DDL export for packet/raw tables; compare to C2A reconciliation file assumptions. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | **~9 minutes** after §11—likely one session. |

---

### 13. `20260518210953` — `whatsapp_tool5_tool6_audit_tables`

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260518210953` |
| 2 | **remote name** | `whatsapp_tool5_tool6_audit_tables` |
| 3 | **likely affected** | Audit tables for Tool 5 / Tool 6 (e.g. override/suggestions or sibling audit tables); RLS aligned to `user_role_map` / `roles.role_key` pattern. |
| 4 | **local related files** | `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` (`whatsapp_override_log`, `whatsapp_suggestions_log`, RLS) — **semantic overlap** with “audit tables” naming; **different version** and possibly **different** DDL scope. |
| 5 | **required evidence source** | CI for `whatsapp_tool5_tool6_audit_tables`; introspection vs `20260518220000` body line-by-line; Tool 5/6 design docs. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | **Earlier** than `20260518220000` on the same calendar day—apply order: **this row first**, then C2A reconciliation if both are in history. |

---

## FINANCE BUNDLE RECONCILIATION

**Scope:** Six remote-only versions (May 14–17, 2026 cluster) that align with **golden-pipeline / finance / buyer receipt** work in git under **different** local migration timestamps (`20260515120000`, `20260515194500`, `20260516200000`).

**Important:** Rows below are **bundle mapping hypotheses** for reconciliation planning. **`exact equivalent`** is used only where **no** stronger claim is made here—all finance rows are **partial**, **expanded**, or **unknown** per evidence available **without** production DDL diff. Do **not** treat this table as proof that remote SQL equals local file bodies.

| Remote version | Remote name (API) | Nearest current local migration(s) | Equivalent type | Key schema objects (inferred) | Confidence | Remaining unknowns |
|----------------|-------------------|-------------------------------------|-------------------|------------------------------|--------------|---------------------|
| `20260514185811` | `add_finance_audit_columns_to_orders` | `supabase/migrations/20260515120000_orders_finance_audit.sql` (see §2 synthesized assessment; body slice: `git show af99c86:…`) | **partial equivalent** | `public.orders.finance_verified_by`, `finance_verified_at`; indexes `idx_orders_finance_verified_by`, `idx_orders_payment_status_finance` | **Medium** (git timing + same objects + `af99c86` immediately after remote timestamp) | Whether remote included **`COMMENT ON COLUMN`**; whether any extra `ALTER` ran only on remote. |
| `20260514185829` | `add_payment_proof_audit_columns_to_order_payments` | `supabase/migrations/20260515194500_buyer_payment_receipt_and_storage.sql` (**PART A** column/index block only as semantic anchor) | **partial equivalent** | `public.order_payments` proof/verification columns (`proof_url`, `proof_storage_path`, `verified_by`, `verified_at`, `status`, `rejection_reason`) + related indexes | **Medium** (remote name matches PART A intent; local file is larger) | Whether remote May 14 apply included **only** columns or also **some** RLS/storage steps now folded into PART B–E locally. |
| `20260514185852` | `add_finance_exec_rls_policies` | `20260515194500_*` (RLS sections **only** as *possible* thematic overlap); **also** distant neighbors: `20260406201149_*` (generic `orders` UPDATE policies), other historical `orders` policy migrations | **unknown** | Finance-executive-facing RLS (name implies exec scope); not uniquely mirrored by a single local filename | **Low** | No local migration shares remote **name**; `20260515194500_*` policies are **buyer**-centric (`buyer_*`, receipt upload) per file—**do not** equate to “finance exec” without `pg_policies` diff. |
| `20260515073922` | `orders_finance_audit` | Same as `85811`: `20260515120000_orders_finance_audit.sql` | **unknown** | `public.orders` finance verification columns/indexes (same object family as `85811`) | **Low–medium** | **Two** remote rows (`85811` + `73922`) vs **one** local file—could be **duplicate remote record**, **split apply**, or **second DDL pass**; requires remote apply logs or DDL diff to classify further. |
| `20260515073940` | `buyer_payment_receipt_and_storage` | `supabase/migrations/20260515194500_buyer_payment_receipt_and_storage.sql` | **expanded equivalent** (local **superset** of likely remote intent) | `order_payments` extensions; `storage.buckets` / `storage.objects` policies; `orders` buyer receipt update policy | **Medium** | Which **subsets** of the local file ran on remote-only apply vs were added later in git; bucket `public` flag history. |
| `20260517072741` | `orders_payment_rejection_reason` | `supabase/migrations/20260516200000_orders_payment_rejection_reason.sql` | **partial equivalent** | `public.orders.payment_rejection_reason` (+ `COMMENT ON COLUMN` in local file) | **Medium** (same column intent; local version timestamp differs) | Local file is minimal—confirm no extra indexes/constraints on remote. |

**Bundle read:** Finance remote-only rows are **most consistent** with **historical timestamp drift / re-versioning**: remote-first applies logged under May **14–15** timestamps, then the same work appears in git as **`20260515120000` / `20260515194500` / `20260516200000`** (see `af99c86`, `b4c3f55`, `e91dae1` ancestry in git log). **`85852`** and **`73922`** remain the **weakest** links and need catalog evidence.

---

## WHATSAPP BUNDLE RECONCILIATION

**Scope:** Six remote-only versions (May 17–18, 2026) naming WhatsApp backbone, provider, automations, stitching, raw/packets, and tool audit tables.

**Important:** Local repo has **early** WhatsApp artifacts (`whatsapp_config`, `whatsapp_buffer`) under **April** `202604*` migrations and a **later** **`20260518220000`** “C2A” reconciliation file that **`CREATE TABLE IF NOT EXISTS`** audit tables and references **`whatsapp_message_packets`**. That proves **dependency** expectations in git, **not** that remote-only bodies were copied into any local file.

| Remote version | Remote name (API) | Nearest current local migration(s) | Equivalent type | Key schema objects (inferred) | Confidence | Remaining unknowns |
|----------------|-------------------|-------------------------------------|-------------------|------------------------------|--------------|---------------------|
| `20260517151438` | `20260517_whatsapp_messaging_backbone` | `supabase/migrations/20260410113938_7d53424f-2a03-4f2b-a811-bcbd1b4652c1.sql` (`whatsapp_config`); `supabase/migrations/20260417113513_ee89e417-a4bb-4cdc-9dd6-4ad6f30ff57a.sql` (`whatsapp_buffer`) — **temporal / domain neighbors only** | **unknown** | Unknown “backbone” tables/columns until introspection | **Low** | Whether May 17 remote replaces/extends April tables vs introduces **new** core tables. |
| `20260517152907` | `20260517_whatsapp_provider_abstraction` | Same April neighbors as above; no filename/name match | **unknown** | Provider tables/views/RPCs (TBD) | **Low** | No pickaxe hit in repo for this remote **name** in `*.sql`. |
| `20260517203808` | `20260518_whatsapp_automations_table` | No clear local file by name; search `whatsapp_automation` in repo yields no dedicated migration | **unknown** | Likely `whatsapp_automations` or similar | **Low** | Confirm existence via `pg_tables` / Supabase Table Editor. |
| `20260518074624` | `20260518_whatsapp_message_stitching_layer` | None with matching version; `20260518220000_*` references stitching-related **dependencies** only indirectly (via `whatsapp_message_packets` FK context) | **unknown** | Stitching layer columns/tables (TBD) | **Low** | Whether stitching is **only** columns vs new tables/views. |
| `20260518075520` | `20260518_whatsapp_raw_messages_and_packets` | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` (**dependency** on `public.whatsapp_message_packets` only—file does **not** create packets table body here) | **partial equivalent** (dependency / ordering evidence only) | `whatsapp_message_packets`, `whatsapp_raw_messages` (names from remote **name**; exact DDL unknown) | **Low–medium** | C2A file **assumes** packets exist—likely created by **this** missing migration or an **untracked** path; requires `pg_dump` / catalog. |
| `20260518210953` | `whatsapp_tool5_tool6_audit_tables` | `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` | **partial equivalent** | `whatsapp_override_log`, `whatsapp_suggestions_log`; RLS using `user_role_map` + `roles.role_key` | **Medium** (semantic overlap + **apply order**: remote `…210953` **before** `20260518220000` per version ordering) | Whether remote `…210953` DDL is **identical** to C2A sections or a **subset/superset** (different columns, extra audit tables). |

**Bundle read:** WhatsApp cluster is **split**: (a) **unknown / missing-in-repo** core DDL for backbone/provider/automations/stitching/raw+packets vs (b) **partial** overlap with **`20260518220000`** for **audit** tables and **packet FK** assumptions. This pattern fits **“production received migrations not yet represented as matching local files”** at least as strongly as pure timestamp drift.

---

## LEGACY UNKNOWN — `20260423214633`

| Field | Detail |
|-------|--------|
| **Remote version** | `20260423214633` |
| **Remote metadata name** | *(empty in migration API — see per-version §1)* |
| **Neighboring local migrations (same day, version order)** | **Before:** `supabase/migrations/20260423214346_f30d294b-923a-44da-9852-e4850ee33488.sql` — creates `public.auth_logs` + RLS. **After:** `supabase/migrations/20260423214837_bd2aae20-be63-418f-a62b-43366980cac7.sql` — adds `auth_logs.event_name`. |
| **Timeline positioning** | Remote timestamp **`20260423214633`** sits **between** `…214346` and `…214837` on **2026-04-23** (~21:43 → **21:46:33** → ~21:48 UTC). Suggests a **third** change in the same session as auth logging work—**not** proven to touch `auth_logs` only. |
| **Git history note** | `docs/ops/supabase-migration-reconciliation.md` documents that **no** git path has been found for this version under `supabase/migrations/`. |
| **Equivalent type** | **unknown** (insufficient evidence to map to a local file) |
| **Recovery status** | **unknown** (per §1 worksheet row) |

---

## Synthesis — missing features vs. timestamp drift?

**Short answer:** **Both patterns appear**, split by bundle.

| Bundle | Most likely interpretation (evidence basis) |
|--------|-----------------------------------------------|
| **Finance (six rows)** | **Primarily historical timestamp drift / remote-first apply** of work that later landed in git as **`20260515120000`**, **`20260515194500`**, **`20260516200000`**, supported by **commit timing** (`af99c86` after `85811`), **shared schema objects** (`finance_verified_*`, `order_payments` proof columns, `payment_rejection_reason`), and **migration naming** alignment for several remote `name` fields. **Exception / weak link:** `85852` and the **`85811` + `73922` pair** need catalog or logs—could hide **extra** policies or a **duplicate** remote row. |
| **WhatsApp (six rows)** | **Stronger case for “missing local SQL for production objects”** (or partial capture): remote **names** imply **new** tables/layers (`messaging_backbone`, `provider_abstraction`, `automations`, `stitching`, `raw_messages_and_packets`, tool audit) while git’s closest **`20260518220000`** file is a **later**, **idempotent reconciliation** that **references** `whatsapp_message_packets` rather than substituting the missing upstream DDL. Early **`202604*`** files are **weak** neighbors (domain match, **not** name/timing proof). |
| **`20260423214633`** | **Unknown**—could be a **small missing delta** between two known migrations or an **unrelated** hotfix; **no** descriptive remote `name` and **no** local file. |

**Do not** conclude “everything is only drift” or “everything is missing features” globally—**per-version verification** still gates any future file authoring.

---

## Risk assessment (bundle-level)

| Case | Description | When it applies |
|------|-------------|-----------------|
| **Safest** | Finance bundle maps to **already-reviewed** local SQL with **idempotent** `IF NOT EXISTS` patterns; recovered remote-only files (when written) are **no-ops** on production because objects already match. | After **production introspection** matches git bodies for `orders` / `order_payments` / `storage` policies; WhatsApp audit tables match `20260518220000` where intended. |
| **Medium** | **Partial overlap**: recovered SQL replays **subset** of DDL; some objects differ (column defaults, comments, policy names, `ENABLE ROW LEVEL SECURITY` ordering). Needs careful diff and possibly adjusted idempotent guards. | Typical when remote apply used **older** SQL than current `main` file (`b4c3f55` comments, expanded `15194500` parts). |
| **Dangerous** | **False equivalence**: assumed “same feature” leads to **`ALTER` / `CREATE POLICY`** that **conflicts** with true production state (duplicate constraints, policy redefinition, destructive `DROP`). Highest risk for **WhatsApp backbone/packets** where local git **does not** contain obvious equivalents. | If placeholders are used, or files are **renamed** without content proof, or **`migration repair`** is run before DDL truth is established (`docs/SUPABASE_REMOTE_ONLY_MIGRATION_RECOVERY_PLAN.md` warnings). |

---

## RECONCILIATION DECISION MATRIX

**Purpose:** One view of all **thirteen** remote-only versions for **planning** reconciliation—not a statement that production matches any local file.

**Confidence %:** Subjective **hypothesis strength** (evidence from git timing, naming, bundle mapping, and dependency hints). **Not** statistical certainty.

| Remote version | Remote name (API) | Current best local equivalent(s) | Reconciliation class | Operational risk if unreconciled | Recommended next action | Blocker level for future migration safety | Conf. % |
|----------------|-------------------|----------------------------------|----------------------|----------------------------------|---------------------------|-------------------------------------------|---------|
| `20260423214633` | *(empty)* | **None.** Neighbors only: `20260423214346_*`, `20260423214837_*` | **unknown** | **medium** *(unknown DDL may hide RLS/column drift on auth-adjacent objects)* | **compare production introspection** | **blocking** | **12%** |
| `20260514185811` | `add_finance_audit_columns_to_orders` | `20260515120000_orders_finance_audit.sql` (+ `git show af99c86:…` body slice) | **probable re-versioned migration** *(Phase A: prod DDL **matches** this file — see §Phase A)* | **low**–**medium** *(schema low; **history** still skewed)* | **recover exact SQL** (for history file) **after** Phase C sign-off | **caution** | **90%** *↑ Phase A* |
| `20260514185829` | `add_payment_proof_audit_columns_to_order_payments` | `20260515194500_buyer_payment_receipt_and_storage.sql` (PART A semantics) | **probable re-versioned migration** *(Phase A: PART A **exact** match)* | **low**–**medium** | **compare production introspection** (PART B–E for `73940`) | **caution** | **88%** *↑ Phase A* |
| `20260514185852` | `add_finance_exec_rls_policies` | `20260515194500_*` (RLS overlap **hypothesis**); `20260406201149_*` (distant `orders` UPDATE policies) | **unknown**; **partial overlap** (weak) | **high** *(mis-modeled finance RLS could break releases or widen access)* | **compare production introspection**; **verify against git history** | **blocking** | **22%** |
| `20260515073922` | `orders_finance_audit` | `20260515120000_orders_finance_audit.sql` | **historical drift** *(Phase A: same physical objects as `85811`; **duplicate** remote history row **likely**)* | **low**–**medium** | **recover exact SQL** / document duplicate | **caution** | **86%** *↑ Phase A* |
| `20260515073940` | `buyer_payment_receipt_and_storage` | `20260515194500_buyer_payment_receipt_and_storage.sql` | **probable re-versioned migration**; **partial mismatch** *(Phase A: PART A + policies match; **`storage.buckets.public`** mismatch)* | **medium** | **compare production introspection** (resolve bucket flag); **recover exact SQL** | **caution** | **70%** *↑ Phase A* |
| `20260517072741` | `orders_payment_rejection_reason` | `20260516200000_orders_payment_rejection_reason.sql` | **probable re-versioned migration** *(Phase A: column + comment **exact** match)* | **low**–**medium** | **recover exact SQL** (history) | **caution** | **92%** *↑ Phase A* |
| `20260517151438` | `20260517_whatsapp_messaging_backbone` | `20260410113938_*` (`whatsapp_config`); `20260417113513_*` (`whatsapp_buffer`); **Phase A:** full core graph **present** on prod | **likely missing local SQL** *(history)*; **probable drift** *(schema)* — see **§Phase A WhatsApp** | **medium**–**high** *(lower **schema** risk after Phase A; **history** risk unchanged)* | **recover exact SQL**; document drift | **blocking** | **72%** *↑ Phase A WhatsApp* |
| `20260517152907` | `20260517_whatsapp_provider_abstraction` | Same neighbors + prod `whatsapp_automations.provider` etc. **Phase A:** objects **present** | **likely missing local SQL** *(history)*; **probable drift** *(schema)* | **medium**–**high** | **recover exact SQL** | **blocking** | **68%** *↑ Phase A WhatsApp* |
| `20260517203808` | `20260518_whatsapp_automations_table` | **None** by name in repo; **Phase A:** `public.whatsapp_automations` **exists** with PK/FKs/indexes | **likely missing local SQL** *(history)*; **probable drift** *(schema)* | **medium**–**high** | **recover exact SQL** | **blocking** | **74%** *↑ Phase A WhatsApp* |
| `20260518074624` | `20260518_whatsapp_message_stitching_layer` | **Phase A:** `whatsapp_stitched_packets` **exists** (parallel stitch store); stitcher Edge uses `whatsapp_message_packets` | **likely missing local SQL** *(history)*; **probable drift** *(schema)* | **medium** | **recover exact SQL** | **blocking** | **70%** *↑ Phase A WhatsApp* |
| `20260518075520` | `20260518_whatsapp_raw_messages_and_packets` | **Phase A:** `whatsapp_messages` + `whatsapp_message_packets` **present**; Edge stitcher columns verified | **likely missing local SQL** *(history)*; **probable drift** *(schema)* | **medium** | **recover exact SQL** | **blocking** | **76%** *↑ Phase A WhatsApp* |
| `20260518210953` | `whatsapp_tool5_tool6_audit_tables` | `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` | **partial overlap** *(Phase A: **high** overlap; missing `priority` CHECK + table comments; policy role binding differs in catalog view)* | **medium** | **compare production introspection** (complete C2A diff); **recover exact SQL** | **caution** | **78%** *↑ Phase A WhatsApp* |

---

## EXECUTIVE SYNTHESIS

**Is the database probably missing functionality?**  
**Hypothesis—not certainty:** Production **may** include **WhatsApp-related** tables, policies, and relationships that are **not fully represented** in the repo’s migration files under matching version numbers—especially for **`messaging_backbone`**, **`provider_abstraction`**, **`automations`**, **`stitching`**, and **`raw_messages_and_packets`**. The **finance** side is **more plausibly** “already applied under different local timestamps” than “missing major features,” **except** where **`85852`** / the **`85811` + `73922`** pair could hide **extra** policies or **duplicate** history rows.

**Or is this mainly migration-history divergence?**  
**Hypothesis:** A **large fraction** of the **finance cluster** is consistent with **migration-history divergence** (remote-first applies, then git commits with **new** version prefixes). That explanation is **weaker** for the **WhatsApp cluster** and **weakest** for **`20260423214633`** (no name, no file, unknown object scope).

**Which bundle is the real danger?**  
**Hypothesis:** The **WhatsApp bundle** (six May 17–18 rows) carries the **highest operational danger** for future applies: local git **does not** clearly contain the DDL implied by remote **names**, and **`20260518220000`** alone **cannot** be assumed to subsume those six applies. **`85852`** and **`20260423214633`** are the **next-tier** danger points inside finance/legacy.

**Which bundle is likely administrative drift only?**  
**Hypothesis:** The **core finance column/index** work mapped to **`20260515120000`**, **`20260515194500`**, and **`20260516200000`** is the **best candidate** for “**administrative drift only**” **after** introspection confirms no extra remote-only objects—but **not** before verification. **Phase A (finance five)** now **supports** this hypothesis for **`85811` / `85829` / `73922` / `72741`**, with **`73940`** **qualified** by the **`receipts.public`** mismatch (see **§Phase A**).

---

## SAFE NEXT PHASE

**Production-safe reconciliation path (documentation / process only):**

1. **Read-only catalog pass** on production (or a **clone**): tables, columns, constraints, indexes, RLS policies, and `storage` policies for objects implied by the thirteen remote **names** and by neighbor bundles. Prefer the SQL packs in `docs/SUPABASE_REMOTE_ONLY_INTROSPECTION_SQL_PACK.md` / introspection plan—**no** DDL from this step.
2. **Line-by-line diff** of findings vs **candidate** local files named in the **Finance** and **WhatsApp** bundle sections and in §2 (`20260514185811` assessment). Record gaps in this worksheet or a linked runbook.
3. **Only after** (1)–(2): draft **`supabase/migrations/<version>_*.sql`** files with **honest, idempotent** SQL (still **out of scope** for this document update) and run a **normal PR review**—**not** `migration repair` as a first move.

**What must happen before any future `repair` / `db push` / `db pull`:**

- **No `repair`** until it is known whether each remote-only row is **duplicate**, **erroneous**, or **legitimately missing a file**—per `docs/SUPABASE_REMOTE_ONLY_MIGRATION_RECOVERY_PLAN.md`.
- **No `db push`** until `migration list` (or equivalent) can be shown **aligned** for the versions you intend to ship, or until an **explicit, signed** alternate strategy exists.
- **No `db pull`** as a shortcut while **two-way drift** persists (`docs/SUPABASE_DB_PULL_ANALYSIS_RESULT.md`).

**Evidence still missing (non-exhaustive):**

- **Exact SQL** (or logged statements) for **all thirteen** versions from apply pipelines.
- **Production introspection** proving whether **`COMMENT ON COLUMN`**, **extra indexes**, and **finance-exec-specific policies** from **`85852`** exist and match any local file.
- **WhatsApp** full DDL for **`whatsapp_message_packets`**, **`whatsapp_raw_messages`**, automations/stitching objects—**not** inferable from git alone.
- **Resolution** of whether **`73922`** duplicates **`85811`** on the remote history table — **Phase A (schema):** same physical `orders` objects as `85811`; duplicate-row story **strengthened** (still not a direct `schema_migrations` query in this pass).

---

## Phase A (read-only) — Production introspection vs local finance migrations

**When:** Recorded in worksheet update *(Phase A, finance subset only)*.  
**Method:** Read-only **`SELECT`** against linked production project **`tcxvcatsqqertcnycuop`** (Supabase MCP `execute_sql`). **No** DDL, **no** CLI `repair` / `db push` / `db pull`.  
**Scope this run:** Five remote-only finance versions listed below. **WhatsApp bundle** not queried in this pass.

### Per-remote verdict summary

| Remote version | Remote name | Local file compared | Overall verdict vs production | **Safe to treat as drift-only?** (schema sense) | Confidence *(post–Phase A)* |
|----------------|--------------|---------------------|--------------------------------|--------------------------------------------------|-----------------------------|
| `20260514185811` | `add_finance_audit_columns_to_orders` | `20260515120000_orders_finance_audit.sql` | **Exact equivalence** for columns, FK, indexes, column comments | **Yes** — objects match file; **history** still needs a file row for this version | **High** |
| `20260514185829` | `add_payment_proof_audit_columns_to_order_payments` | `20260515194500_*` **PART A only** | **Exact equivalence** for PART A columns, FK, defaults, indexes, column comments | **Yes** for **column/index/FK** scope of this remote name | **High** |
| `20260515073922` | `orders_finance_audit` | `20260515120000_orders_finance_audit.sql` | **Exact equivalence** to same `public.orders` objects as `85811` (no second DDL layer observed) | **Yes** — supports **duplicate migration-history row** hypothesis alongside `85811` | **High** |
| `20260515073940` | `buyer_payment_receipt_and_storage` | `20260515194500_*` **full file** | **Probable equivalence** with **one partial mismatch** (storage bucket visibility — see below) | **Cautious yes** for RLS + `order_payments`; **No** until `receipts` **`public`** flag reconciled with intended security model | **Medium–high** |
| `20260517072741` | `orders_payment_rejection_reason` | `20260516200000_orders_payment_rejection_reason.sql` | **Exact equivalence** for column + `COMMENT ON COLUMN` | **Yes** | **High** |

**Equivalence labels used:** **exact** = catalog match to migration text for listed objects; **probable** = match with known minor/config delta; **partial mismatch** = documented delta.

---

### A.1 `public.orders` vs `20260515120000_orders_finance_audit.sql` *(remote `85811` + `73922`)*

| Object | Expected (local file) | Production (introspection) | Match? |
|--------|------------------------|----------------------------|--------|
| Column `finance_verified_by` | `uuid`, nullable, FK `auth.users(id) ON DELETE SET NULL` | `uuid`, nullable; FK `orders_finance_verified_by_fkey` → `auth.users(id) ON DELETE SET NULL` | **Yes** |
| Column `finance_verified_at` | `timestamptz`, nullable | `timestamptz`, nullable | **Yes** |
| Comment `finance_verified_by` | UUID of finance executive… | Same text | **Yes** |
| Comment `finance_verified_at` | Timestamp when finance cleared… | Same text | **Yes** |
| Index `idx_orders_finance_verified_by` | `btree (finance_verified_by)` | `CREATE INDEX … ON public.orders USING btree (finance_verified_by)` | **Yes** |
| Index `idx_orders_payment_status_finance` | `btree (payment_status, finance_verified_at DESC)` | Same column order + `DESC` on `finance_verified_at` | **Yes** |
| RLS enabled | *(not set in this migration)* | `orders.relrowsecurity = true` | *(extra prod state; not a mismatch with file)* |

**Conclusion:** **`85811`** and **`73922`** both align with **one** physical DDL story identical to **`20260515120000_orders_finance_audit.sql`**. **`73922`** is **not** evidenced as a separate second schema layer—treat as **history-only** duplicate **hypothesis** (still not proven without `schema_migrations` row provenance).

---

### A.2 `public.order_payments` PART A vs `20260515194500_*` *(remote `85829`)*

| Object | Expected (local PART A) | Production | Match? |
|--------|-------------------------|------------|--------|
| `proof_url` | `text`, nullable | `text`, nullable; comment matches | **Yes** |
| `proof_storage_path` | `text`, nullable | same | **Yes** |
| `verified_by` | `uuid`, FK `auth.users` | `uuid`; FK `order_payments_verified_by_fkey` | **Yes** |
| `verified_at` | `timestamptz` | same | **Yes** |
| `status` | `text` default `'uploaded'` | default `'uploaded'::text`; comment matches | **Yes** |
| `rejection_reason` | `text` | same; comment matches | **Yes** |
| Indexes `idx_order_payments_status`, `idx_order_payments_order_status`, `idx_order_payments_verified_by` | per file | All three present with matching definitions | **Yes** |
| RLS | *(PART D separate)* | `order_payments.relrowsecurity = true` | *(consistent with later parts of same local file)* |

---

### A.3 `public.orders` payment rejection vs `20260516200000_*` *(remote `72741`)*

| Object | Expected | Production | Match? |
|--------|----------|------------|--------|
| `payment_rejection_reason` | `text`, nullable + comment | `text`, nullable; comment text matches file | **Yes** |

---

### A.4 Buyer receipt path vs `20260515194500_*` PART B–E *(remote `73940`)*

| Object | Expected (local file) | Production | Match? |
|--------|------------------------|------------|--------|
| Bucket `receipts` row | `INSERT … (id, name, public)` then `UPDATE … SET public = false` | `storage.buckets`: `id=receipts`, `name=receipts`, **`public = true`** | **No** — **partial mismatch** |
| Policy `buyer_update_submitted_order_receipt` on `public.orders` | `USING` / `WITH CHECK` company + status `submitted`/`under_review` | Present for `authenticated`; expressions semantically match (qualified `users` vs `public.users` in migration — equivalent) | **Yes** |
| Policies `buyer_insert_own_order_payments`, `buyer_read_own_order_payments` | per file | Both present; expressions semantically match | **Yes** |
| Storage policies `authenticated_upload_receipts`, `public_read_receipts`, `authenticated_delete_receipts` | expressions per file | All three exist; `USING` / `WITH CHECK` text matches migration intent (`bucket_id = 'receipts'`, JWT sub check, owner delete) | **Yes** |

**Unresolved mismatch:** **`storage.buckets.public = true`** for **`receipts`** vs local migration intent **`public = false`**. Possible explanations: (1) remote apply for `73940` did not include the `UPDATE`, (2) later manual/dashboard change, (3) different migration ordering. **Does not** by itself prove missing columns—**does** affect **public read** semantics vs file.

---

### A.5 Unresolved after this Phase A slice

- **`20260514185852`** `add_finance_exec_rls_policies` — **not** introspected in this pass (separate from the five focus versions).
- **Extra** `orders` / `order_payments` policies beyond the three named buyer policies — **not** exhaustively diffed against “finance exec” expectations.
- **WhatsApp** remote-only six — **deferred** (no queries this run).
- **`schema_migrations` row provenance** — not re-queried here; physical DDL match **does not** replace **history file** recovery for `db push` alignment.

---

### A.6 “Safe to treat as drift-only?” — per-version (schema-only wording)

| Version | Assessment |
|---------|--------------|
| `20260514185811` | **Yes** for **schema**: production matches `20260515120000_*`. **No** for **migration-list hygiene** until a matching file version or approved repair path exists. |
| `20260514185829` | **Yes** for **PART A** scope. |
| `20260515073922` | **Yes** as **duplicate history** of same `orders` DDL **hypothesis** (strengthened). |
| `20260515073940` | **Not fully** — resolve **`receipts`** bucket **`public`** flag vs security intent first. |
| `20260517072741` | **Yes** for **schema** vs `20260516200000_*`. |

**Stop point:** No `repair`, `db push`, or apply actions proposed here—**record-only** Phase A update.

---

## Phase A (read-only) — WhatsApp bundle introspection

**When:** Worksheet update *(Phase A, WhatsApp six remote-only versions)*.  
**Method:** Read-only **`SELECT`** on linked production **`tcxvcatsqqertcnycuop`** (Supabase MCP `execute_sql`). **No** DDL/DML, **no** CLI `repair` / `db push` / `db pull`.  
**Compared against:** `docs/SUPABASE_WHATSAPP_SCHEMA_INTROSPECTION_RESULTS.md`, `supabase/migrations/20260410113938_7d53424f-2a03-4f2b-a811-bcbd1b4652c1.sql`, `supabase/migrations/20260417113513_ee89e417-a4bb-4cdc-9dd6-4ad6f30ff57a.sql`, `supabase/migrations/20260411112153_df91b082-600a-4f92-8ff9-877e56bc7e02.sql` (storage bucket), `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`, and Edge assumptions in `supabase/functions/whatsapp-message-stitcher/index.ts` + `supabase/functions/whatsapp-operator-reply/index.ts`.

### W.0 Per-remote verdict (six WhatsApp remote-only versions)

| Remote version | Remote name | Verdict *(schema vs “likely local / committed intent”)* | **Drift-only?** *(schema sense)* | Confidence |
|----------------|-------------|-------------------------------------------------------------|-------------------------------------|------------|
| `20260517151438` | `20260517_whatsapp_messaging_backbone` | **Probable equivalence / drift-first:** all **nine** `public.whatsapp_*` base tables **exist** (`whatsapp_automations`, `whatsapp_buffer`, `whatsapp_config`, `whatsapp_contacts`, `whatsapp_message_packets`, `whatsapp_messages`, `whatsapp_stitched_packets`, `whatsapp_override_log`, `whatsapp_suggestions_log`). Tracked migrations cover **config + buffer** only partially; **no** single repo file proves this remote version string. | **Likely yes** for “backbone **objects exist**”; **No** for “**history file** exists” | **High** *(existence)* / **Medium** *(line-by-line SQL unknown)* |
| `20260517152907` | `20260517_whatsapp_provider_abstraction` | **Probable drift:** `whatsapp_automations` includes **`provider`** (and related columns per prior manual doc); FKs to `whatsapp_contacts`, `orders` **present** on prod. | **Likely yes** *(schema)* | **Medium–high** |
| `20260517203808` | `20260518_whatsapp_automations_table` | **Probable drift:** `public.whatsapp_automations` **exists** with PK, FKs, and indexes `idx_whatsapp_automations_order`, `_status`, `_trigger`. | **Likely yes** *(schema)* | **High** *(table-level)* |
| `20260518074624` | `20260518_whatsapp_message_stitching_layer` | **Probable drift:** `public.whatsapp_stitched_packets` **exists** (RLS on); indexes include `idx_whatsapp_packets_contact`, `_contact_sequence`, `_created`, `_status`. **No** FK to `whatsapp_message_packets` (parallel model — see **W.3**). | **Likely yes** *(schema)* | **Medium–high** |
| `20260518075520` | `20260518_whatsapp_raw_messages_and_packets` | **Probable drift:** `whatsapp_messages` + `whatsapp_message_packets` **present** with stitcher-relevant columns (`stitched_content` on packets; `packet_id`, `is_raw`, `stitched_at`, `message_timestamp`, … on messages — verified subset). FK `fk_whatsapp_messages_packet_id` → `whatsapp_message_packets`. | **Likely yes** *(schema)* | **High** |
| `20260518210953` | `whatsapp_tool5_tool6_audit_tables` | **Partial match vs `20260518220000_*`:** audit tables + indexes + FKs + **policy expression bodies** align with C2A file; **gaps** below (**W.4**). | **Mostly yes** for **objects**; **No** for **full C2A file parity** | **Medium–high** |

---

### W.1 Object inventory *(production `pg_catalog` / `information_schema`)*

| Table | RLS enabled *(prod)* | Notes |
|-------|------------------------|--------|
| `whatsapp_automations` | yes | PK + FKs to `whatsapp_contacts`, `orders`; 3 btree indexes on `order_id`, `status`, `trigger_type`. |
| `whatsapp_buffer` | yes | Matches tracked migration shape + indexes (`idx_whatsapp_buffer_sender`, `_status`); policies: service_role ALL, staff SELECT/INSERT. |
| `whatsapp_config` | yes | Tracked migration; admin + authenticated SELECT policies. |
| `whatsapp_contacts` | yes | Unique on `phone_number`; phone index. |
| `whatsapp_message_packets` | yes | PK; FK `contact_id` → contacts; self-FK `manual_merge_parent_id`; **CHECK** on `status` (`open`/`closed`). Policies `whatsapp_packets_{view,insert,update,no_delete}` on prod (names from `pg_policies`). |
| `whatsapp_messages` | yes | FKs to `contacts`, `orders`, `message_packets`; direction/status CHECKs; indexes incl. `packet_id`, `is_raw`, `contact_id`. Policy `whatsapp_messages_finance_ops` (SELECT). |
| `whatsapp_stitched_packets` | yes | PK; FK `contact_id` → contacts; self-FK `manual_merge_parent_id`; status CHECK; policies mirror packet-style `whatsapp_packets_*` names. |
| `whatsapp_override_log` | yes | FKs to `whatsapp_message_packets` CASCADE + `users` RESTRICT; 3 btree indexes match C2A names. |
| `whatsapp_suggestions_log` | yes | FK to `message_packets` CASCADE; 3 btree indexes match C2A names. |

**Triggers:** **None** returned for `public` + `whatsapp%` from `information_schema.triggers` *(empty set this run)*.  
**Public functions named `%whatsapp%`:** **None** in `pg_proc` for `public`/`auth` *(empty set this run; does not exclude generic triggers/functions outside name pattern)*.

---

### W.2 Storage *(WhatsApp-related only)*

| Bucket | `public` flag *(prod)* | Tracked intent |
|--------|-------------------------|----------------|
| `whatsapp_attachments` | **false** | `20260411112153_*` creates private bucket + policies. |
| `receipts` | **true** | Finance path (Phase A finance); not WhatsApp-specific—listed for cross-reference only. |

---

### W.3 `whatsapp_stitched_packets` vs `whatsapp_message_packets` *(relation)*

| Question | Finding |
|----------|---------|
| **FK between tables?** | **No** `FOREIGN KEY` from `whatsapp_stitched_packets` → `whatsapp_message_packets` (or reverse) in `pg_constraint` extract. |
| **How they relate operationally** | **`whatsapp_message_packets`** holds `stitched_content` jsonb and is what **`whatsapp-message-stitcher`** inserts/updates against (`whatsapp_messages.packet_id` links here). **`whatsapp_stitched_packets`** is a **parallel** table (columns include `message_ids` jsonb, `message_count`, `packet_sequence`, manual merge/split audit fields) with overlapping **naming** (`idx_whatsapp_packets_*`) but **separate** physical rows. |
| **Edge code** | Stitcher **does not reference** `whatsapp_stitched_packets` in repo body reviewed; operator-reply uses **`whatsapp_messages`** only. |

**Conclusion:** Treat as **dual persistence paths** / **legacy or alternate stitch store** until product/docs explain; **not** a simple parent/child FK pair.

---

### W.4 C2A audit tables vs `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql`

| Check | Production | `20260518220000` migration | Match? |
|-------|------------|---------------------------|--------|
| Tables exist | `whatsapp_override_log`, `whatsapp_suggestions_log` | `CREATE TABLE IF NOT EXISTS` both | **Yes** |
| Column sets | Override: `id…created_at` all **not null** where migration requires NOT NULL on key fields; `created_at` **`timestamp without time zone`** on both audit tables | Migration uses `timestamp without time zone` for `created_at` | **Yes** |
| FK `override.packet_id` → `whatsapp_message_packets` | **Present** `whatsapp_override_log_packet_id_fkey` CASCADE | Same | **Yes** |
| FK `override.operator_id` → `users` | **Present** RESTRICT | Same | **Yes** |
| FK `suggestions.packet_id` → `whatsapp_message_packets` | **Present** CASCADE | Same | **Yes** |
| Indexes (`idx_whatsapp_override_log_*`, `idx_whatsapp_suggestions_*`) | All six names **present** with btree defs matching migration | `CREATE INDEX IF NOT EXISTS` | **Yes** |
| RLS policies `override_log_view`, `override_log_insert`, `suggestions_log_view` | **Present**; `pg_get_expr` shows **`EXISTS (user_role_map ⋈ roles)`** with `role_key` arrays **matching** migration (`operations/finance/director` for SELECT; `operations/director` for INSERT on override) | Same SQL intent | **Yes** *(expression body)* |
| Policy roles *(catalog)* | `pg_policies` lists **`{public}`** for these policies; `pg_policy.polroles` empty → default **PUBLIC** target | Migration uses **`TO authenticated`** | **Catalog vs file wording mismatch** — **needs** governance review; **may** be behaviorally similar because `auth.uid()` is null for anon (EXISTS fails) **but** not identical to `TO authenticated`. |
| **`whatsapp_override_log_priority_check`** | **`has_priority_check = false`** | Migration adds CHECK `lower(priority)` ∈ `{high,normal,low}` when absent | **No** — applying C2A would **attempt** to add (or NOTICE on violation) |
| **`COMMENT ON TABLE`** for both audit tables | **`obj_description` = null** | Migration sets table comments | **No** |
| `suggestions_log.confidence` type | **`numeric(3,2)`** | Migration: **`numeric`** (no precision) | **Minor** — probable equivalence |

**C2A production-equivalence summary:** **High** confidence that **core DDL + RLS expression logic** in `20260518220000_*` describes production **closely**. **Not exact file-parity:** missing **`priority` CHECK**, missing **table comments**, and **policy role target** presentation differs from migration text.

---

### W.5 Edge function assumptions vs production *(read-only cross-check)*

| Assumption | Production evidence |
|------------|----------------------|
| `whatsapp-message-stitcher` reads/updates `whatsapp_messages` with `is_raw`, `packet_id` null filter, `direction` | Columns **`is_raw`**, **`packet_id`**, **`direction`**, **`message_timestamp`**, **`contact_id`**, **`content`**, **`created_at`** all **exist** on `whatsapp_messages`. |
| Inserts into `whatsapp_message_packets` with `stitched_content`, `fragment_count`, timestamps, `status` | Columns **`stitched_content`**, **`fragment_count`**, **`first_message_at`**, **`last_message_at`**, **`status`** **exist** on `whatsapp_message_packets`. |
| `whatsapp-operator-reply` writes `whatsapp_messages` | Table **exists** with expected core columns (reply path not fully enumerated this run). |

---

### W.6 Unresolved / follow-ups *(no repair or apply proposed here)*

1. **Remote-only SQL files** for all six WhatsApp versions — **still missing** in git; Phase A **does not** replace recovery.  
2. **`whatsapp_override_log_priority_check`** absent on prod — decide whether **idempotent apply** of `20260518220000` is desired **later** under Phase D gates, or document intentional omission.  
3. **Policy `TO public` vs `TO authenticated`** on audit tables — confirm with security review (Supabase/Postgres catalog vs migration text).  
4. **Purpose and writer** of `whatsapp_stitched_packets` vs `whatsapp_message_packets` — product + code audit (stitcher ignores stitched table).  
5. **Exhaustive** policy list beyond sampled names for `whatsapp_message_packets` / `whatsapp_messages` / `whatsapp_stitched_packets` — not diffed line-by-line to any single migration file this run.  
6. **`whatsapp_message_packets` / `whatsapp_stitched_packets` policies** appear as **`{public}`** in `pg_policies` for `whatsapp_packets_*` — broader than Sprint C2 **least-privilege** targets; needs dedicated C2B review even if schema exists.

---

### W.7 Does Phase A WhatsApp unblock **C2B / C2C**?

**Schema / “missing tables” angle:** Phase A **weakens** the hypothesis that production is **missing** the WhatsApp **core + audit** tables implied by remote names — objects **are** present and largely align with docs + C2A migration intent.

**Process / governance angle:** **`docs/SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md`** and drift worksheets still treat **`db push` / `repair`** and **new production migrations** as **gated** until migration **history** is reconciled. **C2B (RLS/auth hardening)** and **C2C (governed write paths)** should therefore still be treated as **blocked or high-caution** until org explicitly accepts residual **history skew** risk or completes later phases—**Phase A read-only does not, by itself, lift that gate.**

---

## Worksheet change log

| Date | Change |
|------|--------|
| *(initial)* | Created with thirteen verified version/name pairs; statuses default `unknown`. |
| *(update)* | **`20260514185811`:** Git history / branch / CI repo search + candidate SQL map (`af99c86` / `b4c3f55` / `HEAD` / integration branch); status → **candidate**. |
| *(update)* | **`20260514185811`:** Synthesized recovery assessment — best single-file candidate `20260515120000_orders_finance_audit.sql`; intent + evidence (timing, scope, objects, `af99c86`); comments on remote **unverified**. |
| *(update)* | **Bundle reconciliation:** Finance bundle, WhatsApp bundle, Legacy `20260423214633`, synthesis (drift vs missing features), and risk assessment (safest / medium / dangerous) sections added. |
| *(update)* | **Decision matrix + executive synthesis + safe next phase** appended (conservative hypotheses; confidence % labeled subjective). |
| *(update)* | **Phase A (read-only, finance subset):** Production introspection vs `20260515120000_*`, `20260515194500_*`, `20260516200000_*` for remote `85811`, `85829`, `73922`, `73940`, `72741`; **exact** match except `storage.buckets.public` on `receipts`; matrix + §2 + SAFE NEXT PHASE evidence note updated. |
| *(update)* | **Phase A (read-only, WhatsApp bundle):** Production catalog for six remote-only rows + C2A parity check; stitched vs message_packets; Edge column spot-check; matrix WhatsApp rows + **§W** section. |

---

*End of worksheet.*
