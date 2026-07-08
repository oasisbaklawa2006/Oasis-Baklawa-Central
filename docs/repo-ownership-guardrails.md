# Repo Ownership Guardrails

## Why this exists

Catalogue Product AI Studio was originally built directly inside
Oasis-Baklawa-Central (PR #223/#224/#225), then found to be the wrong repo for
that workspace and decommissioned from Central (see the "decommission
catalogue AI studio workspace from central" change). This document records
the resulting ownership split so the same mistake — and the same rework — is
not repeated, and `scripts/check-repo-boundaries.sh` enforces it in CI.

## Ownership split

- **Oasis-Baklawa-Central** owns operations/admin, product master data,
  orders, finance, dispatch, warehouse, inventory, the approval inbox, the
  buyer catalogue, the catalogue connector, and approved catalogue snapshot
  intake.
- **oasis-ai-studio** owns the Catalogue Product AI Studio frontend: product
  intelligence, the content draft studio, the image prompt studio,
  packaging/variant readiness, the export/copy preview, and the AI-Studio
  draft workflow UI. Route: `/admin/catalogue-product-studio`.
- **oasis-supabase-core** owns Supabase migrations, RLS, backend schema
  authority, Edge Functions, and the catalogue AI-Studio draft/audit tables
  (`catalogue_ai_studio_drafts`, `catalogue_ai_studio_draft_audit_log`).

Central may still read *approved, published* catalogue output (e.g. via the
catalogue connector / approved snapshot intake) — what it must never do again
is host the AI-Studio drafting frontend or the AI-Studio draft/audit schema
itself.

## What the guardrail enforces

`scripts/check-repo-boundaries.sh` (wired to `npm run check:boundaries` and
run in CI via `.github/workflows/repo-boundaries.yml`) fails the build if
Central's active source or migrations reintroduce any of the following:

- `src/pages/admin/AdminCatalogueBuilder.tsx`
- `src/lib/catalogueReadinessScore.ts`
- `src/lib/catalogueContentDrafts.ts`
- `catalogue-builder`
- `AdminCatalogueBuilder`
- `Catalogue builder (preview)`
- `Catalogue Product AI Studio`
- `Content Draft Studio`
- `Media / Hero Image Prompt Studio`
- `Packaging + Variant`
- `Export / Copy Bundle`
- `catalogue_ai_studio_drafts`
- `catalogue_ai_studio_draft_audit_log`

The script only scans `src/` and `supabase/migrations/` (if present) — it
does not scan `docs/`, since this document necessarily names the forbidden
terms it is guarding against.

## If you hit this guardrail

If `npm run check:boundaries` fails:

1. Don't rebuild Catalogue Product AI Studio inside Central. Build it in
   `oasis-ai-studio` instead, at `/admin/catalogue-product-studio`.
2. Don't add catalogue AI-Studio draft/audit tables or migrations here. Add
   them in `oasis-supabase-core`.
3. If you believe the ownership split itself needs to change, update this
   document and the script's forbidden-pattern list together, deliberately —
   don't just delete the check.
