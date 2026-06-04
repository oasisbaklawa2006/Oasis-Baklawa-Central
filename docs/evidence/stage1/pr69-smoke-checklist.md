# E14 — POST_MERGE_PR69 operator inbox smoke checklist

**Source:** `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md`  
**Captured:** 2026-06-04  
**URL:** https://cursor-central-vercel.vercel.app/admin/operator-inbox  
**Inbox session login:** dispatch@oasisbaklawa.com (DISPATCH_HEAD)  
**RBAC session login:** finance@oasisbaklawa.com (FINANCE_HEAD)

## Results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Page load (no blank/error overlay) | **PASS** | Inbox shell renders; empty state shown |
| 2 | Packet list visible / scroll | **BLOCKED** | UI shows `0 shown · 0 loaded (open)` despite 15 open rows in DB (RLS role_key mismatch — see session report) |
| 3 | Select packet → thread/detail | **BLOCKED** | No selectable packets |
| 4 | `/` focuses filter search | **NOT RUN** | Deferred (no packet workflow) |
| 5 | Esc behavior | **NOT RUN** | Deferred |
| 6 | `j` / `k` selection | **NOT RUN** | Deferred |
| 7 | Saved views save/apply/delete | **NOT RUN** | Deferred |
| 8 | Local notes persist refresh | **NOT RUN** | Deferred |
| 9 | CSV export visible rows | **NOT RUN** | Deferred |
| 10 | Failed-message read-only panel | **BLOCKED** | No packets; no failed operator_reply rows in DB |
| 11 | Mobile narrow layout | **NOT RUN** | Deferred to Phase 2 follow-up |
| 12 | No recurring PostgREST 400/406 | **PASS** | No visible query errors in empty-state session |
| 13 | No missing-column select errors | **PASS** | Page loaded without schema error banner |
| 14 | Reply/classify/route invoke unchanged | **NOT VERIFIED** | No packet selected; static guards still green in CI |

## Summary

- **Pass:** 3  
- **Blocked:** 3 (empty inbox / RLS)  
- **Not run:** 8 (depend on packet selection or mobile pass)

**Blocker:** Assign `user_role_map` entries with RLS `role_key` in (`operations`, `finance`, `director`) for support test account, or use account with packet SELECT policy match, then re-run items 2–10.

See also: `CAPTURE-SESSION-REPORT.md`
