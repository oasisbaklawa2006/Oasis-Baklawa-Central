-- =============================================================================
-- Rollback: WA Stage-1 inbox reader RLS (staging)
-- Companion to: supabase/migrations/20260604120000_wa_stage1_inbox_reader_rls.sql
-- Environment: STAGING ONLY (tcxvcatsqqertcnycuop) — production NOT authorized
-- Idempotent drops — safe to run if policies/function absent
-- =============================================================================

BEGIN;

DROP POLICY IF EXISTS whatsapp_messages_inbox_thread_select ON public.whatsapp_messages;
DROP POLICY IF EXISTS whatsapp_contacts_inbox_reader_select ON public.whatsapp_contacts;
DROP POLICY IF EXISTS whatsapp_packets_inbox_reader_select ON public.whatsapp_message_packets;

DROP FUNCTION IF EXISTS public.is_whatsapp_inbox_reader(uuid);

COMMIT;
