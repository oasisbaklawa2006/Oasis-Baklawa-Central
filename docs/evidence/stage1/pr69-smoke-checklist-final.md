# PR #69 Operator Inbox Smoke — Final Stage-1 Checklist

**Date:** 2026-06-04  
**Environment:** Staging — https://cursor-central-vercel.vercel.app  
**Reference:** `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md`  
**Accounts used in prior sessions:** `support.stage1@oasisbaklawa.com` (SUPPORT_EXECUTIVE), `finance@`, `dispatch@`  
**Local CI (this sprint):** `npm run typecheck` ✅ · `npm run build` ✅ · Stage-1 AST guards ✅

Legend: **PASS** = evidenced · **FAIL** = proven broken · **BLOCKED** = not executed / cannot verify without forbidden mutation

---

| # | Check | Status | Evidence / notes |
|---|-------|--------|------------------|
| 1 | Page load — no blank screen or error overlay | **PASS** | `visibility-full-inbox-with-packets.png`; temp account session report |
| 2 | List — packets render, scroll works | **PASS** | 15 packets shown for inbox reader role |
| 3 | Detail — selecting packet opens thread | **PASS** | Implied by full inbox capture; thread column visible in screenshot |
| 4 | Search focus — `/` focuses filter | **BLOCKED** | Not re-tested this sprint (keyboard smoke deferred) |
| 5 | Esc behavior — search / insights collapse | **BLOCKED** | Not re-tested this sprint |
| 6 | j / k — selection navigation | **BLOCKED** | Not re-tested this sprint |
| 7 | Saved views — save, apply, delete | **BLOCKED** | Not re-tested this sprint (localStorage feature) |
| 8 | Local notes — persist after refresh | **BLOCKED** | Not re-tested this sprint |
| 9 | CSV export — visible rows only | **BLOCKED** | Not re-tested this sprint |
| 10 | Failed-message panel — read-only context | **BLOCKED** | E3: zero failed `operator_reply` rows on staging |
| 11 | Mobile — narrow viewport layout | **BLOCKED** | Not re-tested this sprint |
| 12 | Network — no recurring PostgREST 400/406 | **BLOCKED** | DevTools capture not performed this sprint; 15 packets loaded successfully (indirect) |
| 13 | Select shape — no missing column errors | **PASS** | 15 open packets loaded post-RLS; no schema mismatch reported in session docs |
| 14 | Write tools unchanged — three Edge invokes only | **PASS** | Static: `operatorInboxStage1Guard.test.ts` + `ci-readonly-guard.log` (137/137) |

---

## Summary

| Outcome | Count |
|---------|-------|
| PASS | 4 |
| FAIL | 0 |
| BLOCKED | 10 |

**Overall E14 / smoke verdict:** **PARTIAL** — core load/list/detail and static write-guard proofs pass; keyboard, local features, mobile, failure-path, and network devtools items remain **BLOCKED** or untested.

---

## RLS cross-check (smoke-adjacent)

| Role | Open packets visible | Status |
|------|---------------------|--------|
| SUPPORT_EXECUTIVE (`support.stage1@`) | 15 | **PASS** |
| FINANCE_HEAD (`finance@`) | 0 | **PASS** (expected deny) |
| DISPATCH_MANAGER (`dispatch@`) | 0 | **PASS** (expected deny) |

---

*Do not mark BLOCKED items as PASS. Re-run blocked rows in a dedicated staging browser session when authorized.*
