# PHASE 15.3–15.5 REPORT — Production Execution OS deployment readiness

**Date:** 2026-05-30  
**Production:** `tcxvcatsqqertcnycuop`  
**Code:** `main` @ `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Rules:** Read-only audit and planning only — no migrations run, no production writes, no app changes.

---

## Deliverables

| Step | Document |
|------|----------|
| 15.3 Drift audit | `docs/PHASE_15_3_MIGRATION_DRIFT_REPORT.md` |
| 15.4 Deployment review | `docs/PHASE_15_4_DEPLOYMENT_REVIEW.md` |
| 15.5 Reprobe plan | `docs/PHASE_15_5_PRODUCTION_REPROBE.md` |
| Runbook | `docs/PRODUCTION_DEPLOYMENT_RUNBOOK.md` |

---

## 1. Drift findings (15.3)

| Finding | Detail |
|---------|--------|
| Remote-only versions | **0** — reconciliation complete; `20260423214633` has noop local file |
| Local-only versions | **19** — includes 10 pre–Execution OS + 9 Execution OS |
| Checksum drift | **Not auditable** — no checksum column on production `schema_migrations` |
| Applied-but-absent | WhatsApp audit tables exist before `20260518220000` history row; finance/rejection columns exist before pending duplicates — **idempotent** |
| Execution OS schema | **Absent** — consistent with missing migration rows |
| Order issue | `db push` applies **all 19** in timestamp order, not Execution OS alone |

**Drift risk level:** **HIGH** (pending RLS migration `20260508155100` in the bundle).

---

## 2. Deployment findings (15.4)

| Area | Verdict |
|------|---------|
| FK chain | **Valid** in order 3A3D → 3C → 3I → 4A → 4B–4E → 4G |
| Trigger chain | **Consistent** — 8 append-only enforcement functions |
| RLS chain | **Valid** — requires `is_internal_staff` + `get_user_role` (**present** on production) |
| Rollback | **Forward-only recommended** after any pilot writes |
| Lock risk | Low for new empty tables; **elevated** for pending sales-roster RLS migration |
| Row impact | **Zero** DML on existing business data from Execution OS DDL |

---

## 3. Migration order (authoritative)

**Full production push (recommended CLI path):** 19 migrations — see `PRODUCTION_DEPLOYMENT_RUNBOOK.md` §3.1.

**Execution OS core (items 11–19 only after 1–10 or equivalent history):**

```
20260525230000 → 20260526010000 → 20260526020000 → 20260526030000
→ 20260526120000 → 20260526130000 → 20260526140000
→ 20260526150000 → 20260526160000
```

---

## 4. Blockers

| Blocker | Status |
|---------|--------|
| Execution OS tables missing on production | **Active** — requires DDL apply |
| 19 pending migration rows not on production | **Active** — `db push` not yet run |
| App code already deployed without schema | **Active** — UI will fail persistence until apply |
| Pilot order setup | **Blocked** until post-apply reprobe passes |
| Remote-only file drift | **Resolved** |
| Migration checksum verification | **N/A** |

**Non-blocker (awareness):** Ten pre-OS migrations will run in the same window — must be reviewed, not skipped silently.

---

## 5. Exact production deployment command sequence

```bash
git checkout 189177dfd70407ac02b042cd11a7a5f24f846e44
npx supabase@latest login
npx supabase@latest link --project-ref tcxvcatsqqertcnycuop
npx supabase@latest migration list --linked    # archive output
# backup / PITR — per DBA runbook
npx supabase@latest db push                    # applies 19 pending migrations in order
npx supabase@latest migration list --linked    # confirm remote rows
# execute docs/PHASE_15_5_PRODUCTION_REPROBE.md SQL gates G1–G8
```

---

## 6. Estimated deployment time

| Activity | Estimate |
|----------|----------|
| Pre-flight + backup | 10–30 min |
| `db push` (19 migrations) | 15–45 min |
| Reprobe + UI smoke | 15–30 min |
| **Total maintenance window** | **~45–105 min** |

---

## 7. GO / NO-GO recommendation

| Decision | Recommendation |
|----------|----------------|
| **GO — controlled production migration (planning complete)** | **YES** — drift inventoried, order defined, runbook and reprobe plan ready |
| **GO — execute `db push` now** | **NO** — requires approved change window, backup, and sign-off on pending RLS bundle (migrations 1–10) |
| **GO — pilot order setup** | **NO** — schema absent; reprobe gates will fail until apply completes |

### Summary verdict

**READY FOR CONTROLLED PRODUCTION MIGRATION (planning)**  
**NOT READY TO EXECUTE OR PILOT** until operators run the runbook, pass Phase 15.5 gates, and re-run Phase 15.1.

---

## 8. Next steps (execution phase)

1. Change ticket + backup.
2. Review `20260508155100` RLS diff with stakeholder.
3. Execute `PRODUCTION_DEPLOYMENT_RUNBOOK.md`.
4. Run `PHASE_15_5_PRODUCTION_REPROBE.md`.
5. Enable `PRODUCTION_PILOT_CHECKLIST.md` on PASS.

---

*End of Phase 15.3–15.5 report.*
