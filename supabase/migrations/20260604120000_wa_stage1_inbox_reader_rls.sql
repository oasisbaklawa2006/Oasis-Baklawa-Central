-- WA Stage-1: Inbox reader RLS alignment (SELECT only)
-- Environment: STAGING FIRST — production NOT authorized
-- Option A (narrow): SUPER_ADMIN, ADMIN, SUPPORT_EXECUTIVE via get_user_role()
-- Scope: whatsapp_message_packets, whatsapp_contacts, whatsapp_messages + helper function only
-- Legacy whatsapp_packets_view and whatsapp_messages_finance_ops are NOT dropped in v1

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
