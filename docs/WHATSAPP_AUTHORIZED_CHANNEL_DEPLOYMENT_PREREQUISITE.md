# WhatsApp Authorized-Channel Deployment Prerequisite

## Purpose

Issue #232 requires that only the single approved official B2B WhatsApp receiving channel may create governed B2B intake records. Production deployment must therefore fail closed until the exact Meta receiving `phone_number_id` has been verified and registered.

## Protected deployment sequence

1. Confirm the exact production Meta `phone_number_id` from a known-good inbound webhook payload already stored in `debug_webhooks.raw_payload`.
2. Verify that the payload belongs to the official Oasis Baklawa B2B WhatsApp number and not to any B2C, test, vendor, employee, or future channel.
3. Insert exactly one active B2B allow-list row through a protected migration or SQL Editor session using an administrator-controlled credential.
4. Verify the row before enabling normal intake capture:

```sql
select provider, receiver_channel_id, business_domain, is_active
from public.whatsapp_authorized_business_channels
where business_domain = 'B2B'
  and is_active;
```

5. Run the protected historical reconciliation exactly through the service boundary:

```sql
select *
from public.reconcile_whatsapp_authorized_channel_history();
```

6. Require these counts to be reviewed before programme closeout:
   - `AUTHORIZED_CAPTURE_GAP = 0`
   - `AUTHORIZATION_CONFLICT = 0`
   - every `RECEIVER_ID_MISSING` and `CHANNEL_UNAUTHORIZED` row has an assigned governance owner and explicit next action
7. Re-running reconciliation is safe and must return `rows_inserted = 0` when no new historical messages exist.

## Prohibited actions

- Do not guess or hard-code a Meta `phone_number_id` from memory, screenshots, phone digits, or an unrelated environment.
- Do not seed the allow-list from application code or a public/authenticated client.
- Do not rewrite or delete historical `whatsapp_messages`, `debug_webhooks`, or `whatsapp_business_intakes` to make reconciliation appear clean.
- Do not classify an unauthorized or receiver-unknown message as B2B merely because its sender looks like a customer.
- Do not close Issue #232 from CI evidence alone; production allow-list verification and reconciliation output remain deployment prerequisites.

## Rollback boundary

The migrations add governance tables, read-only visibility, and protected functions. They do not deploy the webhook, alter Meta callback ownership, create orders, mutate finance/inventory/dispatch, or rewrite historical operational truth.
