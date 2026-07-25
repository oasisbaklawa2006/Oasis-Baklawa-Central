-- Restore the governed clarification answer path after direct table mutation was revoked.
--
-- The original answer RPC remained SECURITY INVOKER while authenticated UPDATE on
-- whatsapp_business_intake_clarifications was revoked by the closure hardening
-- migration. That combination makes the approved RPC unusable for authenticated
-- inbox operators. Keep direct DML denied and execute only this checked RPC with
-- the function owner's authority.
--
-- Scope remains limited to clarification/intake/audit governance. This migration
-- creates no orders or drafts and writes no finance, dispatch, inventory,
-- Customer Master, or Product Master truth.

alter function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb)
  security definer;

revoke all on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) from public;
revoke all on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) from anon;
grant execute on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) to authenticated;

comment on function public.answer_whatsapp_business_intake_clarification(uuid, text, jsonb) is
  'Authorized, row-locked clarification answer transition. Runs as SECURITY DEFINER because direct table mutation remains revoked; validates the authenticated inbox reader and records immutable audit evidence.';
