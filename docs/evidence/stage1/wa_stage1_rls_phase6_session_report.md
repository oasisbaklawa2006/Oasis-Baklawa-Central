# Phase 6 Session Report — WA Stage-1 RLS Staging Apply

**Date:** 2026-06-04  
**Re-run note:** Phase 6 re-requested; staging migration `wa_stage1_inbox_reader_rls` already applied — no re-apply performed.  
**Environment:** Staging (`tcxvcatsqqertcnycuop`)  
**App URL:** https://cursor-central-vercel.vercel.app  
**PR merged:** #171 → `main` @ `b0b383d`

---

## Summary

Option A inbox reader RLS migration applied to **staging only**. Post-apply SQL and browser checks confirm finance@ and dispatch@ see **0** open packets; admin@ inbox visibility verified via SQL (**15** open) after browser login blocked (unknown password).

---

## Steps executed

1. ✅ Checked out `main`, pulled latest (includes PR #171 migration)
2. ✅ Confirmed migration file on `main`
3. ✅ Re-ran preflight — all checks matched Phase 5 baseline
4. ✅ Applied `wa_stage1_inbox_reader_rls` via Supabase MCP to staging
5. ✅ Post-apply SQL verification (V1–V6)
6. ⚠️ Browser verify: 2/3 accounts (admin@ blocked on credentials)
7. ✅ Proof artifacts captured under `docs/evidence/stage1/`

---

## Artifacts

| File | Description |
|------|-------------|
| `wa_stage1_rls_post_apply_verification.md` | SQL + browser verification matrix |
| `rls-post-apply-dispatch-inbox.png` | dispatch@ — 0 packets |
| `rls-post-apply-finance-inbox.png` | finance@ — 0 packets |
| `rls-post-apply-admin-inbox-BLOCKED.txt` | admin@ login blocker note |

---

## Next steps (not in scope)

- Obtain/reset `admin@oasisbaklawa.com` staging password for browser screenshot with 15 packets
- Re-run blocked evidence E4/E5 using admin@ session
- Production apply remains **NOT AUTHORIZED**
