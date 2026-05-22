# C2C — Authority escalation review

**Purpose:** Map **who may cause what today** vs desired governance for C2C / WhatsApp operator expansion — **documentation only**.

**Legend (abbreviated columns in matrix):**  
**Cur** = Current authority · **Des** = Desired authority · **Miss** = Missing guard · **Aud** = Audit required · **Fin** = Finance required · **Lck** = Lock required · **RP** = Replay-safe required · **QQ** = Queue-safe required · **OK?** = Allowed today? (read-only era / org policy)

---

## Authority matrix

| Action | Cur | Des | Miss | Aud | Fin | Lck | RP | QQ | OK? |
|--------|-----|-----|------|-----|-----|-----|----|----|-----|
| reply | Client session + Edge service role; `operator_id` optional in body | Server-verified operator JWT + packet lease + idempotency key | JWT not verified at gate; no lease; no idempotency | Y | N | Y | Y | Y | Partial (functional but not hardened) |
| classify | Edge suggestion (`verify_jwt=false`) | Same model but JWT on ingress OR signed internal | Weak ingress auth | Optional | N | N | N | N | Y (suggest-only) |
| route | Edge suggestion (`verify_jwt=false`) | Hardened ingress + persistence gate before execution | No auto-execute in reviewed UI | Optional | N | N | N | N | Y (suggest-only) |
| reassign | Not a single dedicated C2C invoke in reviewed inbox — would be DB/ops elsewhere | Role-gated + audit + ownership transfer protocol | Centralized policy doc | Y | Maybe | Y | Y | Maybe | Case-by-case |
| escalate | Mix of human process + potential future automation | Ticket + audit + notification correlation | No unified escalate id | Y | Maybe | N | Y | Y | Process-dependent |
| resolve | Admin/support UIs (PostgREST) | Same + stronger closure audit | Depends on table RLS | Y | Maybe | N | N | N | Y under current RLS assumption |
| retry send | Manual user retry + provider fallback | DLQ worker with capped retries | No worker; ambiguous UI | Y | N | N | N | Y | Risky without idempotency |
| resend | Same as retry for WA | Dedupe fingerprint | No fingerprint | Y | N | N | N | Y | Risky |
| queue send | `notification_outbox` insert + manual process | Server worker + lease | Client processor | Y | If payment-related | N | Y | Y | Ops-tolerated |
| automation | `send-whatsapp-automation` Edge + cron-ish triggers | Policy + rate limits + audit | Broad JWT-off surface | Y | Maybe | N | Y | Y | Frozen for pilot scope |
| bulk actions | Inbox bulk filters local only; other admin bulk elsewhere | Batch idempotency + progress audit | Per-surface gaps | Y | Maybe | Y | Y | Y | Not C2C-unified |
| dispatch trigger | Admin flows + status inserts | Finance + dispatch locks | Race classes exist | Y | Often | Y | Y | Y | Existing business critical |
| finance release | `FinanceReleaseBoard` / accounts flows | Dual-control optional | Policy not encoded uniformly | Y | Y | Y | Y | Y | Existing high risk |
| TOOL 5 override | **Not implemented** (charter) | Human-in-loop + break-glass audit | All guards | Y | Maybe | Y | Y | Y | **Forbidden (future)** |
| packet ownership transfer | No dedicated C2C API reviewed | Explicit transfer RPC with two-party ack | Missing dedicated guard | Y | N | Y | Y | Maybe | Design-time only |

---

## CURRENT SAFE TODAY

- **Read-only operator inbox** surfaces: packet list, stitched content, local notes/saved views, CSV export (data already visible to role), classify/route **suggestions** that do not persist routing.
- **Authenticated B2B reads** and admin reads where RLS matches org intent.

---

## STAGING ONLY (not production-ready without prerequisites)

- **First-class idempotency + correlation** on operator reply and any new queue worker.
- **Shadow writes / dry-run** modes for routing automation (not implemented in this repo audit).
- **JWT-hardened** or **HMAC-signed** ingress to operator Edge functions.

---

## PRODUCTION FORBIDDEN (until explicitly cleared)

- Unbounded **automation** on WhatsApp send without human approval windows.
- **TOOL 5** override implementation (explicit charter freeze).
- **Bulk** outbound customer messaging without per-recipient caps and audit.

---

## FUTURE AUTHORITY MODEL (target)

1. **Verified actor** on every mutation (JWT or worker SA with narrow IAM).
2. **Resource locks** (packet, order, wallet) with TTL + heartbeats.
3. **Idempotency + dedupe** at ingress and at provider bridge.
4. **Append-only audit** with hash chain or tamper-evident storage for high-risk modules (stretch goal).
5. **Separation of duties** for finance release vs dispatch vs customer messaging.

---

## Cross-links

- `docs/C2C_REPO_WRITE_SURFACE_INVENTORY.md`
- `docs/C2C_JWT_AND_TRUST_BOUNDARY_AUDIT.md`
- `docs/C2C_IDEMPOTENCY_AND_REPLAY_REVIEW.md`
- `docs/C2C_PRE_IMPLEMENTATION_AUTHORITY_CHECKLIST.md` (prior PR)
