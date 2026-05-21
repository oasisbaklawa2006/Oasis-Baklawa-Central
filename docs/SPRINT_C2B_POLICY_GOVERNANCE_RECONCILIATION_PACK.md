# Sprint C2B — WhatsApp policy / governance reconciliation pack (Phase B)

**Purpose:** Consolidate **Phase A** catalog evidence, **C2B unblock** decisions, **manual-control governance**, and **Supabase reconciliation gates** into a single **policy and authority** reconciliation pack for WhatsApp. This is **documentation only**.

**Naming note:** `docs/SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md` uses “Phase B” for **exact SQL recovery** of remote-only migrations. This document is **C2B Phase B** in the sense of a **governance / RLS / Edge authority** pack—not a substitute for migration-file recovery. Migration SQL recovery remains under that strategy’s Phases B–D.

**Rules for this deliverable:** No new migration SQL, no `repair` / `db push` / `db pull`, no Supabase CLI, no app or Edge code edits, no deploy, no push from this step.

**Sources:** `docs/SUPABASE_REMOTE_ONLY_MIGRATION_SQL_RECOVERY_WORKSHEET.md` (Phase A finance + WhatsApp, §W inventory), `docs/SPRINT_C2B_UNBLOCK_DECISION_MEMO.md`, `docs/SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`, `docs/SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md`.

**Repo inspection (read-only, this pass):** `supabase/config.toml`; `supabase/functions/whatsapp-message-stitcher/index.ts`; `supabase/functions/whatsapp-operator-reply/index.ts`; `supabase/functions/send-whatsapp/index.ts`; `supabase/functions/send-whatsapp-automation/index.ts`; `src/components/WhatsAppInbox.tsx`.

---

## 1. Executive summary

Production **Phase A** introspection shows the **WhatsApp backbone and audit tables** are largely **present** and align **closely** with local intent (`20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` for audit RLS shapes, stitcher column assumptions verified in the worksheet). **Finance Phase A** similarly shows strong object match with one notable **`storage.buckets`** semantic drift on `receipts` (`public = true` vs local intent `false`)—cross-cutting, not WhatsApp-only.

**C2B may proceed** on **read-only** work: documentation, policy matrices, UI paths that do not add persistence, and static review of RLS/JWT/Edge graphs **without** merging DDL or deploying new write surfaces.

**C2B/C2C remain gated** for **governed manual overrides (TOOL 5)**, **new RLS migrations**, **`migration repair` / `db push` / `db pull`**, and **deploy** of additional write-capable Edge paths until: (a) **migration history** reconciliation meets execution-strategy §4 gates, and (b) **security sign-off** closes open items on **`{public}` policy role presentation**, **audit policy binding vs `TO authenticated`**, **`verify_jwt = false`** on mutating paths, and **identity discipline** (`auth.uid()` vs body-supplied ids).

---

## 2. Current risk model

| Layer | Risk | Driver |
|-------|------|--------|
| **Migration history** | **High process risk** | Thirteen **remote-only** versions without matching `supabase/migrations/<version>_*.sql`; premature `repair` / `db push` can mis-order or duplicate DDL (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY` §2–4, §7). |
| **RLS role presentation** | **Medium authorization risk** | `pg_policies` shows **`{public}`** for `whatsapp_packets_*` and audit policies while C2A file uses **`TO authenticated`**; behavior may overlap for anon (no `auth.uid()`) but is **not** equivalent to explicit `authenticated` binding—needs review. |
| **Dual packet models** | **Medium consistency risk** | `whatsapp_stitched_packets` exists with RLS but **no FK** to `whatsapp_message_packets`; stitcher in repo uses **`whatsapp_message_packets` + `whatsapp_messages`** only—parallel/legacy path unclear. |
| **Edge + JWT** | **High trust-boundary risk** | Repo `config.toml` sets **`verify_jwt = false`** for stitcher, operator-reply, send-whatsapp, webhook, and suggestion functions—**any caller** with URL + anon key pattern can hit the gateway unless additional controls exist upstream. |
| **Operator identity** | **Medium governance gap** | `whatsapp-operator-reply` accepts optional `operator_id` in JSON and **logs** it; governance requires **`auth.uid()`** for trust and rejects body identity for authorization/audit (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §6). |
| **C2A file parity** | **Low–medium** | Prod missing **`whatsapp_override_log_priority_check`**, table **comments**, minor **`numeric(3,2)`** vs `numeric` on suggestions—documented in worksheet **W.4**. |

---

## 3. WhatsApp policy inventory table

**Legend:** **Prod (Phase A)** = names/findings from `SUPABASE_REMOTE_ONLY_MIGRATION_SQL_RECOVERY_WORKSHEET.md`. **Local git** = policies defined in tracked migrations where applicable. Empty **USING / WITH CHECK** cells mean “capture from `pg_get_expr` / migration file in follow-up”—not reproduced here to avoid stale paraphrase.

| Table / object | Policy name | Command | Roles (C2A / tracked migration text) | Roles (Phase A catalog note) | Notes |
|----------------|-------------|---------|--------------------------------------|-------------------------------|--------|
| `public.whatsapp_message_packets` | `whatsapp_packets_view` | SELECT | *(not in single C2A file)* | `{public}` in `pg_policies` | Least-privilege review; expression not line-diffed in worksheet. |
| `public.whatsapp_message_packets` | `whatsapp_packets_insert` | INSERT | — | `{public}` | Same. |
| `public.whatsapp_message_packets` | `whatsapp_packets_update` | UPDATE | — | `{public}` | Same. |
| `public.whatsapp_message_packets` | `whatsapp_packets_no_delete` | DELETE | — | `{public}` | Typically restrictive `USING (false)` pattern—confirm in catalog. |
| `public.whatsapp_messages` | `whatsapp_messages_finance_ops` | SELECT | — | *(prod named in worksheet)* | Finance-oriented read policy on messages path. |
| `public.whatsapp_stitched_packets` | `whatsapp_packets_*` (mirror naming) | mixed | — | `{public}` per worksheet | Parallel table; policy set mirrors packet-style names. |
| `public.whatsapp_override_log` | `override_log_view` | SELECT | `TO authenticated` + `user_role_map` / `roles.role_key` ∈ `operations`, `finance`, `director` | `{public}` presentation in catalog | Expression body **matches** C2A intent per worksheet; **role target mismatch** flagged. |
| `public.whatsapp_override_log` | `override_log_insert` | INSERT | `TO authenticated` + `role_key` ∈ `operations`, `director` | `{public}` | **No UPDATE/DELETE** policies for authenticated in C2A file. |
| `public.whatsapp_suggestions_log` | `suggestions_log_view` | SELECT | `TO authenticated` + same SELECT role set as override view | `{public}` | C2A: **no authenticated INSERT** (service / future path). |
| `public.whatsapp_buffer` | `Service role full access whatsapp_buffer` | ALL | `service_role` | *(assumed prod parity)* | `20260417113513_*`. |
| `public.whatsapp_buffer` | `Staff read whatsapp_buffer` | SELECT | `authenticated` + `is_internal_staff(auth.uid())` | — | Tracked migration. |
| `public.whatsapp_buffer` | `Staff insert whatsapp_buffer` | INSERT | `authenticated` + staff check | — | Tracked migration. |
| `public.whatsapp_config` | `Admins manage whatsapp_config` | ALL | `authenticated` + admin roles | — | `20260410113938_*`. |
| `public.whatsapp_config` | `Authenticated read whatsapp_config` | SELECT | `authenticated` | — | Tracked migration. |
| `storage.objects` | `Authenticated can upload whatsapp attachments` | INSERT | `authenticated`; bucket `whatsapp_attachments` | — | `20260411112153_*`; bucket **private** on prod per worksheet. |
| `storage.objects` | `Authenticated can read whatsapp attachments` | SELECT | `authenticated`; bucket filter | — | Same. |

**Follow-ups:** Complete **`pg_policies` / `pg_get_expr` export** for all `whatsapp_*` tables (worksheet **W.6** item 5) and attach as appendix when run.

---

## 4. Edge function authority inventory table

**Source of `verify_jwt`:** `supabase/config.toml` (all below are **`verify_jwt = false`** in repo).

| Function slug | `verify_jwt` (repo) | DB client credential | WhatsApp-relevant mutations / reads | Notes |
|----------------|---------------------|----------------------|----------------------------------------|--------|
| `whatsapp-message-stitcher` | false | `SUPABASE_SERVICE_ROLE_KEY` | **INSERT** `whatsapp_message_packets`; **UPDATE** `whatsapp_messages` (`packet_id`, `packet_sequence`, `is_raw`, `stitched_at`) | TOOL 0; POST body only adjusts window/batch; **no JWT / no role gate** in handler. |
| `whatsapp-operator-reply` | false | Service role | **INSERT** + **UPDATE** `whatsapp_messages` (outbound row + status); **HTTP** to `send-whatsapp` with **service role** bearer | Optional **`operator_id`** in payload—**must not** be used for governance trust (see §9). |
| `send-whatsapp` | false | Service role | Optional **INSERT** `whatsapp_contacts`, `whatsapp_messages` when `order_id` set; **INSERT** `debug_webhooks`, `audit_logs`, `client_interactions` | Outbound provider traffic; broad side effects beyond WhatsApp core. |
| `send-whatsapp-automation` | false | Service role | **INSERT** `whatsapp_automations`; calls `send-whatsapp` with service key | Order lifecycle triggers. |
| `whatsapp-webhook` | false | Service role | **INSERT** `whatsapp_buffer` and extensive writes across orders, notifications, etc. | Large blast radius; WhatsApp ingress path. |
| `whatsapp-otp` | false | Service role | *(OTP flow; confirm tables in separate pass)* | Listed in config adjacent to WhatsApp surface. |
| `whatsapp-identify-sender` | false | *(confirm in function)* | No `.insert/.update/.delete` in quick grep | Read-oriented; still JWT-off at gateway. |
| `whatsapp-classify-intent` | false | *(confirm)* | No `.insert/.update/.delete` in quick grep | TOOL 3 return-only intent per governance doc. |
| `whatsapp-route-packet` | false | *(confirm)* | No `.insert/.update/.delete` in quick grep | TOOL 4 return-only route suggestion. |

**Client app (`WhatsAppInbox.tsx`):** Uses **user-scoped Supabase client** for **SELECT** on `whatsapp_message_packets` and `whatsapp_messages`; **invokes** `whatsapp-operator-reply` (mutating), `whatsapp-classify-intent`, `whatsapp-route-packet` (suggestions). **Realtime** subscription on `whatsapp_message_packets`. Types note `whatsapp_*` **not** in generated DB types yet.

---

## 5. TOOL 5 freeze contract

Until **explicit approval** in `SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §**Approval gate**:

| Clause | Contract |
|--------|----------|
| **Implementation** | **Frozen** — no new Edge slug, no RPC, no UI that persists overrides. |
| **Auth** | Target: **`verify_jwt = true`** on any future write slug; **no** `verify_jwt = false` on browser-invoked override paths without a separately approved service design. |
| **Identity** | **Only** `auth.uid()` (and server-resolved staff id) for audit; **reject** body `operator_id` / `user_id` for authorization. |
| **Data** | Packet fields allowed to change are **TBD** and must be listed and signed off. |
| **Atomicity** | Packet update + **`whatsapp_override_log`** insert in **one transaction** (prefer `SECURITY DEFINER` RPC). |
| **RLS** | No new **`CREATE POLICY`** / migration work until execution-strategy **§4** and this pack’s checklist permit. |

---

## 6. TOOL 6 freeze contract

| Clause | Contract |
|--------|----------|
| **Default** | **Return-only** suggestions (TOOL 3/4 style)—**no** persistence to `whatsapp_suggestions_log` unless product approves audited capture. |
| **Persistence** | If later approved: rename contract to audited capture; JWT + role gate; RLS; retention/redaction; **no** silent writes. |
| **RLS file hint** | C2A migration defines **SELECT-only** authenticated policy on `whatsapp_suggestions_log`; **no** authenticated INSERT in file—aligns with “no silent persistence” default. |

---

## 7. C2B allowed scope

Aligned with `SPRINT_C2B_UNBLOCK_DECISION_MEMO.md` §3:

- **Documentation:** This pack, RLS matrices, JWT decision records, runbooks.
- **UI-only read surfaces:** Inbox list/detail, TOOL 3/4 panels **without** new `.insert`/`.update`/`.delete` on governed tables.
- **Non-mutating auth / RLS review:** Static analysis of policies and Edge graphs; **no** merged SQL, **no** deploy.
- **Explicit boundary:** **No production write-path expansion** beyond what already exists in deployed code—treat **operator reply** and **stitcher** as **in-scope for review** but **out-of-scope for expansion** until checklist passes.

---

## 8. C2B blocked scope

Aligned with memo §4 + execution strategy §2–4:

- **TOOL 5** manual override writes and new **`SECURITY DEFINER`** mutators touching packets + audit.
- **New RLS migrations** or policy **`ALTER`** in production from this lane.
- **`migration repair`**, **`db push`**, **`db pull`**, Supabase CLI apply flows.
- **Deploy** of new or changed **write** Edge functions (including flipping **`verify_jwt`** without a reviewed rollout).
- Treating **Phase A** alone as permission to **`db push`** (execution strategy §4).

---

## 9. Security findings requiring review

1. **`{public}` on `whatsapp_packets_*` and audit policies** — Tighten or document why `PUBLIC` target is acceptable vs explicit `TO authenticated` + role checks (`SPRINT_C2B_UNBLOCK_DECISION_MEMO.md` §5, worksheet **W.4**, **W.6**).
2. **Audit policy target mismatch** — `override_log_*` / `suggestions_log_view`: catalog vs C2A **`TO authenticated`** wording; security sign-off before trusting parity.
3. **`verify_jwt = false`** on **`whatsapp-operator-reply`**, **`whatsapp-message-stitcher`**, **`send-whatsapp`**, **`whatsapp-webhook`**, and suggestion slugs — **Gateway does not enforce user JWT**; threat model must cover anon-key + network access, rate limits, and **who may invoke** stitcher/reply.
4. **`operator_id` in `whatsapp-operator-reply` path** — Today logged only; future TOOL 5 **must not** elevate this pattern to trusted identity (governance §6).
5. **Missing `whatsapp_override_log_priority_check` on prod** — Route semantics / invalid priority values not DB-enforced until constraint exists or omission is accepted (worksheet **W.4**).
6. **`whatsapp_stitched_packets` vs `whatsapp_message_packets`** — Clarify product ownership and writers to avoid accidental dual writes or RLS gaps.

---

## 10. Go / no-go checklist for any write-path restart

| # | Gate | Evidence |
|---|------|----------|
| 1 | **Product + eng sign-off** on TOOL 5 fields, TOOL 6 persistence default, audit table names | `SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §Approval gate |
| 2 | **Migration reconciliation** per execution strategy §4 | Remote-only versions explained; **`migration list`** acceptable for release scope |
| 3 | **RLS posture** signed off | Packets, stitched, audit: role targets + `USING`/`WITH_CHECK` vs least privilege |
| 4 | **JWT plan** | `verify_jwt = true` for human write surfaces; documented exceptions |
| 5 | **Edge authority review** | Table in §4 updated with **staging/prod** invocation controls (keys, WAF, internal-only) |
| 6 | **Identity discipline** | No trusted `operator_id` from body on any new mutator; `auth.uid()`-backed audit |
| 7 | **Staging apply dry-run** | When migrations allowed—not production until rows 1–6 satisfied |
| 8 | **No placeholder migrations / no blind repair** | Team discipline (`SUPABASE_RECONCILIATION_EXECUTION_STRATEGY.md` §2) |

**No-go** if **1–4** or **6** are open for the intended release.

---

## 11. Recommended next implementation slice

1. **Export and spreadsheet** — One row per policy in §3: `pg_get_expr` summary, owner (human JWT vs service_role), and gap vs governance §4.
2. **Read-only UI + call map** — From `WhatsAppInbox.tsx`, document each user action → PostgREST vs `functions.invoke` → table side effects (distinguish **read** vs **reply** vs **suggestions**).
3. **`verify_jwt` decision record** — Per function in §4: intended caller, mitigations if remains `false`, and target state when write-path work resumes.
4. **No database changes** in this slice — per C2B memo and execution-strategy gates.

---

*End of pack.*
