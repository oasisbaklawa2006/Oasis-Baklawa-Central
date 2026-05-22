# C2C — Write-path threat model

**Purpose:** Identify threats before any mutation layer, TOOL 5, or queue work is approved. **Documentation only** — no mitigations are implemented by this file.

**Severity key:** **C** critical · **H** high · **M** medium · **L** low

---

## 1. Threat inventory (summary)

| # | Threat | Severity |
|---|--------|----------|
| 1 | Operator spoofing | H |
| 2 | JWT bypass / weak `verify_jwt` | C |
| 3 | Race conditions on packet state | H |
| 4 | Duplicate sends | H |
| 5 | Queue replay | H |
| 6 | Packet hijack (wrong tenant / packet) | C |
| 7 | Escalation abuse | M |
| 8 | Unauthorized reassignment | H |
| 9 | Audit tampering | C |
| 10 | Browser localStorage trust | M |
| 11 | Stale UI action | H |

---

## 2. Operator spoofing

| Field | Detail |
|-------|--------|
| **Severity** | **H** |
| **Probable cause** | Client sends `operator_id` or display name not bound to JWT subject; shared workstation accounts. |
| **Mitigation** | Edge derives actor solely from verified JWT; optional step-up auth for overrides; ban shared credentials for governed roles. |
| **Staging test required?** | Yes — attempt mismatched body operator id vs JWT; expect 403 and audit of rejection. |

---

## 3. JWT bypass

| Field | Detail |
|-------|--------|
| **Severity** | **C** |
| **Probable cause** | `verify_jwt=false` on user-callable function; leaked anon key used to invoke; CORS misconfiguration. |
| **Mitigation** | Enforce JWT on all user invocations; network isolate service functions; rotate keys; monitor anomalous invoke rates. |
| **Staging test required?** | Yes — unauthenticated and wrong-role invoke attempts. |

---

## 4. Race conditions

| Field | Detail |
|-------|--------|
| **Severity** | **H** |
| **Probable cause** | Stitcher updates packet while operator sends reply; two operators act on same packet; list refresh stale. |
| **Mitigation** | Optimistic locking; version echo; Edge re-reads row; conflict response with merge UX. |
| **Staging test required?** | Yes — parallel scripted requests and stitcher simulation. |

---

## 5. Duplicate sends

| Field | Detail |
|-------|--------|
| **Severity** | **H** |
| **Probable cause** | Double-click, retry after timeout, queue redelivery without idempotency. |
| **Mitigation** | Idempotency-Key header or body hash stored in DB; WhatsApp-side dedupe where applicable; UI debounce. |
| **Staging test required?** | Yes — rapid duplicate invokes; expect single external message. |

---

## 6. Queue replay

| Field | Detail |
|-------|--------|
| **Severity** | **H** |
| **Probable cause** | Message pulled from queue twice; worker crash after send but before ack. |
| **Mitigation** | At-least-once delivery with idempotent consumers; visibility timeout tuning; poison pill handling. |
| **Staging test required?** | Yes — kill worker mid-flight; verify no duplicate customer message. |

---

## 7. Packet hijack

| Field | Detail |
|-------|--------|
| **Severity** | **C** |
| **Probable cause** | IDOR: attacker guesses `packet_id` / `contact_id`; RLS gap exposes other tenant data. |
| **Mitigation** | Strict RLS by org/contact; Edge validates packet belongs to same principal as JWT claims; rate limits. |
| **Staging test required?** | Yes — cross-tenant packet id in body; expect deny + audit. |

---

## 8. Escalation abuse

| Field | Detail |
|-------|--------|
| **Severity** | **M** |
| **Probable cause** | Operators spam escalation to skip queue; false urgency. |
| **Mitigation** | Rate limits; supervisor-only ack; cost attribution; pattern alerts. |
| **Staging test required?** | Optional — policy tooling. |

---

## 9. Unauthorized reassignment

| Field | Detail |
|-------|--------|
| **Severity** | **H** |
| **Probable cause** | Missing role check on reassignment Edge path; UI exposes action to wrong module key. |
| **Mitigation** | Role matrix in blueprint; Edge + RLS dual enforcement; immutable audit on reassignment. |
| **Staging test required?** | Yes — lower role attempts reassignment. |

---

## 10. Audit tampering

| Field | Detail |
|-------|--------|
| **Severity** | **C** |
| **Probable cause** | Mutable log table; admin UPDATE on audit; missing FK to actor. |
| **Mitigation** | Append-only table; restricted privileges; hash chain or external SIEM export (future). |
| **Staging test required?** | Yes — attempt update/delete audit row as privileged DB user; must fail in prod-like perms. |

---

## 11. Browser localStorage trust risks

| Field | Detail |
|-------|--------|
| **Severity** | **M** |
| **Probable cause** | Future code mistakenly trusts saved views / notes as security or routing inputs. |
| **Mitigation** | Treat localStorage as UX convenience only; never send to Edge as authority for routing or authz; document invariants. |
| **Staging test required?** | No for current read-only features; yes if any server API accepts client notes. |

---

## 12. Stale UI action risks

| Field | Detail |
|-------|--------|
| **Severity** | **H** |
| **Probable cause** | Operator acts on old tab after packet closed or reassigned; optimistic UI hides errors. |
| **Mitigation** | Version checks; periodic soft refresh; disable send when realtime disconnect; show conflict banners. |
| **Staging test required?** | Yes — long-lived tab tests. |

---

## Review checklist (Phase 1)

- [ ] Confirm `verify_jwt` for all three existing Edge functions.
- [ ] Map each function to RLS policies and tables touched.
- [ ] Confirm whether classify/route persist anything today.
- [ ] Record existing logging sinks (Supabase logs, external APM).
- [ ] Assign owners for audit schema design (separate CR from this doc).
