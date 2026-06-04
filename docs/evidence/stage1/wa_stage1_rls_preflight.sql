-- =============================================================================
-- WA Stage-1 RLS alignment — PREFLIGHT (read-only)
-- Project: tcxvcatsqqertcnycuop (staging) — production NOT authorized
-- Migration: supabase/migrations/20260604120000_wa_stage1_inbox_reader_rls.sql
-- Option: A only (SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE)
-- Run in Supabase SQL Editor BEFORE applying migration. Archive results to
-- docs/evidence/stage1/wa_stage1_rls_preflight_results.txt
-- =============================================================================

-- =============================================================================
-- P0 — Environment guard
-- =============================================================================
SELECT current_database() AS db, current_user AS db_user, now() AS captured_at;
-- Human check: Supabase project ref must be tcxvcatsqqertcnycuop

-- =============================================================================
-- P1 — Data baseline (postgres / service role; bypasses end-user RLS)
-- =============================================================================
SELECT count(*) AS open_packet_count
FROM public.whatsapp_message_packets
WHERE status = 'open';
-- EXPECT: >= 1 (design baseline 15; re-confirm at apply time)

SELECT count(*) AS total_messages,
       count(*) FILTER (WHERE packet_id IS NOT NULL) AS packet_linked_messages
FROM public.whatsapp_messages;
-- EXPECT: packet_linked_messages >= 1 (design baseline ~17 of ~18)

-- =============================================================================
-- P2 — Legacy role_key catalog gap (root cause proof)
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
-- EXPECT: whatsapp_packets_view on whatsapp_message_packets
-- EXPECT: no whatsapp_*_inbox_reader_* policies yet

-- =============================================================================
-- P4 — Test account role resolution (Option A gate simulation)
-- is_whatsapp_inbox_reader() does not exist until after apply — simulate inline
-- =============================================================================
SELECT
  u.id,
  u.email,
  upper(u.role) AS users_role_column,
  public.get_user_role(u.id) AS resolved_role,
  upper(public.get_user_role(u.id)) = ANY (ARRAY[
    'SUPER_ADMIN'::text,
    'ADMIN'::text,
    'SUPPORT_EXECUTIVE'::text
  ]) AS would_be_inbox_reader_option_a
FROM public.users u
WHERE u.email IN (
  'admin@oasisbaklawa.com',
  'finance@oasisbaklawa.com',
  'dispatch@oasisbaklawa.com'
)
ORDER BY u.email;
-- EXPECT Option A: would_be_inbox_reader_option_a = true for admin@ only

-- =============================================================================
-- P5 — Legacy RLS deny simulation (optional — requires "Run as user" in editor)
-- =============================================================================
-- As dispatch@, finance@, or admin@ JWT:
-- SELECT count(*) AS visible_open_packets
-- FROM public.whatsapp_message_packets
-- WHERE status = 'open';
-- EXPECT before apply: 0 for all three test accounts

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

-- =============================================================================
-- P7 — Preflight pass summary (single row checklist)
-- =============================================================================
SELECT
  (SELECT count(*) FROM public.whatsapp_message_packets WHERE status = 'open') AS open_packets,
  (SELECT count(*) FROM public.roles
   WHERE role_key = ANY (ARRAY['operations', 'finance', 'director'])) AS legacy_role_keys,
  (SELECT count(*) FROM pg_catalog.pg_policies
   WHERE schemaname = 'public'
     AND policyname IN (
       'whatsapp_packets_inbox_reader_select',
       'whatsapp_contacts_inbox_reader_select',
       'whatsapp_messages_inbox_thread_select'
     )) AS inbox_policies_present,
  (SELECT EXISTS (
     SELECT 1 FROM pg_proc p
     JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'is_whatsapp_inbox_reader'
   )) AS inbox_fn_present,
  (SELECT count(*) FROM pg_catalog.pg_policies
   WHERE schemaname = 'public'
     AND tablename = 'whatsapp_message_packets'
     AND policyname = 'whatsapp_packets_view') AS legacy_packet_view_policy;
