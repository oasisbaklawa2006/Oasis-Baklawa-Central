# Production deployment runbook — Execution OS schema

**Production Supabase:** `tcxvcatsqqertcnycuop`  
**Application:** Vercel production @ `189177dfd70407ac02b042cd11a7a5f24f846e44` (already contains Execution OS UI)  
**Status:** Planning document — **do not execute** without change approval and backup.

---

## 1. Objectives

1. Record **19** pending migration versions on production (includes **9** Execution OS migrations).
2. Create governed schema for reservation → dispatch evidence → stock finalization pilot.
3. Verify via `PHASE_15_5_PRODUCTION_REPROBE.md` before enabling pilot orders.

---

## 2. Preconditions

| # | Requirement | Owner |
|---|-------------|-------|
| P1 | Change window approved | Ops / DBA |
| P2 | Database backup or PITR snapshot | DBA |
| P3 | `PHASE_15_3` drift review signed — especially `20260508155100` RLS | Engineering lead |
| P4 | `supabase migration list --linked` shows 19 local-only, 0 remote-only | Operator |
| P5 | No concurrent schema jobs on production | DBA |
| P6 | Pilot admin confirmed in `is_internal_staff` + role map | Ops |

---

## 3. Exact execution order

### 3.1 What `db push` will apply (automatic order)

```
 1. 20260503201343  b2b request info columns
 2. 20260503215926  users.deleted_at
 3. 20260504035656  debug_webhooks.message_intent
 4. 20260508155100  sales roster RLS (HIGH ATTENTION)
 5. 20260510120000  dispatches proof columns
 6. 20260515120000  orders finance audit (IF NOT EXISTS)
 7. 20260515120001  order_payment_status enum
 8. 20260515194500  buyer payment receipt + storage RLS
 9. 20260516200000  orders.payment_rejection_reason
10. 20260518220000  whatsapp audit reconcile
11. 20260525230000  execution_os phase3a3d foundation
12. 20260526010000  execution_os phase3c barcode
13. 20260526020000  execution_os phase3i search index
14. 20260526030000  execution_os phase4a inventory reservation
15. 20260526120000  execution_os phase4b dispatch readiness
16. 20260526130000  execution_os phase4c finance governance
17. 20260526140000  execution_os phase4d dispatch completion
18. 20260526150000  execution_os phase4e dispatch finalization
19. 20260526160000  execution_os phase4g stock finalization
```

**Do not skip or reorder** when using Supabase CLI `db push`.

### 3.2 Execution-only subset (not default)

Applying **only** migrations 11–19 without recording 1–10 requires a **custom DBA procedure** (manual SQL + `migration repair`). **Not recommended** unless 1–10 are applied and recorded separately. See `PHASE_15_3_MIGRATION_DRIFT_REPORT.md`.

---

## 4. Command sequence (operator workstation)

**Replace placeholders. Run only during approved window.**

```bash
# 0. Repository at production code SHA
git fetch origin
git checkout 189177dfd70407ac02b042cd11a7a5f24f846e44

# 1. CLI auth + link
npx supabase@latest login
npx supabase@latest link --project-ref tcxvcatsqqertcnycuop

# 2. Pre-flight list (archive output to change ticket)
npx supabase@latest migration list --linked

# 3. Pre-deploy row counts (save output)
# Run PHASE_15_5 section 8 SQL via Supabase SQL editor or MCP

# 4. Apply all pending migrations
npx supabase@latest db push

# 5. Post-apply list (confirm 19 new remote rows)
npx supabase@latest migration list --linked

# 6. Reprobe (read-only SQL pack)
# Execute docs/PHASE_15_5_PRODUCTION_REPROBE.md queries

# 7. Optional: regenerate types locally (dev machines only — not production)
# npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

**If `db push` fails:**

1. Capture full CLI error and last successful `version` in `schema_migrations`.
2. **Stop** — do not run `migration repair` without DBA written plan.
3. Assess partial apply via reprobe queries (table existence vs history rows).

---

## 5. Expected duration

| Phase | Technical estimate |
|-------|-------------------|
| Backup + pre-flight | 10–30 min (human) |
| `db push` (19 migrations) | **15–45 min** (includes RLS migration + Execution OS DDL) |
| Read-only reprobe + smoke | **15–30 min** |
| **Total window** | **~45–105 min** |

Off-peak recommended because of `20260508155100` policy changes on `orders` / `companies`.

---

## 6. Rollback plan

### 6.1 Preferred: forward-only

- Leave schema in place.
- Disable pilot routes / feature flag if issues found.
- Fix forward with app config or hotfix.

### 6.2 DDL rollback (only if zero writes to new tables)

Reverse drop order (DBA script, **not** in repo):

```
4G → 4E → 4D → 4C → 4B → 4A → 3I → 3C → 3A3D
```

Also remove corresponding `schema_migrations` rows **only** under DBA supervision.

### 6.3 Never do without approval

- Blind `supabase migration repair`
- `db pull` on production to “fix” history
- Drop `orders` / legacy inventory tables

---

## 7. Verification plan

1. **Automated SQL:** `docs/PHASE_15_5_PRODUCTION_REPROBE.md` gates G1–G8.
2. **Phase 15.1 re-probe:** Table list matches staging pilot set.
3. **UI smoke:** Governance boards load without persistence errors.
4. **Sign-off:** `docs/PRODUCTION_PILOT_CHECKLIST.md` owner approval.

---

## 8. Success criteria

| Criterion | Measure |
|-----------|---------|
| Migration history | Versions `20260525230000`–`20260526160000` present |
| Schema | All nine pilot tables + dependencies exist |
| Constraints | `dispatch_consumption_confirmed`, `consumption_finalized` in CHECK defs |
| Security | RLS on; append-only triggers fire on test UPDATE (optional) |
| Legacy data | `orders` / `order_status_history` counts unchanged |
| Application | Admin boards reach DB without schema errors |

---

## 9. References

| Document | Purpose |
|----------|---------|
| `docs/PHASE_15_3_MIGRATION_DRIFT_REPORT.md` | Drift + reconciliation |
| `docs/PHASE_15_4_DEPLOYMENT_REVIEW.md` | FK / trigger / RLS review |
| `docs/PHASE_15_5_PRODUCTION_REPROBE.md` | Post-apply SQL |
| `docs/MIGRATION_DEPLOYMENT_PLAN.md` | Execution OS-only inventory |
| `docs/PRODUCTION_SCHEMA_GAP_REPORT.md` | Pre-apply gap baseline |
| `docs/PRODUCTION_PILOT_CHECKLIST.md` | Pilot enablement |

---

*End of production deployment runbook.*
