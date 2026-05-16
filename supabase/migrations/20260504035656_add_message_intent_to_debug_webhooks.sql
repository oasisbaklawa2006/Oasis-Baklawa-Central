-- Additive migration: adds message_intent classification column to debug_webhooks.
-- Populated by the whatsapp-webhook edge function via rule-based classification
-- (Phase 3 Pass 2). Null for all existing rows; new rows get one of:
--   ORDER, ORDER_MODIFICATION, ORDER_CANCELLATION, COMPLAINT, PAYMENT_PROOF,
--   PURCHASE_ORDER_DOCUMENT, CLIENT_KYC_DOCUMENT, SO_REFERENCE,
--   DISPATCH_FOLLOWUP, PACKAGING_MATERIAL_REQUEST, GENERAL_INQUIRY,
--   INTERNAL_NOTE, OTHER
-- No constraint — value is informational and can be extended without migrations.

ALTER TABLE public.debug_webhooks
  ADD COLUMN IF NOT EXISTS message_intent text;
