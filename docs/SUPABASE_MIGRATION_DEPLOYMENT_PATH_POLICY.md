# Supabase Migration Deployment Path Policy

**Status:** Adopted 2026-07-21
**Applies to:** `Oasis-Baklawa-Central`, `oasis-ai-studio`, `oasis-trace`, `oasis-supabase-core`
**Trigger:** Investigation into 47 merged-but-never-applied WhatsApp migrations
(`supabase/archived-migrations/whatsapp-business-intakes-undelivered/`) found that
no repository has ever had an automated migration deployment pipeline. Merging a
migration file to `main` has never been sufficient by itself to apply it to the
live database — that has always required a manual `supabase db push`. This
policy exists to make that gap explicit and to reduce the chance of it recurring
in either direction (migrations silently never applied, or migrations applied
without adequate review).

## Policy

1. **Schema-defining work is Core-originated going forward.** New tables,
   functions, triggers, and RLS policies that are meant to become part of the
   shared production schema should be authored as migrations reviewed with
   `oasis-supabase-core` as the primary point of ownership, even while the
   physical migration file lives in the repository that needs it first. This
   does not require relocating historical migrations (see
   `docs/architecture/ADR-whatsapp-business-intakes-not-deployed.md` and the
   App-Verse current-truth handoff: Core is a recent consolidation layer, not
   the original backend source of truth, and historical migrations in Central
   and AI Studio are expected).
2. **No direct `supabase db push` from an app repository's local environment
   against production.** Deployment of a migration batch to production is a
   deliberate, reviewed action, not a side effect of having merged a PR. Anyone
   applying migrations to production should be able to point to the specific
   PR(s) being deployed and confirm the pre/post-deployment checklist below.
3. **A merged migration is not a deployed migration.** Reviewers and authors
   should treat "merged to `main`" and "applied to the live database" as two
   separate, independently-verifiable facts. Do not assume one implies the
   other. `supabase migration list --linked` (or the equivalent MCP
   `list_migrations` call) against the live project is the source of truth for
   what is actually applied; the contents of `supabase/migrations/` in a
   repository checkout is the source of truth for what is merged.

## Pre-deployment checklist

Before running `supabase db push` (or applying a migration via the Supabase
dashboard/MCP) against the production project:

- [ ] Confirm the exact set of migration files being applied, by filename and
      timestamp, and that this matches what was reviewed in the PR(s).
- [ ] Confirm none of the files being applied create objects that already exist
      live under a different name (check `list_tables` / `list_edge_functions`
      for the affected schema first).
- [ ] Confirm application code that depends on any new object is either already
      deployed or is being deployed in the same change window — a migration
      that adds a column/table a live Edge Function or frontend build does not
      yet expect is lower risk than one that removes or renames something a
      live caller depends on.
- [ ] Confirm migration timestamp prefixes are unique and in the intended
      apply order (see the CI guard in `.github/workflows/quality-gate.yml`,
      which rejects duplicate timestamp prefixes in `supabase/migrations/`).
- [ ] Confirm RLS is enabled and policies are reviewed for any new table before
      it is reachable from client code.

## Post-deployment checklist

- [ ] Re-run `list_migrations` (or `supabase migration list --linked`) and
      confirm the applied set matches what was intended — no partial
      application, no unexpected extra migrations picked up.
- [ ] Spot-check the new objects directly (`list_tables`, a scoped
      `execute_sql` read) rather than relying only on the push command's exit
      status.
- [ ] Update any tracking doc or issue that was waiting on this deployment.

## Non-goals of this policy

This document does not introduce CI/CD automation for migration deployment,
does not retroactively deploy any currently-quarantined migration, and does not
require relocating or rewriting historical migrations that predate this policy.
It is a process statement for how deployment decisions should be made going
forward.
