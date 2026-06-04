# E2 / E3 — deferred (Session 1)

**Captured:** 2026-06-04

## E2 — Reply phone validation alert

**Status:** **DEFERRED** (not safely capturable in this session)

**Reason:**
- Validation requires packet with `<10` digit phone (`WhatsAppInbox.tsx` alert path).
- SQL: no `whatsapp_contacts` with `<10` digits; all open packets have valid phones.
- Inbox UI showed **0 packets** for dispatch/finance test logins (RLS `whatsapp_packets_view` requires `user_role_map.role_key` in `operations|finance|director`; test accounts lack mapping).

**Safe action:** Do not seed invalid phone via DB write in docs-only PR.

## E3 — Failed delivery read-only panel

**Status:** **DEFERRED**

**Reason:**
- SQL: zero `whatsapp_messages` rows with `provider = 'operator_reply' AND status = 'failed'`.
- Triggering failed send is **forbidden** without approval (Category D).

**Follow-up:** Re-run when pre-existing failed row exists or after approved failure simulation.
