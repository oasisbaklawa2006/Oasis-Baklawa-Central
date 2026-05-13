# Supabase migration history reconciliation (ops)

**Target project ref:** `tcxvcatsqqertcnycuop` (from [`supabase/config.toml`](../../supabase/config.toml))

**Branch intent:** Align filenames under `supabase/migrations/` with rows in remote `supabase_migrations.schema_migrations` so `npx supabase migration list --linked` matches Local and Remote columns.

**Constraints observed:** Do not re-run Phase 2A.2 `orders.order_number` DDL blindly; it is already applied remotely (`20260512160000`).

---

## What was done in this PR

1. **Restored** two April 3 migrations deleted in Git revert `ac424ae`, saved under **remote** version prefixes:
   - Content from `ac424ae~1` / historical paths  
     `20260403111715_3376b25c-4c12-4838-b929-9efaa49f213e.sql` → file **`20260403111713_3376b25c-4c12-4838-b929-9efaa49f213e.sql`**  
     `20260403112300_97fca463-6c89-480f-bff9-5ce32253abb2.sql` → file **`20260403112258_97fca463-6c89-480f-bff9-5ce32253abb2.sql`**
   - **No intentional SQL edits** beyond trimming a leading blank line on the first file (whitespace only).

2. **Renamed** **85** existing migration files: prefix-only changes so local filenames match the **Remote** column from `npx supabase migration list --linked` (pairing rule: each **remote-only run** ending with version `R` followed by a **local-only** row with version `L` → rename `L_*` → `R_*`; consecutive remote-only rows without a following local-only row are treated as missing files until restored).

---

## Unresolved remote-only migration (no Git file)

| Version      | Status |
|-------------|--------|
| `20260423214633` | Present in **remote** `schema_migrations`. **No** matching file ever found in `git log --all` under `supabase/migrations/`. **Do not invent SQL.** Resolve via external recovery (who applied it, backup, org runbook) **or** explicit DBA review before any `migration repair` / no-op file strategy. |

Until resolved, `migration list --linked` will continue to show an empty Local column for this version.

---

## Local-only migrations (not yet on remote)

These exist in the repo but **no** remote row yet (pending future `db push` after review):

| Version      | File pattern |
|-------------|--------------|
| `20260503201343` | `20260503201343_add_request_info_fields_to_b2b_applications.sql` |
| `20260503215926` | `20260503215926_add_deleted_at_to_users.sql` |
| `20260504035656` | `20260504035656_add_message_intent_to_debug_webhooks.sql` |
| `20260508155100` | `20260508155100_phase4_sales_roster_scope.sql` |
| `20260510120000` | `20260510120000_phase44_dispatch_proof.sql` |

Review SQL for idempotency against production **before** pushing.

---

## Already aligned

- **`20260512160000`** — Phase 2A.2 human `order_number` migration; Local \| Remote both present.

---

## Rename plan (source of truth)

Regenerate the pairing table anytime:

```powershell
cd <repo-root>
npx supabase login   # if needed
npx supabase link --project-ref tcxvcatsqqertcnycuop   # if needed
npx supabase migration list --linked
```

Skew renames in this PR follow that output’s Remote vs Local ordering (see implementation note in section “What was done”).

---

## Exact next commands (after human review — **do not** push blindly)

1. Re-verify list:

   ```powershell
   npx supabase migration list --linked
   ```

   Expect every historical row to show **Local \| Remote** equal **except**:
   - Remote-only: `20260423214633`
   - Local-only (remote empty): the five `20260503*` … `20260510120000` pending files.

2. When ready to apply **only** the pending local migrations (and **not** reapply aligned history):

   ```powershell
   npx supabase db push
   ```

   **Stop** if the CLI attempts to re-run migrations that are already applied; clarify with `migration list` and Supabase docs (`migration repair` only with explicit strategy — **not** bulk repair).

3. **`20260423214633` gate:** do **not** use `db push` / repair to “paper over” this version until SQL is recovered or DBA-approved.

---

## References

- Git revert removing April 3 files: `ac424ae`
- Parent snapshot for restoration: `ac424ae~1`
