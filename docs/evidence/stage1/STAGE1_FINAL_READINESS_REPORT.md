# Stage-1 Final Readiness Report — WhatsApp Operator Inbox

**Date:** 2026-06-04  
**Repository:** Oasis-Baklawa-Central @ `80c1602`  
**Staging:** `tcxvcatsqqertcnycuop`  
**Production:** NOT authorized

---

## Completed Evidence

| ID | Description | Artifact |
|----|-------------|----------|
| E4 | Governance bar disabled actions | `queue-disabled-governance-bar.png` |
| E5 | Resolution read-only label | `audit-readonly-label.png` |
| E6 | Override log SQL count | `audit-override-log-count.txt` |
| E7 | Idempotency gap (static NO-GO) | `idempotency-reply-gap.md` |
| E9 | CI read-only guard | `ci-readonly-guard.log` |
| E11 | RBAC URL note (static) | `rbac-url-access.md` |
| E12 | Full inbox visibility | `visibility-full-inbox-with-packets.png` |
| E18 | Webhook auto-order flag (partial) | `webhook-auto-order-env.txt` |
| E20 | Suggestions log SQL count | `audit-suggestions-log-count.txt` |
| — | RLS post-apply verification | `wa_stage1_rls_post_apply_verification.md` |
| — | RLS role deny browser proof | `rls-post-apply-finance-inbox.png`, `rls-post-apply-dispatch-inbox.png` |
| — | RBAC decision analysis | `RBAC_DECISION_RECOMMENDATION.md` |
| — | Current state audit | `STAGE1_CURRENT_STATE_AUDIT.md` |
| — | PR69 smoke (partial) | `pr69-smoke-checklist-final.md` |

**Merged engineering PRs on main:** #168, #169, #170, #171, #172 — all verified present.

---

## Missing Evidence

| ID | Description | Status |
|----|-------------|--------|
| E1 | Load error alert banner | Open |
| E2 | Reply phone validation alert | Open |
| E3 | Failed delivery panel screenshot | **Blocked** — `e3-no-failed-row-available.md` |
| E8 | Suggestions error state | Open |
| E10 | RBAC nav hidden screenshot | Open |
| E13 | Human sign-off (Eng/Ops/Security) | **Blocked** |
| E14 | Full PR69 smoke (14/14) | Partial — 4 PASS, 10 BLOCKED |
| E15 | Duplicate-click reply proof | Open |
| E16 | Observability partial-error banner | Open |
| E17 | Realtime refresh banner | **Blocked** — `e17-realtime-refresh-blocked.md` |
| E19 | New inbound webhook debug trail | Open (historical `debug_webhooks` data exists) |
| E18 | Staging secret direct read | Partial — code default only |

---

## Security Findings

### Open

| Finding | Severity | Notes |
|---------|----------|-------|
| Operator reply idempotency absent | High | Documented NO-GO — `idempotency-reply-gap.md` |
| Edge `verify_jwt = false` on WhatsApp functions | High | Anon-key invoke risk for reply/classify/route |
| Soft RBAC — direct URL allowed for admin-staff | Medium | Mitigated for data by RLS Option A; see RBAC decision doc |
| Temp staging account still active | Low | Deferred cleanup; credential outside git |
| E18 staging secret not independently verified | Low | Code defaults false; dashboard confirm pending |

### Closed

| Finding | Resolution |
|---------|------------|
| Inbox UI PostgREST writes | AST guard tests pass (137/137 wa-governance suite on main) |
| Staging inbox 0 packets for admin readers | RLS Option A applied — 15 open visible to inbox readers |
| Legacy RLS role_key mismatch | Addressed by `is_whatsapp_inbox_reader()` migration |
| Temp password in git | Redacted + rotated (PR #172 follow-up) |

---

## RLS Status

**Verified** on staging (Option A):

- Function `is_whatsapp_inbox_reader()` present
- Three inbox reader SELECT policies active
- admin@ / support.stage1@ → 15 open packets (SQL + browser)
- finance@ / dispatch@ → 0 packets (SQL + browser)
- Production apply: **NOT performed**

---

## Temporary Account Status

**Active** — `support.stage1@oasisbaklawa.com` exists, not banned. Cleanup deferred per [`TEMP_ACCOUNT_CLEANUP_REPORT.md`](./TEMP_ACCOUNT_CLEANUP_REPORT.md).

---

## Recommendation

### **GO WITH CONDITIONS**

**Read-only observation pilot on staging may proceed** subject to:

1. **Operator reply send remains NO-GO** — do not expand to governed send until idempotency + Edge JWT hardening.
2. **Complete open evidence** E1, E2, E8, E10, E14 blocked rows, E15, E16 in a dedicated staging browser session.
3. **Human sign-off** E13 (Engineering, Operations, Security/Governance).
4. **Confirm E18** in Supabase Dashboard secrets (unset or not `true`).
5. **Disable temp account** on staging after sign-off.
6. **Production RLS / inbox changes:** remain NOT AUTHORIZED until separate production approval.

**Not recommended:** Full staging operational sign-off as unconditional **GO** — 10 smoke items blocked, 3 E-items blocked, human sign-off absent.

**Not recommended:** **NO-GO** for read-only planning — static guards, RLS fix, and core visibility evidence are materially complete.

---

*Evidence collected only — no fabricated screenshots, SQL, or sign-offs.*
