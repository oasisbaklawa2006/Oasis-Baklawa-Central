-- Clarification RPC execution hardening.
-- The clarification table deliberately exposes read-only RLS to authenticated
-- inbox readers; governed writes therefore execute through checked definer RPCs.

alter function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz)
  security definer;

alter function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb)
  security definer;

comment on function public.create_whatsapp_business_intake_clarification(uuid, text, text, uuid, text, timestamptz) is
  'Authorized, row-locked definer RPC for creating owned clarification work; direct table mutation remains unavailable.';

comment on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) is
  'Authorized, row-locked definer RPC for answering open clarification work with mandatory evidence; direct table mutation remains unavailable.';
