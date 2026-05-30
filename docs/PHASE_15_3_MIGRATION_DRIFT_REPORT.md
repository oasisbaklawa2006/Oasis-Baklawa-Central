# PHASE 15.3 — Migration drift audit (production)

**Production project:** `tcxvcatsqqertcnycuop`  
**Code baseline:** `main` @ `189177dfd70407ac02b042cd11a7a5f24f846e44`  
**Repo migrations:** `supabase/migrations/` (120 files)  
**Probe date:** 2026-05-30  
**Method:** Read-only SQL on `supabase_migrations.schema_migrations`; repo inventory via filesystem. **No migrations executed.**

---

## Executive summary

| Metric | Count |
|--------|------:|
| Versions in repo | 120 |
| Versions on production (`schema_migrations`) | 101 |
| **Remote-only** (on production, no local file) | **0** |
| **Local-only** (in repo, not on production) | **19** |
| Execution OS migrations pending | **9** (of 19 local-only) |
| Checksum column on remote history | **Not present** — checksum drift **not auditable** via `schema_migrations` |

**Drift posture (2026-05-30):** Filename/history alignment from the reconciliation PR appears **complete** for remote rows. The blocker for `supabase db push` is no longer “remote versions missing locally” but **19 pending local migrations** that have never been recorded on production — including all nine Execution OS files.

**Risk level:** **HIGH** until pre-Execution-OS pending migrations are reviewed for idempotency and lock impact (especially `20260508155100_phase4_sales_roster_scope.sql`).

---

## 1. Exact drift

### 1.1 Remote-only migrations

**None.** Every production `schema_migrations.version` has a matching `supabase/migrations/<version>_*.sql` file in the repo, including:

| Version | Local file | Notes |
|---------|------------|-------|
| `20260423214633` | `20260423214633_remote_history_noop.sql` | `SELECT 1;` history alignment only |

This differs from the older `docs/SUPABASE_MIGRATION_DRIFT_REPORT.md` (written before reconciliation), which listed 13 remote-only timestamps. **Re-audit supersedes that list for version alignment.**

### 1.2 Local-only migrations (not on production)

These **19** versions exist in the repo but **not** in production `schema_migrations`:

| Order | Version | File | Category |
|------:|---------|------|----------|
| 1 | `20260503201343` | `add_request_info_fields_to_b2b_applications.sql` | B2B additive columns |
| 2 | `20260503215926` | `add_deleted_at_to_users.sql` | Users soft-delete |
| 3 | `20260504035656` | `add_message_intent_to_debug_webhooks.sql` | WhatsApp debug |
| 4 | `20260508155100` | `phase4_sales_roster_scope.sql` | **RLS policy rewrite** on `companies`, `orders`, `order_items` |
| 5 | `20260510120000` | `phase44_dispatch_proof.sql` | `dispatches` columns |
| 6 | `20260515120000` | `orders_finance_audit.sql` | `orders` finance audit columns |
| 7 | `20260515120001` | `order_payment_status_on_credit_enum.sql` | Enum label (conditional) |
| 8 | `20260515194500` | `buyer_payment_receipt_and_storage.sql` | Payments + storage RLS |
| 9 | `20260516200000` | `orders_payment_rejection_reason.sql` | `orders.payment_rejection_reason` |
| 10 | `20260518220000` | `c2a_whatsapp_audit_tables_reconciliation.sql` | WhatsApp audit idempotent reconcile |
| 11 | `20260525230000` | `execution_os_phase3a3d_foundation.sql` | **Execution OS** |
| 12 | `20260526010000` | `execution_os_phase3c_barcode_execution.sql` | **Execution OS** |
| 13 | `20260526020000` | `execution_os_phase3i_operational_search_index.sql` | **Execution OS** |
| 14 | `20260526030000` | `execution_os_phase4a_inventory_reservation.sql` | **Execution OS** |
| 15 | `20260526120000` | `execution_os_phase4b_dispatch_readiness.sql` | **Execution OS** |
| 16 | `20260526130000` | `execution_os_phase4c_finance_governance.sql` | **Execution OS** |
| 17 | `20260526140000` | `execution_os_phase4d_dispatch_completion.sql` | **Execution OS** |
| 18 | `20260526150000` | `execution_os_phase4e_dispatch_finalization.sql` | **Execution OS** |
| 19 | `20260526160000` | `execution_os_phase4g_stock_finalization.sql` | **Execution OS** |

**Important:** `supabase db push` applies **all** pending local versions in timestamp order — not only the nine Execution OS files. A production deployment window must account for migrations **1–10** as well.

### 1.3 Applied-but-absent (history vs live schema)

Objects that **exist on production** while a **related local-only** migration is still pending:

| Live object | Pending migration | Assessment |
|-------------|-------------------|------------|
| `whatsapp_override_log`, `whatsapp_suggestions_log` | `20260518220000` | Tables from `20260518210953` (applied). C2A reconcile is **idempotent** (`IF NOT EXISTS`, policy drops/recreates). **Low DDL risk**; records history row. |
| `orders.finance_verified_by`, `finance_verified_at` | `20260515120000` | Likely applied under `20260514185811` (remote). Pending file uses `ADD COLUMN IF NOT EXISTS`. **Low risk**. |
| `orders.payment_rejection_reason` | `20260516200000` | Column **present**; remote has noop `20260517072741` instead. Pending `16200000` is redundant DDL — **low risk** (`IF NOT EXISTS`). |
| All nine Execution OS tables | `20260525230000` … `20260526160000` | Tables **absent**; migrations **not applied**. Expected gap — not a drift anomaly. |

**Not found:** Execution OS tables or functions on production without matching migration rows (schema is **behind** history, not ahead).

### 1.4 Checksum drift

Production `schema_migrations` columns: `version`, `statements`, `name`, `created_by`, `idempotency_key`, `rollback`.

There is **no** `checksum` column. Supabase CLI may compute checksums locally against file contents; **remote checksum comparison is not available** from this audit.

**Recommendation:** Before apply, run `npx supabase migration list --linked` on an operator workstation and archive the output. After apply, verify each new version appears on remote.

### 1.5 Order issues

| Issue | Severity | Detail |
|-------|----------|--------|
| `db push` applies 19 files in one chain | **High** | Cannot apply Execution OS in isolation via CLI without also applying 10 earlier pending migrations (unless using manual SQL + `migration repair` — not recommended without a written plan). |
| Execution OS internal order | **Critical if violated** | 3A3D → 3C → 3I → 4A → 4B → 4C → 4D → 4E → 4G (timestamps enforce this). |
| Duplicate finance DDL paths | Medium | `20260514185811` (applied) vs `20260515120000` (pending) — mitigated by `IF NOT EXISTS`. |
| History noop vs real DDL | Low | `20260515073922`, `20260517072741` are noops on remote; local alternates pending — idempotent. |

### 1.6 Dependency issues (migration graph)

- **Execution OS** depends on `public.is_internal_staff(uuid)` and `public.get_user_role(uuid)` — **present** on production.
- **4A / 3C** depend on `operational_queue_items` — created in **3A3D** (pending).
- **3I** depends on `operational_scan_records`, `operational_events`, `operational_queue_items` — all from pending 3A3D / 3C.
- **4G** depends on `inventory_reservations`, `inventory_movements` — from pending 4A; **ALTER** on `inventory_movements` in 4G requires 4A first.

No FK from Execution OS migrations to `orders` table (uuid columns only).

---

## 2. Production migration tail (reference)

Latest applied versions on production (descending):

`20260518210953` → … → `20260512160000` → … → `20260423214633` → …

**No** `20260525*` or `20260526*` versions.

---

## 3. Recommended reconciliation sequence

**Do not run `migration repair` blindly.** Preferred path:

### Phase A — Pre-flight (read-only + CLI list)

1. `npx supabase login`
2. `npx supabase link --project-ref tcxvcatsqqertcnycuop`
3. `npx supabase migration list --linked`
4. Confirm:
   - Every remote row has a local file (expect **yes**).
   - Pending local column lists exactly the **19** versions above.

### Phase B — Review pending non–Execution OS migrations (human gate)

| Version | Review focus |
|---------|----------------|
| `20260508155100` | **RLS policy drops/recreates** on `companies`, `orders`, `order_items` — highest lock/policy risk in the pending set |
| `20260515194500` | Storage RLS + `order_payments` — verify against live policies |
| `20260518220000` | WhatsApp audit policies — tables already exist |
| `20260515120000` / `20260516200000` | Confirm columns already present (expected) |

### Phase C — Apply (execution phase — out of scope for 15.3)

1. Database backup / PITR snapshot.
2. Maintenance window (off-peak).
3. `npx supabase db push` **or** approved equivalent (applies versions 1–19 in order).
4. On failure: **stop**; do not partial-repair without DBA plan.

### Phase D — Post-apply

1. Run `docs/PHASE_15_5_PRODUCTION_REPROBE.md` SQL pack.
2. Re-run Phase 15.1 probe checklist.
3. Sign pilot only if all gates pass.

---

## 4. Risk summary

| Risk | Level |
|------|-------|
| Pending count (19) larger than Execution OS-only (9) | **High** |
| RLS rewrite migration in pending set | **High** |
| Execution OS schema entirely missing | **Critical** (pilot blocked) |
| Remote-only file mismatch | **Low** (resolved) |
| Checksum verification | **N/A** on this project |
| `migration repair` misuse | **High** if used without plan |

---

## 5. References

- Prior drift narrative: `docs/SUPABASE_MIGRATION_DRIFT_REPORT.md` (partially superseded by this audit)
- Reconciliation ops: `docs/ops/supabase-migration-reconciliation.md`
- Execution OS inventory: `docs/MIGRATION_DEPLOYMENT_PLAN.md`, `docs/PHASE_15_2_REPORT.md`
- Production gap: `docs/PRODUCTION_SCHEMA_GAP_REPORT.md`

---

*End of Phase 15.3 drift report.*
