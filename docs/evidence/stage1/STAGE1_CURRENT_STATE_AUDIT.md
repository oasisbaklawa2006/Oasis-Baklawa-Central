# Stage-1 Current State Audit (read-only)

**Date:** 2026-06-04  
**Branch audited:** `main`  
**Latest commit:** `80c1602fc8f2ac358458f3dda4594a264aa7fc67`  
**Merge message:** Merge pull request #172 from oasisbaklawa2006/cursor/wa-stage1-rls-phase6-evidence-d522  
**Staging project:** `tcxvcatsqqertcnycuop`  
**Production:** NOT touched

---

## Merged PR verification

| PR | Title (summary) | Merge commit on main | Present |
|----|-----------------|----------------------|---------|
| #168 | AST guard recovery (regex → AST scanner) | `39d6862` | ✅ |
| #169 | AST guard hardening (optional-chain, dynamic slugs) | `5000e28` | ✅ |
| #170 | Static Stage-1 evidence + staging runbook | `51313c9` | ✅ |
| #171 | Option A inbox RLS migration + preflight pack | `b0b383d` | ✅ |
| #172 | Phase 6 RLS post-apply evidence (E4/E5, screenshots) | `80c1602` | ✅ |

---

## Staging RLS (Option A)

| Item | Status |
|------|--------|
| Migration applied on staging | ✅ `wa_stage1_inbox_reader_rls` (version `20260604034227`) |
| Post-apply SQL verification | ✅ [`wa_stage1_rls_post_apply_verification.md`](./wa_stage1_rls_post_apply_verification.md) |
| finance@ / dispatch@ see 0 packets | ✅ SQL + browser screenshots |
| SUPPORT_EXECUTIVE / admin reader sees 15 open | ✅ SQL; browser via `support.stage1@` |
| Production apply | ❌ NOT AUTHORIZED |

---

## Evidence items — completed

| ID | Item | Artifact |
|----|------|----------|
| E4 | Governance bar disabled actions | `queue-disabled-governance-bar.png` |
| E5 | Resolution "not persisted" label | `audit-readonly-label.png` |
| E6 | Override audit log count | `audit-override-log-count.txt` |
| E7 | Idempotency reply gap (static) | `idempotency-reply-gap.md` |
| E9 | CI read-only guard log | `ci-readonly-guard.log` (137/137) |
| E11 | RBAC URL access note (static) | `rbac-url-access.md` |
| E12 | Full inbox visibility | `visibility-full-inbox-with-packets.png` |
| E20 | Suggestions log count | `audit-suggestions-log-count.txt` |
| — | RLS post-apply verification | `wa_stage1_rls_post_apply_verification.md` |
| — | finance/dispatch RLS browser | `rls-post-apply-finance-inbox.png`, `rls-post-apply-dispatch-inbox.png` |
| — | Temp evidence account doc | `wa_stage1_temp_evidence_account.md` |
| E18 | Webhook auto-order env (partial) | `webhook-auto-order-env.txt` (code default proven; staging secret not directly read) |

---

## Evidence items — open / blocked

| ID | Item | Status | Blocker |
|----|------|--------|---------|
| E1 | Load error alert banner | **Open** | Requires controlled network/URL break on staging |
| E2 | Reply phone validation alert | **Open** | Requires invalid-phone packet + send attempt |
| E3 | Failed delivery panel | **Blocked** | 0 failed `operator_reply` rows — [`e3-no-failed-row-available.md`](./e3-no-failed-row-available.md) |
| E8 | Suggestions error state | **Open** | Requires breaking classify/route Edge |
| E10 | RBAC nav hidden screenshot | **Open** | `rbac-nav-hidden.png` not captured; finance/dispatch direct URL partially documented |
| E13 | Human sign-off table | **Blocked** | Requires Eng/Ops/Security review |
| E14 | PR69 smoke checklist (full) | **Partial** | [`pr69-smoke-checklist-final.md`](./pr69-smoke-checklist-final.md) |
| E15 | Duplicate-click reply | **Open** | Staging send test (reply pilot NO-GO) |
| E16 | Observability partial-error | **Open** | Requires controlled query break |
| E17 | Realtime refresh banner | **Blocked** | [`e17-realtime-refresh-blocked.md`](./e17-realtime-refresh-blocked.md) |
| E19 | Webhook debug trail (new inbound) | **Open** | Requires authorized inbound message; historical rows exist (5421 total) |

---

## Validation (local, this audit)

| Command | Result |
|---------|--------|
| `npm run typecheck` | ✅ exit 0 |
| `npm run build` | ✅ exit 0 |
| `operatorInboxStage1Guard.test.ts` + invoke/postgrest scan | ✅ 21/21 |
| `waFlags.test.ts` | ✅ 5/5 |

---

## Temporary account

| Field | Value |
|-------|--------|
| Email | `support.stage1@oasisbaklawa.com` |
| Exists on staging | ✅ (SQL count = 1) |
| Banned | ❌ (active) |
| Cleanup | **Deferred** — Stage-1 evidence incomplete; see [`TEMP_ACCOUNT_CLEANUP_REPORT.md`](./TEMP_ACCOUNT_CLEANUP_REPORT.md) |

---

*Read-only audit — no mutations performed.*
