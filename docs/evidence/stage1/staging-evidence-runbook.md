# Stage-1 staging evidence runbook

**Purpose:** Execute remaining open evidence items (E1–E20) for WhatsApp operator inbox Stage-1 GO/NO-GO.  
**Prerequisite:** Static evidence complete — see `docs/evidence/stage1/ci-readonly-guard.log`.  
**Overall Stage-1 status (finalization 2026-06-04):** **GO WITH CONDITIONS** for read-only staging pilot. See `STAGE1_FINAL_READINESS_REPORT.md`.

---

## Legend

| Staging? | Meaning |
|----------|---------|
| **No** | Completable from repo/CI (done or doc-only) |
| **Yes** | Requires deployed app + auth and/or Supabase |

| Blocker | Meaning |
|---------|---------|
| **Complete** | Artifact captured |
| **Open** | Awaiting execution |
| **Blocked** | Depends on other items or human sign-off |

---

## Runbook

| ID | Proof item | Owner | Staging? | Steps | Expected artifact | Pass | Fail | Blocker |
|----|------------|-------|----------|-------|-------------------|------|------|---------|
| **E1** | Load error alert banner | Engineering | **Yes** | Break Supabase URL or block network; open `/admin/operator-inbox` | `alert-load-error.png` | Red `role="alert"` with message; no blank screen | Silent empty UI | Open |
| **E2** | Reply phone validation alert | Engineering | **Yes** | Select packet with invalid phone; click Send | `alert-reply-validation.png` | Browser `alert()` with validation text | Send proceeds | Open |
| **E3** | Failed delivery read-only panel | Engineering | **Yes** | Use packet with failed `operator_reply` row or trigger failed send | `alert-failed-msgs-panel.png` | Failed panel lists row; no retry write | Panel missing / editable | **Blocked** — `e3-no-failed-row-available.md` |
| **E4** | Governance bar disabled actions | Engineering | **Yes** | Open inbox; inspect amber governance bar | `queue-disabled-governance-bar.png` | Reassign / Approve Draft / Send Automation locked | Click triggers action | **Complete** |
| **E5** | Resolution "not persisted" label | Engineering | **Yes** | Open insights column; WA-03A–06A panels | `audit-readonly-label.png` | "read-only · not persisted" visible | Label absent | **Complete** |
| **E6** | Override audit table count | Engineering / DBA | **Yes** | Run SQL on staging Supabase | `audit-override-log-count.txt` | Zero inbox-driven rows in 24h (expected today) | Unexpected writes | **Complete** |
| **E7** | Idempotency reply gap note | Engineering | **No** | Static code audit | [`idempotency-reply-gap.md`](./idempotency-reply-gap.md) | Documents NO-GO gap | — | **Complete** |
| **E8** | Suggestions error state | Engineering | **Yes** | Disable/break classify or route Edge; click suggest | `failure-suggestions-error.png` | Error in suggestions area | Stale success | Open |
| **E9** | CI read-only guard log | Engineering | **No** | `npm test -- src/lib/wa-governance/tests/` | [`ci-readonly-guard.log`](./ci-readonly-guard.log) | 137/137 pass | Any failure | **Complete** |
| **E10** | RBAC nav hidden | Engineering / Ops | **Yes** | Login as role without `support`; check nav | `rbac-nav-hidden.png` | No WhatsApp Inbox link | Link visible incorrectly | Open |
| **E11** | RBAC URL access note | Engineering | **No** | Static audit; staging test deferred | [`rbac-url-access.md`](./rbac-url-access.md) | Documents gap; does not claim pass | Claims pass without proof | **Complete** (static); staging **Open** |
| **E12** | Full inbox visibility | Engineering | **Yes** | Open inbox with insights column expanded | `visibility-full-inbox-with-packets.png` | Packets, thread, insights visible | Broken layout | **Complete** |
| **E13** | Sign-off table | Eng / Ops / Security | **No** | Human review after staging artifacts | §6 in evidence pack | All roles signed | Empty sign-off | Blocked on E1–E6, E8, E10, E12, E14–E19 |
| **E14** | POST_MERGE_PR69 smoke (14 checks) | Engineering | **Yes** | Follow `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md` | `pr69-smoke-checklist-final.md` | All items checked | Any blocking failure | **Partial** (4 PASS, 10 BLOCKED) |
| **E15** | Duplicate-click reply rows | Engineering | **Yes** | Double-click Send on staging; query DB | Append to `idempotency-reply-gap.md` or new SQL snapshot | Document duplicate rows if reproduced | N/A if blocked | Open |
| **E16** | Observability partial-error banner | Engineering | **Yes** | Simulate failed count query (controlled break) | Screenshot or note | Amber partial-errors banner | Hidden failure | Open |
| **E17** | Realtime refresh banner | Engineering | **Yes** | Trigger packet update while inbox open | Screenshot or note | Refreshing indicator shown | Silent stale data | **Blocked** — `e17-realtime-refresh-blocked.md` |
| **E18** | Webhook auto-order env unset | Engineering | **Yes** | Supabase/Vercel env inspection | `webhook-auto-order-env.txt` | `ENABLE_WA_WEBHOOK_AUTO_ORDER_WRITES` unset/false | Flag true in staging | **Partial** (code default proven) |
| **E19** | Webhook debug trail | Engineering | **Yes** | Send test inbound WA message | SQL snapshot or note | Row in `debug_webhooks` | No ingress | Open |
| **E20** | Override + suggestion log SQL | Engineering / DBA | **Yes** | Same session as E6 | `audit-suggestions-log-count.txt` | Zero inbox-driven writes | Unexpected writes | **Complete** |

---

## Recommended execution order

1. **Single inbox session (E4, E5, E12, E14 partial):** governance bar, resolution labels, full layout, smoke items 1–7.
2. **Failure-path session (E1, E2, E8, E3):** requires ability to break network/Edge or seed failed rows.
3. **Supabase session (E6, E15, E18, E19, E20):** SQL + env vars + optional inbound message.
4. **RBAC session (E10, E11 staging half):** two test accounts.
5. **Sign-off (E13):** after artifacts committed to `docs/evidence/stage1/`.

---

## Static evidence index (complete)

| File | Description |
|------|-------------|
| [`ci-readonly-guard.log`](./ci-readonly-guard.log) | wa-governance test suite output (137/137) |
| [`idempotency-reply-gap.md`](./idempotency-reply-gap.md) | Known operator reply idempotency NO-GO |
| [`rbac-url-access.md`](./rbac-url-access.md) | Static RBAC note; staging test pending |
| [`staging-evidence-runbook.md`](./staging-evidence-runbook.md) | This file |

---

*Update evidence pack checkboxes when staging artifacts land in `docs/evidence/stage1/`.*
