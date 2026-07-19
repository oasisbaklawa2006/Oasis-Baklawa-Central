-- Enforce function-only mutation for zero-loss WhatsApp child control ledgers.
-- This migration changes privileges only. It does not mutate intake, order,
-- finance, dispatch, inventory, customer, or product data.

begin;

revoke insert, update, delete, truncate
  on table public.whatsapp_business_intake_clarifications
  from public, anon, authenticated;

revoke insert, update, delete, truncate
  on table public.whatsapp_business_intake_escalations
  from public, anon, authenticated;

revoke insert, update, delete, truncate
  on table public.whatsapp_shift_reconciliations
  from public, anon, authenticated;

comment on table public.whatsapp_business_intake_clarifications is
  'Owned clarification ledger for zero-loss B2B WhatsApp intake. Application roles have read-only table access; all mutations must use authorized governed RPCs.';

comment on table public.whatsapp_business_intake_escalations is
  'Owned escalation ledger for zero-loss B2B WhatsApp intake. Application roles have read-only table access; all mutations must use authorized governed RPCs.';

comment on table public.whatsapp_shift_reconciliations is
  'Shift reconciliation evidence for zero-loss B2B WhatsApp intake. Application roles have read-only table access; preparation and sign-off must use authorized governed RPCs.';

commit;
