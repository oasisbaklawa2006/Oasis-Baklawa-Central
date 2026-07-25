# ADR: WhatsApp `whatsapp_business_intakes` migrations quarantined, not deployed

- **Status:** Accepted
- **Date:** 2026-07-21
- **Related:** `supabase/archived-migrations/whatsapp-business-intakes-undelivered/README.md`,
  `supabase/migration-governance/blocked-undelivered-migrations.json`

## Context

Between 2026-07-18 and 2026-07-20, 47 SQL migration files defining a new
`whatsapp_business_intakes` table family were merged into `main`. Investigation
established:

1. **None of the 47 migrations were ever applied to the production database.**
   Their timestamps do not appear in the live applied-migration ledger.
2. **No caller depends on them.** No application code, Edge Function, or later
   migration in any of the four Oasis repositories (`Oasis-Baklawa-Central`,
   `oasis-ai-studio`, `oasis-trace`, `oasis-supabase-core`) references any table,
   function, or trigger these migrations create.
3. **The gap is structural, not deliberate.** No repository has an automated
   migration deployment pipeline. Merging a migration to `main` has never been
   sufficient by itself to apply it to production; that has always required a
   manual `supabase db push`, which was not run for this batch.
4. **This batch defines a third, competing WhatsApp intake pipeline.** The
   canonical, live WhatsApp pipeline (Lane 1) is:
   `whatsapp-webhook -> whatsapp_messages -> whatsapp-message-stitcher ->
   whatsapp_message_packets -> whatsapp-route-packet / whatsapp-identify-sender
   -> Central OperatorInbox -> create_sales_order_draft_atomic ->
   sales_order_drafts`. A separate, dormant AI Studio bridge (Lane 2) writes to
   `whatsapp_inbound_messages`. This batch's `whatsapp_business_intakes` family
   (Lane 3) is architecturally independent of both and was never wired to
   either.

Deploying this batch as-is would activate a third production WhatsApp data
model with no application code pointed at it, fragmenting the WhatsApp domain
across three incompatible table families. Silently leaving the files in
`supabase/migrations/` risked an accidental `supabase db push --include-all`
applying them without review.

## Decision

1. **Do not deploy these 47 migrations in their current form.**
2. **Do not create a third WhatsApp production lane.** The canonical live path
   remains Lane 1. The AI Studio bridge (Lane 2) also does not automatically
   become a second operational authority.
3. **Quarantine, not delete.** The 47 files are relocated (via `git mv`,
   preserving byte content and git history) from `supabase/migrations/` to
   `supabase/archived-migrations/whatsapp-business-intakes-undelivered/`, which
   is outside the path the Supabase CLI scans for pending migrations. This was
   verified against the actual installed CLI's source
   (`supabase/cli`, `pkg/migration/list.go`): `ListLocalMigrations` calls
   `fs.ReadDir` non-recursively on `supabase/migrations` only and skips
   subdirectories and non-`.sql`-pattern files.
4. **Useful concepts are eligible for reimplementation, not resurrection.**
   Sender attribution, escalation tracking, and SLA/accountability concepts in
   this batch may inform future work, but any such work must be written as new
   migrations against the canonical schema (Lane 1), reviewed independently,
   and is explicitly out of scope for this quarantine change.
5. **A CI guard prevents silent reintroduction** of files matching this
   batch's naming pattern into `supabase/migrations/` (see the repository's CI
   workflow).

## Consequences

- Production is unaffected — this change touches only the repository's file
  layout and CI configuration, not the live database.
- The 47 files remain available for reference and potential future
  reimplementation, with full git history intact.
- A `supabase db push --include-all` run against `main` after this change can
  no longer pick up this batch.
- Any future decision to deploy a reworked version of these concepts requires a
  new migration, a new PR, and a new review — this ADR does not pre-approve
  any specific reimplementation.

## Alternatives considered

- **Deploy as-is:** rejected — creates a third, unintegrated WhatsApp
  production lane with zero application-layer callers.
- **Delete outright:** rejected — discards real design work and severs git
  history for content that may still inform future canonical implementation.
- **Leave in `supabase/migrations/` with a Markdown-only warning:** rejected —
  does not prevent `supabase db push` from applying the files; a warning
  comment has no enforcement mechanism.
