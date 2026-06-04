# WA Stage-1 RLS Alignment — Staging Execution Pack

**Document type:** Deployment review (documentation only)  
**Phase:** 4 — execution pack  
**Design authority:** Phase 3 RLS alignment design (Option A)  
**Planned migration filename (not created in Phase 4):** `supabase/migrations/20260604120000_wa_stage1_inbox_reader_rls.sql`

---

## Authorization and environment scope

| Rule | Status |
|------|--------|
| **Staging first** | **Required.** All preflight, apply, post-verify, and browser evidence re-runs (E2–E5, E14) happen on **staging only** before any production discussion. |
| **Production apply** | **NOT AUTHORIZED.** This pack does not authorize production DDL, `db push`, or Supabase migration apply on the production project. |
| **Phase 4 agent actions** | **No SQL execution.** **No migration file creation.** **No staging mutation.** **No git push.** Review and approval only. |

**Staging targets (reference):**

| Item | Value |
|------|--------|
| App URL | `https://cursor-central-vercel.vercel.app` |
| Supabase project | `tcxvcatsqqertcnycuop` (oasis-baklawa) |
| Inbox path | `/admin/operator-inbox` |

---

## 1. Problem summary

Stage-1 WhatsApp operator inbox is deployed in **read-only** mode on staging. Browser evidence (Session 1, 2026-06-04) shows a healthy inbox shell but **0 open packets** for authenticated staff logins (`dispatch@oasisbaklawa.com`, `finance@oasisbaklawa.com`), blocking evidence items **E2, E3, E4, E5** and partial **E14** smoke.

The application query is correct: it selects `status = 'open'` from `whatsapp_message_packets` with an embedded `whatsapp_contacts` join and batched `whatsapp_messages` by `packet_id`. **Packets exist in the database** (15 open rows observed via service-role / DBA read-only introspection). The primary blocker is **Row Level Security (RLS)**, not missing data or an application filter bug.

Stage-1 GO/NO-GO remains **NOT GO** until inbox readers can see open packets under governed read-only policies aligned with Execution OS role keys (`get_user_role()`), not legacy `roles.role_key` values that are absent from the catalog.

---

## 2. Root cause proof

### 2.1 Application path (not the blocker)

`WhatsAppInbox.loadPackets` issues:

```287:309:src/components/WhatsAppInbox.tsx
      const { data: packetsData, error: packetsError } = await supabase
        .from("whatsapp_message_packets" as any)
        .select(
          `
          id,
          contact_id,
          fragment_count,
          status,
          first_message_at,
          last_message_at,
          stitched_content,
          whatsapp_contacts (
            phone_number,
            customer_name,
            wa_contact_id
          )
        `,
        )
        .eq("status", "open")
        .order("last_message_at", { ascending: false })
        .limit(PACKET_FETCH_LIMIT);
```

Thread messages load separately via `fetchMessagesForPacketIdsBatch` on `whatsapp_messages` filtered by `packet_id` (read-only SELECT).

**Conclusion:** No extra status filter, tenant filter, or Stage-1 guard narrows the packet list to zero.

### 2.2 RLS on `whatsapp_message_packets` (primary blocker)

Production/staging catalog (Phase A introspection + Session 1 analysis) includes policy **`whatsapp_packets_view`** on table **`whatsapp_message_packets`** (policy name only; not a SQL view).

Observed / documented predicate pattern (same family as C2A audit tables):

```sql
EXISTS (
  SELECT 1
  FROM public.user_role_map urm
  JOIN public.roles r ON r.id = urm.role_id
  WHERE urm.user_id = auth.uid()
    AND r.role_key = ANY (ARRAY['operations', 'finance', 'director'])
)
```

Tracked migration `20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` documents this dependency explicitly:

```7:10:supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql
-- RLS role_key dependency (NOT seeded in this migration): policies require rows in public.roles
-- joined via public.user_role_map with role_key IN ('operations','finance','director') for SELECT,
-- and ('operations','director') for INSERT on whatsapp_override_log. Ensure these keys exist in
-- the target environment's roles catalog (e.g. production) or authenticated access will be denied.
```

**Proof points:**

| Check | Expected on staging | Implication |
|-------|---------------------|-------------|
| Open packet row count (service role / bypass RLS) | **15** | Data present |
| `roles.role_key` ∈ `{operations, finance, director}` | **0 rows** | Legacy policy can never pass |
| Users with legacy-compatible `user_role_map` | **0** (incl. admin@, finance@, dispatch@) | No authenticated JWT passes `whatsapp_packets_view` |
| UI packet count for dispatch@ / finance@ | **0** | Matches RLS deny |

### 2.3 RLS on `whatsapp_contacts` (secondary blocker)

`whatsapp_contacts` has **RLS enabled** and **no SELECT policy** for authenticated inbox readers in the observed catalog. Even if packet SELECT were fixed, the PostgREST embed `whatsapp_contacts (...)` on the packet query would fail or omit contact fields without a matching SELECT grant.

### 2.4 RLS on `whatsapp_messages` (thread blocker)

Observed policy **`whatsapp_messages_finance_ops`** gates SELECT on finance/operations paths tied to **`order_id`** and JWT role claims — not **`packet_id`**. Inbox batch load uses `.in("packet_id", chunk)`. Catalog notes **17 of 18** messages are **`packet_id`-linked**; thread rendering stays empty under current policies even if packets appeared without contact embed.

### 2.5 App RBAC vs database RLS (separate layers)

| Layer | Mechanism | Effect on staging Session 1 |
|-------|-----------|-------------------------------|
| **Nav / module RBAC** | `ROLE_MODULE_ACCESS` + `moduleKey: "support"` | Finance: nav hides WhatsApp Inbox; dispatch: nav shows inbox |
| **URL access** | Soft — finance can open `/admin/operator-inbox` directly | Page loads; RLS still returns 0 rows |
| **Packet RLS** | `whatsapp_packets_view` legacy keys | **Denies all tested staff** |

Execution OS resolves identity via **`get_user_role()`** (uppercase keys such as `ADMIN`, `DISPATCH_MANAGER`, `FINANCE_HEAD`), not lowercase `operations` / `finance` / `director`:

```8:31:supabase/migrations/20260420060120_b24913ec-a26d-48c9-a6aa-dd35216e4fa6.sql
  SELECT COALESCE(
    (
      SELECT upper(r.role_key)
      FROM public.user_role_map urm
      JOIN public.roles r ON r.id = urm.role_id
      ...
    ),
    (SELECT upper(role) FROM public.users WHERE id = _user_id LIMIT 1)
  )
```

Example staging test accounts (Session 1):

| Account | `users.role` / profile | `get_user_role()` (documented) | Passes legacy packet RLS |
|---------|------------------------|--------------------------------|---------------------------|
| `dispatch@oasisbaklawa.com` | `dispatch_manager` / `DISPATCH_HEAD` | `DISPATCH_MANAGER` | **No** |
| `finance@oasisbaklawa.com` | finance head path | `FINANCE_HEAD` | **No** |
| `admin@` (expected inbox reader) | admin tier | `ADMIN` or `SUPER_ADMIN` | **No** |

**Root cause statement:** Legacy WhatsApp packet RLS was authored against **`user_role_map` + lowercase `roles.role_key`** values that **do not exist** in the Execution OS catalog. The Stage-1 inbox uses **`get_user_role()`-aligned** staff roles. No user in the staging test matrix satisfies the legacy predicate, so PostgREST returns **0 rows** despite **15 open packets**.

---

## 3. Recommendation — Option A (narrow inbox readers)

**Adopt Option A** for the first staging apply.

| Option | Inbox reader roles (`get_user_role()`) | Use case |
|--------|----------------------------------------|----------|
| **A (recommended)** | `SUPER_ADMIN`, `ADMIN`, `SUPPORT_EXECUTIVE` | Matches Stage-1 intent: governed **read-only** inbox for support/admin operators; smallest SELECT expansion |
| **B (staging convenience only)** | Option A **plus** `FINANCE_HEAD`, `FINANCE_EXEC`, `OPERATIONS_MANAGER`, `DISPATCH_HEAD`, `DISPATCH_MANAGER` | Unblocks dispatch/finance staging captures without reassigning test accounts; **wider visibility** — not recommended for production v1 |

**Option A rationale:**

1. Aligns inbox visibility with **`ROLE_MODULE_ACCESS`** support module (`SUPPORT_EXECUTIVE`, `ADMIN`, `SUPER_ADMIN` have `support`).
2. **SELECT-only** additive policies — no INSERT/UPDATE/DELETE broadening on core WhatsApp tables.
3. Does **not** drop legacy `whatsapp_packets_view` in v1 (additive permissive policies; avoids surprise for any future legacy-key remediation).
4. Keeps finance/dispatch at **0 packets** under Option A — documents expected gap until roles are deliberately expanded (Option B) or test accounts switch to admin/support.

**Implementation shape (Phase 3, unchanged):**

1. Create **`public.is_whatsapp_inbox_reader(uuid)`** — `STABLE SECURITY DEFINER`, delegates to **`get_user_role()`**.
2. Add **`whatsapp_packets_inbox_reader_select`** on `whatsapp_message_packets`.
3. Add **`whatsapp_contacts_inbox_reader_select`** on `whatsapp_contacts`.
4. Add **`whatsapp_messages_inbox_thread_select`** on `whatsapp_messages` **`WHERE packet_id IS NOT NULL`**.

**Explicitly out of scope for this migration:**

- Dropping or rewriting `whatsapp_packets_view`, `whatsapp_packets_insert`, `whatsapp_packets_update`, `whatsapp_messages_finance_ops`
- Audit tables (`whatsapp_override_log`, `whatsapp_suggestions_log`) — still on legacy `operations`/`finance`/`director` keys
- `whatsapp_stitched_packets`, buffer, config, automations, Edge functions, app code
- Any write policy

---

## 4. Schema change scope verification

| Object | Change in this migration | Allowed |
|--------|--------------------------|---------|
| `public.whatsapp_message_packets` | **ADD** policy `whatsapp_packets_inbox_reader_select` (SELECT only) | **Yes** |
| `public.whatsapp_contacts` | **ADD** policy `whatsapp_contacts_inbox_reader_select` (SELECT only) | **Yes** |
| `public.whatsapp_messages` | **ADD** policy `whatsapp_messages_inbox_thread_select` (SELECT only, `packet_id IS NOT NULL`) | **Yes** |
| `public.is_whatsapp_inbox_reader(uuid)` | **CREATE** helper function (no table DDL) | **Yes** (Phase 3 design) |
| All other tables / columns / indexes / constraints | **None** | — |

**Verifier assertion:** After apply, `pg_policies` should show **exactly three new policies** on the three WhatsApp tables above, plus one new function in `pg_proc`. No `ALTER TABLE ... ADD COLUMN`, no new tables, no changes to `whatsapp_override_log`, `whatsapp_suggestions_log`, `whatsapp_stitched_packets`, or non-WhatsApp objects.

---

## 5. Migration SQL (review copy — do not execute in Phase 4)

```sql
-- =============================================================================
-- WA Stage-1: Inbox reader RLS alignment (SELECT only)
-- Environment: STAGING FIRST — production NOT authorized
-- Option: A (narrow) — SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Helper: inbox reader gate (Execution OS role keys)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_whatsapp_inbox_reader(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT upper(public.get_user_role(_user_id)) = ANY (ARRAY[
    'SUPER_ADMIN'::text,
    'ADMIN'::text,
    'SUPPORT_EXECUTIVE'::text
  ])
$$;

COMMENT ON FUNCTION public.is_whatsapp_inbox_reader(uuid) IS
  'Stage-1 read-only operator inbox: grants SELECT on whatsapp_message_packets, whatsapp_contacts, and packet-linked whatsapp_messages. No write authority.';

-- -----------------------------------------------------------------------------
-- 2. whatsapp_message_packets — additive SELECT (legacy whatsapp_packets_view retained)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS whatsapp_packets_inbox_reader_select ON public.whatsapp_message_packets;

CREATE POLICY whatsapp_packets_inbox_reader_select
  ON public.whatsapp_message_packets
  FOR SELECT
  TO authenticated
  USING (public.is_whatsapp_inbox_reader(auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. whatsapp_contacts — enable embed for inbox packet query
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS whatsapp_contacts_inbox_reader_select ON public.whatsapp_contacts;

CREATE POLICY whatsapp_contacts_inbox_reader_select
  ON public.whatsapp_contacts
  FOR SELECT
  TO authenticated
  USING (public.is_whatsapp_inbox_reader(auth.uid()));

-- -----------------------------------------------------------------------------
-- 4. whatsapp_messages — thread rows linked to packets only
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS whatsapp_messages_inbox_thread_select ON public.whatsapp_messages;

CREATE POLICY whatsapp_messages_inbox_thread_select
  ON public.whatsapp_messages
  FOR SELECT
  TO authenticated
  USING (
    packet_id IS NOT NULL
    AND public.is_whatsapp_inbox_reader(auth.uid())
  );

COMMIT;
```

### Option B variant (staging convenience — document only, not default)

Replace the role array inside `is_whatsapp_inbox_reader` with:

```sql
'SUPER_ADMIN', 'ADMIN', 'SUPPORT_EXECUTIVE',
'FINANCE_HEAD', 'FINANCE_EXEC', 'OPERATIONS_MANAGER',
'DISPATCH_HEAD', 'DISPATCH_MANAGER'
```

Do **not** mix Option A and B on the same environment without explicit sign-off.

---

## 6. Rollback SQL (review copy — do not execute in Phase 4)

```sql
-- =============================================================================
-- Rollback: WA Stage-1 inbox reader RLS (staging)
-- Idempotent drops — safe to run if policies/function absent
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS whatsapp_messages_inbox_thread_select ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_contacts_inbox_reader_select ON public.whatsapp_contacts;
DROP POLICY IF EXISTS whatsapp_packets_inbox_reader_select ON public.whatsapp_message_packets;

DROP FUNCTION IF EXISTS public.is_whatsapp_inbox_reader(uuid);

COMMIT;
```

**Post-rollback expected behavior:** Inbox returns to **0 visible packets** for all staff tested in Session 1 (legacy RLS unchanged).

---

## 7. Preflight SQL (read-only — run before apply on staging)

Run in Supabase SQL Editor as a user with catalog read access. **Do not run migration DDL in Phase 4.**

```sql
-- =============================================================================
-- P0 — Environment guard
-- =============================================================================
SELECT current_database() AS db, current_user AS db_user, now() AS captured_at;

-- Confirm project/ref matches staging (human check): tcxvcatsqqertcnycuop

-- =============================================================================
-- P1 — Data baseline (service role or postgres; not end-user JWT)
-- =============================================================================
SELECT count(*) AS open_packet_count
FROM public.whatsapp_message_packets
WHERE status = 'open';
-- EXPECT: 15 (staging baseline at time of Phase 3 design; re-confirm at apply time)

SELECT count(*) AS total_messages,
       count(*) FILTER (WHERE packet_id IS NOT NULL) AS packet_linked_messages
FROM public.whatsapp_messages;
-- EXPECT: ~18 total, ~17 packet-linked (documented baseline)

-- =============================================================================
-- P2 — Legacy role_key catalog gap (root cause)
-- =============================================================================
SELECT role_key, role_name, is_active
FROM public.roles
WHERE role_key = ANY (ARRAY['operations', 'finance', 'director']);
-- EXPECT: 0 rows

SELECT count(DISTINCT urm.user_id) AS users_with_legacy_packet_keys
FROM public.user_role_map urm
JOIN public.roles r ON r.id = urm.role_id
WHERE r.role_key = ANY (ARRAY['operations', 'finance', 'director']);
-- EXPECT: 0

-- =============================================================================
-- P3 — Existing policies (before apply)
-- =============================================================================
SELECT schemaname, tablename, policyname, cmd, roles
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('whatsapp_message_packets', 'whatsapp_contacts', 'whatsapp_messages')
ORDER BY tablename, policyname;
-- EXPECT: whatsapp_packets_view present on whatsapp_message_packets
-- EXPECT: no whatsapp_*_inbox_reader_* policies yet
-- EXPECT: whatsapp_contacts — RLS on, 0 SELECT policies for authenticated (or none matching inbox)

-- =============================================================================
-- P4 — Test account role resolution (replace UUIDs with staging values)
-- =============================================================================
-- Resolve UUIDs:
SELECT id, email, upper(role) AS users_role
FROM public.users
WHERE email IN (
  'admin@oasisbaklawa.com',
  'finance@oasisbaklawa.com',
  'dispatch@oasisbaklawa.com'
);

-- For each id:
-- SELECT public.get_user_role('<uuid>'::uuid) AS resolved_role;
-- SELECT public.is_whatsapp_inbox_reader('<uuid>'::uuid) AS would_be_reader_after_apply;
-- EXPECT Option A: true for admin@ only; false for finance@ and dispatch@

-- =============================================================================
-- P5 — Simulate legacy deny (optional, JWT context)
-- =============================================================================
-- As authenticated test user in SQL editor "Run as user" (if available):
-- SELECT count(*) FROM public.whatsapp_message_packets WHERE status = 'open';
-- EXPECT before apply: 0 for dispatch@, finance@, admin@

-- =============================================================================
-- P6 — Idempotency / drift guard
-- =============================================================================
SELECT EXISTS (
  SELECT 1 FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'is_whatsapp_inbox_reader'
) AS inbox_reader_fn_already_exists;
-- EXPECT: false before first apply

SELECT count(*) AS inbox_policies_already_present
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'whatsapp_packets_inbox_reader_select',
    'whatsapp_contacts_inbox_reader_select',
    'whatsapp_messages_inbox_thread_select'
  );
-- EXPECT: 0 before first apply
```

**Preflight pass criteria:**

- Open packet count ≥ 1 (target **15** on staging).
- Legacy role keys **absent**; legacy policy users **0**.
- New policies and function **not** already present (unless intentional re-apply).
- Admin test user resolves to `ADMIN` or `SUPER_ADMIN`; `is_whatsapp_inbox_reader` would be **true** after apply under Option A.

---

## 8. Post-apply verification SQL (run after staging apply only)

```sql
-- =============================================================================
-- V1 — Objects created
-- =============================================================================
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_whatsapp_inbox_reader';
-- EXPECT: 1 row

SELECT tablename, policyname, cmd
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'whatsapp_packets_inbox_reader_select',
    'whatsapp_contacts_inbox_reader_select',
    'whatsapp_messages_inbox_thread_select'
  )
ORDER BY tablename;
-- EXPECT: 3 rows (one per table)

-- =============================================================================
-- V2 — Role gate spot checks (postgres / service context)
-- =============================================================================
-- Replace UUIDs from preflight P4
SELECT
  u.email,
  public.get_user_role(u.id) AS resolved_role,
  public.is_whatsapp_inbox_reader(u.id) AS is_inbox_reader
FROM public.users u
WHERE u.email IN (
  'admin@oasisbaklawa.com',
  'finance@oasisbaklawa.com',
  'dispatch@oasisbaklawa.com'
)
ORDER BY u.email;
-- EXPECT Option A: admin@ → is_inbox_reader true; finance@ and dispatch@ → false

-- =============================================================================
-- V3 — RLS row counts under reader identity (use "Run as user" / JWT simulation)
-- =============================================================================
-- As admin@ (inbox reader):
-- SELECT count(*) AS visible_open_packets
-- FROM public.whatsapp_message_packets
-- WHERE status = 'open';
-- EXPECT Option A: 15

-- As finance@:
-- EXPECT Option A: 0

-- As dispatch@:
-- EXPECT Option A: 0

-- =============================================================================
-- V4 — Embed + thread path (as admin@)
-- =============================================================================
-- Packet + contact embed (mirrors app query):
-- SELECT p.id, p.status, c.phone_number, c.customer_name
-- FROM public.whatsapp_message_packets p
-- LEFT JOIN public.whatsapp_contacts c ON c.id = p.contact_id
-- WHERE p.status = 'open'
-- LIMIT 5;
-- EXPECT: rows with non-null contact fields where contact exists

-- Messages for one open packet:
-- SELECT count(*) FROM public.whatsapp_messages
-- WHERE packet_id = '<open_packet_uuid>';
-- EXPECT: ≥ 1 for stitched packets

-- =============================================================================
-- V5 — Legacy policy still present (non-destructive v1)
-- =============================================================================
SELECT count(*) AS legacy_packet_view_policy
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename = 'whatsapp_message_packets'
  AND policyname = 'whatsapp_packets_view';
-- EXPECT: 1 (unchanged)

-- =============================================================================
-- V6 — No write policy expansion on core tables
-- =============================================================================
SELECT tablename, policyname, cmd
FROM pg_catalog.pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('whatsapp_message_packets', 'whatsapp_contacts', 'whatsapp_messages')
  AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  AND policyname LIKE '%inbox_reader%';
-- EXPECT: 0 rows
```

**Browser verification (after SQL pass):**

1. Log in as **`admin@oasisbaklawa.com`** → `/admin/operator-inbox` → observability shows **15 open packets** (or current open count); select packet → thread + insights render.
2. Log in as **`dispatch@`** / **`finance@`** → still **0 packets** under Option A (documented).
3. Re-run Session 2 evidence: **E4, E5** (and optionally E2) with packets visible for admin account.

---

## 9. Expected packet counts (Option A)

Baseline staging open packet count at design time: **15**.

| Authenticated user | `get_user_role()` | `is_whatsapp_inbox_reader()` | Visible open packets (post-apply) |
|--------------------|-------------------|------------------------------|----------------------------------|
| `admin@oasisbaklawa.com` | `ADMIN` or `SUPER_ADMIN` | **true** | **15** (or current `status = 'open'` count) |
| `finance@oasisbaklawa.com` | `FINANCE_HEAD` | **false** | **0** |
| `dispatch@oasisbaklawa.com` | `DISPATCH_MANAGER` | **false** | **0** |
| `SUPPORT_EXECUTIVE` test account (if provisioned) | `SUPPORT_EXECUTIVE` | **true** | **15** |

**Option B expected counts (reference only):**

| User | Visible open packets |
|------|----------------------|
| admin@ | 15 |
| finance@ | 15 |
| dispatch@ | 15 |

---

## 10. Risks and mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| **SELECT expansion** to admin/support roles | Medium | Option A minimal set; SELECT-only; Stage-1 app remains read-only (no new write paths) |
| **Option B widens** finance/dispatch visibility | Medium–High | Default to Option A on staging; use Option B only for time-boxed evidence capture with explicit approver note |
| **Dual policy stack** (legacy + new) | Low | Additive permissive SELECT; legacy keys still unused; document for future consolidation |
| **Audit tables unchanged** | Low | `whatsapp_override_log` / `whatsapp_suggestions_log` still require legacy keys — inbox read works; audit SELECT from UI may still fail until separate alignment |
| **`get_user_role()` drift** vs `users.role` | Low | Helper uses same function as Execution OS; test P4/V2 on staging UUIDs before apply |
| **Realtime channel** uses same RLS as SELECT | Low | Verify admin subscription receives packet events after apply |
| **Production apply without staging proof** | **Critical** | **Production NOT AUTHORIZED** in this pack; staging E4/E5/E14 partial re-run required |
| **Migration history drift** (remote-only WhatsApp versions) | Medium | This migration is narrow RLS-only on three tables; does not reconcile remote-only DDL; track in Supabase migration list separately |
| **`{public}` vs `TO authenticated` on legacy policies** | Low | New policies explicitly `TO authenticated`; does not widen anon |
| **Rollback during active inbox session** | Low | Rollback §6 returns to 0-packet state; schedule off-peak |

---

## 11. Execution checklist (human — not for Phase 4 agent)

| Step | Action | Owner |
|------|--------|-------|
| 1 | Engineering + DBA review this pack | Eng / DBA |
| 2 | Run **§7 Preflight** on **staging**; archive results under `docs/evidence/stage1/` | DBA |
| 3 | Security ack: SELECT-only, Option A scope, production deferred | Security |
| 4 | Create migration file from **§5** (Phase 5 — not Phase 4) | Eng |
| 5 | Apply on **staging only** via governed migration path | DBA |
| 6 | Run **§8 Post-apply verification** + browser checks | Eng |
| 7 | Re-capture E4, E5, E14 partial; update evidence pack | Eng |
| 8 | **Do not** apply to production until staging sign-off and explicit production authorization | All |

---

## 12. Related artifacts

| Artifact | Path |
|----------|------|
| Stage-1 GO/NO-GO evidence pack | `docs/WHATSAPP_STAGE1_GO_NO_GO_EVIDENCE_PACK.md` |
| Session 1 browser report | `docs/evidence/stage1/CAPTURE-SESSION-REPORT.md` |
| Staging evidence runbook | `docs/evidence/stage1/staging-evidence-runbook.md` |
| C2A audit RLS pattern (legacy keys) | `supabase/migrations/20260518220000_c2a_whatsapp_audit_tables_reconciliation.sql` |
| Policy governance pack | `docs/SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md` |

---

*Phase 4 deliverable complete. No SQL executed. No staging mutation. No migration file created. No git push.*
