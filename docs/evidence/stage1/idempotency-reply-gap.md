# Stage-1 evidence: operator reply idempotency gap

**Status:** Known NO-GO gap (static audit). Staging duplicate-send proof still pending.  
**Date captured:** 2026-06-03  
**Scope:** WhatsApp operator inbox TOOL 1 — `whatsapp-operator-reply`

---

## Summary

`whatsapp-operator-reply` has **no proven idempotency or deduplication key** in the current codebase. Each operator send creates a new `whatsapp_messages` row and triggers a provider send via `send-whatsapp`.

Stage-1 treats operator reply as **NO-GO for send pilot expansion** until idempotency is designed, implemented, and verified.

---

## Static findings

| Item | Current state |
|------|----------------|
| Client invoke | `WhatsAppInbox.handleSendReply` — explicit click only; no client idempotency token |
| Edge handler | `supabase/functions/whatsapp-operator-reply/index.ts` — always `insert` then `update` on `whatsapp_messages` |
| Dedup key | None (no WAMID-style guard, no request UUID, no idempotency header) |
| Audit table | `whatsapp_override_log` exists in migrations; **not wired** from inbox reply path |
| JWT | `verify_jwt = false` for `whatsapp-operator-reply` (`supabase/config.toml`) |

---

## Expected failure mode (requires staging proof)

1. Operator double-clicks Send (or retries after slow network).
2. Two outbound `whatsapp_messages` rows with `provider: operator_reply` may be created.
3. Customer may receive duplicate WhatsApp messages.

**Pass criteria for future closure:** single logical send → at most one outbound provider delivery, enforced client + server with auditable idempotency key.

---

## Related evidence

- Static guard tests: `docs/evidence/stage1/ci-readonly-guard.log`
- Staging runbook item **E7 / P15:** duplicate-click proof on staging
- Evidence pack: `docs/WHATSAPP_STAGE1_GO_NO_GO_EVIDENCE_PACK.md` §1.4, §2.6

---

*This document records a known gap. It does not claim the gap is fixed or staging-verified.*
