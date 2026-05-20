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

| # | Field | Value |
|---|--------|--------|
| 1 | **version** | `20260514185811` |
| 2 | **remote name** | `add_finance_audit_columns_to_orders` |
| 3 | **likely affected** | `public.orders` (audit / finance verification columns, indexes, comments); possibly `auth.users` FK references. |
| 4 | **local related files** | `supabase/migrations/20260515120000_orders_finance_audit.sql` (finance verification columns on `orders` — **different version**; treat as **candidate** for diff only, not rename). |
| 5 | **required evidence source** | Original migration SQL from apply pipeline; OR introspection of `orders` column set + defaults vs repo; OR CI for `add_finance_audit_columns_to_orders`. |
| 6 | **recovery status** | unknown |
| 7 | **notes** | Remote timestamp **earlier** than local `20260515120000_*`; remote may be strict superset/subset—**content comparison mandatory**. |

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

## Worksheet change log

| Date | Change |
|------|--------|
| *(initial)* | Created with thirteen verified version/name pairs; statuses default `unknown`. |

---

*End of worksheet.*
