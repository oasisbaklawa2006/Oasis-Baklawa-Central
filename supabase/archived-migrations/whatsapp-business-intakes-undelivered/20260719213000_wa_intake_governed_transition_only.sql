-- Close the Issue #232 direct-update bypass on canonical WhatsApp intakes.
-- Authenticated operators must mutate lifecycle state only through the governed
-- SECURITY DEFINER transition/escalation functions, which enforce authorization,
-- locking, legal transitions, ownership/next-action preservation, closure reasons,
-- reconciliation, and immutable audit evidence.

begin;

-- Remove the legacy broad authenticated UPDATE route.
drop policy if exists whatsapp_business_intakes_inbox_reader_update
  on public.whatsapp_business_intakes;

-- Defence in depth: authenticated callers retain SELECT/INSERT policies but no
-- direct table-level UPDATE privilege. SECURITY DEFINER governance functions
-- continue to perform narrowly checked updates as their owner.
revoke update on table public.whatsapp_business_intakes from authenticated;
revoke update on table public.whatsapp_business_intakes from anon;

comment on table public.whatsapp_business_intakes is
  'Canonical authorized-channel intake ledger. Authenticated lifecycle mutation is function-only; direct UPDATE is prohibited to preserve Issue #232 zero-loss governance and immutable audit evidence.';

commit;
