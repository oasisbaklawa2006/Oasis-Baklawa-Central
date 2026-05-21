# Supabase migration reconciliation — execution strategy

**Purpose:** Define **how** to reconcile thirteen **remote-only** migration versions with this repository **without** prescribing SQL or running tools here.  
**Scope:** Process and decision gates only. **No** migration files, **no** `repair` / `db push` / `db pull`, **no** Supabase CLI, **no** app code changes, **no** deploy, **no** push from this document.

**Related:** `docs/SUPABASE_REMOTE_ONLY_MIGRATION_SQL_RECOVERY_WORKSHEET.md` (bundles, matrix, synthesis), `docs/SUPABASE_MIGRATION_DRIFT_RESOLUTION_PLAN.md`, `docs/SUPABASE_REMOTE_ONLY_MIGRATION_RECOVERY_PLAN.md`.

---

## 1. Current understanding

| Area | Assessment (hypothesis — not proven until introspection) |
|------|-----------------------------------------------------------|
| **Finance bundle** (six May 14–17 remote-only rows) | **Mostly** consistent with **historical drift / re-versioning**: remote applies logged under one set of version timestamps, similar DDL later appears in git as `20260515120000_*`, `20260515194500_*`, `20260516200000_*`. **Weak links:** `add_finance_exec_rls_policies` and the pair `add_finance_audit_columns_to_orders` vs `orders_finance_audit` still need catalog proof. |
| **WhatsApp bundle** (six May 17–18 rows) | **Higher risk** that production holds **DDL not faithfully mirrored** in repo files under matching versions. Local `20260518220000_*` is a **reconciliation** layer, not a substitute for proving the six remote bodies. |
| **Legacy** `20260423214633` | **Unresolved**: sits between two known `auth_logs` migrations; **no** descriptive remote name, **no** local file. Treat as **blocking** until evidence exists. |

---

## 2. Production safety principles

1. **No destructive reconciliation** — No `DROP` / mass `ALTER … DROP` / policy nukes to “clean up” drift without a written, reviewed plan and backup posture.
2. **No blind `migration repair`** — Repair adjusts **history metadata**, not necessarily schema truth; it is **forbidden** until each target version is understood (`docs/SUPABASE_REMOTE_ONLY_MIGRATION_RECOVERY_PLAN.md`).
3. **No placeholder migrations** — Empty or no-op files to silence the CLI are **explicitly rejected**; they destroy auditability.
4. **No timestamp-only renames** — Renaming `supabase/migrations/*` to match remote versions **without** proving SQL equivalence is **rejected** (see ops reconciliation doc warnings).
5. **No `db push` until reconciliation confidence is achieved** — “Confidence” means: aligned evidence for remote-only rows **and** a clear story for local-only pending files, per decision gates below.

---

## 3. Recommended reconciliation path

### Phase A — Production introspection validation (read-only)

- Run **catalog** and **policy** inventory against production (or a **fresh clone**), scoped to objects implied by remote **names** and by bundle maps in the worksheet.
- Output: structured diff notes (tables, columns, constraints, indexes, RLS on `public` + affected `storage`, relevant functions/triggers).

### Phase B — Exact SQL recovery (where possible)

- For each remote-only version: obtain **primary** evidence (logged apply SQL, CI, dashboard history, engineer notes). Where impossible, **reconstruct** from introspection + backup diff and label **reconstructed** explicitly.
- Produce **candidate** migration file bodies **off-line** in git (future PRs — **not** part of this strategy file).

### Phase C — Equivalence verification

- For each candidate file: prove **semantic equivalence** to what remote recorded (not merely “same feature area”). Use diff of DDL, policy names, and dependency order.
- Resolve special cases: possible **duplicate** remote rows (`85811` vs `73922`), and **`85852`** vs buyer-centric policies in `20260515194500_*`.

### Phase D — Controlled migration history reconciliation

- Only after Phases A–C: consider **`migration repair`** or other history-alignment steps **under** a dedicated branch, second reviewer, and rollback plan—**if** still needed after honest files exist.

### Phase E — Resume normal migration workflow

- **`migration list`** aligned for the versions you ship; then **`db push`** (or org-standard apply path) for **new** migrations only when gates in §4 are satisfied.

---

## 4. Decision gates

| Gate | Evidence required |
|------|---------------------|
| **Mark a migration “equivalent”** | **At least two** of: (1) **exact** logged SQL matching remote version, (2) **production introspection** matches file body for all objects touched, (3) **git history** explains timing and content (e.g. `af99c86` / `b4c3f55` trail for finance columns). **One** weak signal alone is **insufficient**. |
| **Allow `migration repair`** | Written proof per version: **erroneous** duplicate row, or **file now exists** and is verified equivalent, or **DBA-signed** alternate; **backup** / clone checkpoint; **no** open “unknown” classifiers for that version. |
| **Allow `db push`** | Remote-only set **either** represented by verified files **or** formally scoped out; local-only pending migrations reviewed for idempotency against **current** prod; **`migration list`** shows no unexplained skew for the versions in the release. |
| **Allow new production migrations** | Same as **`db push`** gate; additionally: C2B / privileged write paths stay **paused** until org declares drift risk acceptable (see worksheet C2B notes). |

---

## 5. Highest-risk areas

| Risk | Why |
|------|-----|
| **WhatsApp schema chain** | Remote names imply **tables and layers** not clearly present as matching local migration bodies; wrong assumption breaks Edge functions and operator tools. |
| **Policies / functions / triggers** | Easy to **duplicate** policies or **widen** access if recovery SQL diverges from prod; **`SECURITY DEFINER`** functions need explicit review. |
| **RLS drift** | Apparent “same table” can differ by **policy set** or **`ENABLE ROW LEVEL SECURITY`** ordering; finance exec vs buyer policies must not be conflated. |
| **Edge-function assumptions** | Code may assume columns/tables exist **because** prod has them, while git migration history does not explain them—recovery must close that gap before future applies. |

---

## 6. Safest likely outcome (optimistic)

**If** introspection shows production objects **already match** the intent of git’s finance files and WhatsApp audit/packet objects **match** (or safely exceed) what `20260518220000_*` expects, then:

- **Functionality is largely already in production**; the dominant problem is **migration history divergence** and **version skew**.
- Reconciliation becomes **administrative**: add **honest, idempotent** migration files for remote-only versions that **document** state (or carefully justified repair), then restore a **single source of truth** between `schema_migrations` and `supabase/migrations/`.

This outcome is **not assumed**—it must be **earned** in Phase A–C.

---

## 7. Dangerous outcome (severe case)

This becomes **severe** if the team:

- Ships **`repair`** or **`db push`** while remote-only bodies are still **unknown**, causing **wrong-order** applies, **duplicate** constraints, or **destructive** DDL.
- Adds **placeholder** or **incorrect** SQL that **diverges** from production, so new environments **miss** objects prod has (or apply conflicting DDL).
- **Renames** files to match remote timestamps **without** proving SQL equivalence, masking real drift until runtime failures or **authorization incidents**.

The **WhatsApp** chain and **`85852`** / **`20260423214633`** are the most likely flashpoints for this failure mode.

---

## 8. Executive recommendation

**Should happen next**

1. Execute **Phase A** (read-only introspection) using agreed SQL packs / clone; record results next to the **decision matrix** in the worksheet or a short addendum.
2. Assign owners to recover **primary SQL** for the **WhatsApp six** and for **`85852`**, **`73922`**, and **`20260423214633`** first—the highest **blocking** / **unknown** concentration.
3. Keep **C2B and privileged write-path** work **paused** until Phase A–C clears **blocking** rows or leadership explicitly accepts residual risk in writing.

**Should not happen next**

- **`migration repair`**, **`db push`**, **`db pull`**, or **placeholder migrations** as a shortcut.
- **Renaming** migration files for cosmetic alignment without **Phase C** equivalence proof.
- Treating **“probably the same”** as **verified** in runbooks or CI.

---

*End of execution strategy.*
