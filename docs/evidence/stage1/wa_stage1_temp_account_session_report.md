# Stage-1 temp account + E4/E5 capture session

**Date:** 2026-06-04  
**Environment:** Staging `tcxvcatsqqertcnycuop` only  
**Account:** `support.stage1@oasisbaklawa.com` / `SUPPORT_EXECUTIVE`

---

## Task results

| # | Task | Result |
|---|------|--------|
| 1 | `SUPPORT_EXECUTIVE` qualifies for `is_whatsapp_inbox_reader()` | ✅ Option A array includes role |
| 2 | Create staging account | ✅ Created |
| 3 | Role/profile mappings | ✅ users + profiles + user_role_map |
| 4 | Authenticate | ✅ Supabase password grant OK |
| 5 | SQL visibility (15 open) | ✅ 15 via policy + PostgREST JWT |
| 6 | Browser login | ✅ |
| 7 | E4/E5 + inbox screenshots | ✅ 3 files captured |
| 8 | Artifacts under `docs/evidence/stage1/` | ✅ |

---

## Screenshots

| File | Evidence |
|------|----------|
| `visibility-full-inbox-with-packets.png` | 15 open packets visible |
| `queue-disabled-governance-bar.png` | E4 — disabled Reassign / Approve Draft / Send Automation |
| `audit-readonly-label.png` | E5 — "read-only · not persisted" in insights |

**Note:** Browser capture saved WebP-encoded images with `.png` extensions (~19K each). Viewers that require strict PNG may need re-export.

---

## Disable account?

**Yes, after Stage-1 evidence is signed off** — temporary credential; ban or delete on staging only. See `wa_stage1_temp_evidence_account.md`.
