# Migration & staging operator playbook (non-technical owner)

**Audience:** Business owner (read sections 1–3 and 7); technical operator (run sections 4–6).  
**Last verified:** 2026-05-30 (live probe of production + repo; staging requires operator CLI).  
**Apps:** Oasis Central B2B / WhatsApp / order processing.

| Environment | Supabase project ref | Role |
|-------------|----------------------|------|
| **Production** | `tcxvcatsqqertcnycuop` | Live customer and order data |
| **Staging** | `aruyieslaxjhnamlstpx` | Safe testing; separate database |
| **Repo migrations** | `supabase/migrations/` (120 files) | Source of truth for schema |

---

## 1. Current migration status

| Layer | Status | Detail |
|-------|--------|--------|
| **Git repo (`main`)** | **Complete** | 120 migration files; latest `20260526160000` (Execution OS 4G). `origin/main` @ `8931939` (“redeploy production after execution os migration”). |
| **Production database** | **Complete** | `schema_migrations` count = **120**. All nine Execution OS versions (`20260525230000`–`20260526160000`) applied. All ten pilot tables present (G1 reprobe **PASS**). |
| **Staging database** | **Unknown (must verify)** | Automated probe **cannot read** staging (`aruyieslaxjhnamlstpx`) from this environment. Last documented staging count during Stage 14G was **112** network-confirmed migrations; repo is now **120** → staging may be **up to 8 versions behind** unless already updated. |
| **Production `db push`** | **Not needed** | Do **not** re-run production migration apply unless `migration list` shows pending local migrations. |

**Phase 21 report is outdated:** It assumed 19 pending migrations on production. Production has since been brought to **120/120**.

---

## 2. Are local, staging, and production aligned?

| Pair | Aligned? | Notes |
|------|----------|-------|
| **Repo ↔ production** | **YES** | Same 120 versions; Execution OS tables exist on production. |
| **Repo ↔ staging** | **UNKNOWN** | Operator must run `migration list` on staging. If staging &lt; 120, run `db push` **only on staging**. |
| **Local dev ↔ staging** | **Only if configured** | `.env.local` points at staging (`aruyieslaxjhnamlstpx`). Default `.env` points at **production** — unsafe for casual testing. |
| **Local dev ↔ production** | **Misaligned by design** | Using `.env` alone hits production. |
| **Vercel production app ↔ production DB** | **Expected YES** | `main` redeployed after migration; confirm `VITE_SUPABASE_URL` contains `tcxvcatsqqertcnycuop` in Vercel **Production** env. |
| **Vercel preview/staging ↔ staging DB** | **Must confirm** | Preview must use `aruyieslaxjhnamlstpx`, not production keys. |

---

## 3. Exact blockers

| # | Blocker | Owner | Blocks |
|---|---------|-------|--------|
| B1 | **Staging migration count not verified** | Operator + Supabase login | Safe staging tests |
| B2 | **Staging may need `db push`** (if &lt; 120 migrations) | DBA / engineer | Golden-chain boards on staging |
| B3 | **Vercel env not confirmed** for Preview vs Production | Engineer | Wrong database from browser |
| B4 | **Supabase CLI not logged in** on execution machine | Engineer | `migration list` / `db push` |
| B5 | **WhatsApp / webhooks** may still target production URLs | Ops | Accidental production messages during staging tests |
| B6 | **Production pilot not signed off** | Ops | Production go-live beyond schema |
| B7 | **Legacy write routes** still in codebase (`/admin/finance-board`, etc.) | Engineering policy | Ungoverned writes even with correct schema |

**Not blockers anymore:** Production Execution OS DDL (already applied).

---

## 4. Commands to run (one by one)

**Rules for operator**

- Run from repo root: `/workspace` (or your clone).
- Use `main` (or any branch with **zero** `git diff main -- supabase/migrations`).
- **Never** `db push` to `tcxvcatsqqertcnycuop` unless `migration list` shows pending migrations (should be none).
- **Only** `db push` to `aruyieslaxjhnamlstpx` when staging is behind repo.

### Step 0 — Get correct code

```bash
cd /path/to/oasis-central
git fetch origin main
git checkout main
git pull origin main
```

### Step 1 — Supabase CLI login

```bash
npx supabase@latest login
```

### Step 2 — Check production (read-only; should be fully applied)

```bash
npx supabase@latest link --project-ref tcxvcatsqqertcnycuop
npx supabase@latest migration list
```

### Step 3 — Check staging

```bash
npx supabase@latest link --project-ref aruyieslaxjhnamlstpx
npx supabase@latest migration list
```

### Step 4 — Apply migrations to staging **only if** Step 3 shows local pending

```bash
npx supabase@latest link --project-ref aruyieslaxjhnamlstpx
npx supabase@latest db push
```

### Step 5 — Staging schema smoke (SQL in Supabase SQL Editor, staging project)

```sql
SELECT COUNT(*) FROM supabase_migrations.schema_migrations;
-- expect 120

SELECT COUNT(*) FROM supabase_migrations.schema_migrations
WHERE version >= '20260525230000';
-- expect 9
```

### Step 6 — Local app against staging (developer machine)

```bash
# Ensure .env.local exists with staging VITE_SUPABASE_* (not production)
npm ci
npm run dev
```

Open browser DevTools → Network → confirm requests go to `aruyieslaxjhnamlstpx.supabase.co` only.

### Step 7 — Vercel environment check (dashboard)

1. Project → Settings → Environment Variables.  
2. **Production:** `VITE_SUPABASE_URL` = `https://tcxvcatsqqertcnycuop.supabase.co`.  
3. **Preview** (or dedicated staging): `VITE_SUPABASE_URL` = `https://aruyieslaxjhnamlstpx.supabase.co`.  
4. Redeploy preview after env changes.

### Step 8 — Production post-migration reprobe (optional; read-only SQL on production)

Use queries in `docs/PHASE_15_5_PRODUCTION_REPROBE.md` gates G1–G8. No `db push`.

---

## 5. Expected output after each command

| Step | Command | Expected success output |
|------|---------|-------------------------|
| 0 | `git checkout main` | `HEAD` at `8931939` or newer; no errors |
| 1 | `supabase login` | Browser opens; “Finished supabase login” |
| 2 | `migration list` (production linked) | **Remote = Local** for all 120 versions; **no** “pending” local-only rows |
| 3 | `migration list` (staging linked) | Ideally **Remote = Local** × 120; if not, note pending versions |
| 4 | `db push` (staging only) | Each migration “Applying…” then success; ends with nothing pending |
| 5 | SQL on staging | `120` and `9` counts |
| 6 | `npm run dev` | Vite URL; network host = `aruyieslaxjhnamlstpx.supabase.co` |
| 7 | Vercel | Production and Preview show different project refs |
| 8 | G1 SQL on production | All pilot tables `OK` (already verified 2026-05-30) |

---

## 6. What to do if a command fails

| Failure | Likely cause | Action |
|---------|--------------|--------|
| `Access token not provided` | Not logged in | Repeat Step 1; export `SUPABASE_ACCESS_TOKEN` if CI |
| `link` wrong project | Wrong ref | Re-run `link` with correct ref; never push to prod by mistake |
| Production `migration list` shows pending | Drift or wrong branch | `git checkout main`; diff `supabase/migrations`; **do not** push until DBA approves |
| Staging `db push` FK/RLS error | Staging data incompatible with migration | Stop; capture full error; fix staging data or run approved repair migration — **do not** retry on production |
| `db push` “already applied” | Harmless | Continue to Step 5 |
| Local app hits production | Using `.env` not `.env.local` | Rename/disable production `.env` for dev; use `.env.local` only |
| Vercel preview still hits production | Env vars on Preview = Production | Fix Preview env; redeploy |
| Login works but boards error “relation does not exist” | Staging behind on migrations | Complete Steps 3–4 on staging |
| WhatsApp test messages hit live customers | Webhook URL / phone number is production | Point test provider to staging function URL; use test numbers only |

---

## 7. Production data risk

| Action | Risk to production data |
|--------|-------------------------|
| **`db push` on production now** | **Low** if already at 120 (should no-op). **High** if operator links wrong project or repo has extra migrations. **Avoid** unless `migration list` shows real pending. |
| **`db push` on staging** | **None** to production (separate database). Staging data may change (new tables, RLS). |
| **Local dev with `.env`** | **High** — reads/writes **live** production data. |
| **Local dev with `.env.local` only** | **Low** for production (staging DB only). |
| **Vercel Preview with production keys** | **High** — same as using production from browser. |
| **5-order production pilot** | **Medium** — creates real orders/status history; follow `PRODUCTION_PILOT_CHECKLIST.md` |
| **Legacy admin routes** | **Medium** — ungoverned writes possible even with correct schema |
| **Re-running completed migrations manually** | **High** — never delete rows from `schema_migrations` |

---

## Safe staging goal (definition of done)

1. Staging `schema_migrations` = **120** and Execution OS tables present.  
2. Preview or local dev uses **only** `aruyieslaxjhnamlstpx`.  
3. WhatsApp/webhooks for tests do **not** use production endpoints.  
4. Golden chain walkthrough (4B→4G) passes on staging per `docs/STAGE_14G_REPORT.md` pattern.  
5. Production pilot remains a **separate**, signed checklist — not required for staging safety.

---

## Reference documents

- `docs/PHASE_15_5_PRODUCTION_REPROBE.md` — post-migration production checks  
- `docs/PRODUCTION_PILOT_CHECKLIST.md` — production pilot only  
- `docs/PHASE_18_MIGRATION_EXECUTION_PACKAGE.md` — historical; production push largely complete  
- `docs/PHASE_21_READINESS_REPORT.md` — **superseded** for migration pending status by this playbook  

---

*End of playbook.*
