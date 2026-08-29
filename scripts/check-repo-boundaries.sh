#!/usr/bin/env bash
# Repo ownership boundary check for Oasis-Baklawa-Central.
#
# Backend authority invariant:
#   oasis-supabase-core is the ONLY repository allowed to own Supabase
#   migrations. Central may consume generated/runtime contracts, but it may not
#   introduce a shadow migration train or direct schema authority.
#
# Catalogue AI-Studio ownership rules below remain in force as a separate
# frontend/module boundary. See docs/repo-ownership-guardrails.md.
set -euo pipefail

FORBIDDEN_FILES=(
  "src/pages/admin/AdminCatalogueBuilder.tsx"
  "src/lib/catalogueReadinessScore.ts"
  "src/lib/catalogueContentDrafts.ts"
)

FORBIDDEN_PATTERNS=(
  "catalogue-builder"
  "AdminCatalogueBuilder"
  "Catalogue builder (preview)"
  "Catalogue Product AI Studio"
  "Content Draft Studio"
  "Media / Hero Image Prompt Studio"
  "Packaging + Variant"
  "Export / Copy Bundle"
  "catalogue_ai_studio_drafts"
  "catalogue_ai_studio_draft_audit_log"
)

# Preserve the pre-existing Catalogue AI-Studio scan scope. Migration SQL is
# forbidden wholesale below, but non-SQL files under the migration tree remain
# part of the legacy pattern scan so boundary coverage is not narrowed.
SCAN_PATHS=("src")
if [ -d "supabase/migrations" ]; then
  SCAN_PATHS+=("supabase/migrations")
fi

violations=0

# Supabase schema/migration authority belongs exclusively to
# oasis-supabase-core. Fail on ANY SQL migration file anywhere under this tree,
# regardless of nesting, contents, or feature area. This prevents a future PR
# from creating a second migration history that can drift from the canonical
# Core ledger.
if [ -d "supabase/migrations" ]; then
  mapfile -t shadow_migrations < <(find supabase/migrations -type f -name '*.sql' -print | LC_ALL=C sort)
  if [ "${#shadow_migrations[@]}" -gt 0 ]; then
    echo "BOUNDARY VIOLATION: Central must not own Supabase migrations. Move schema changes to oasis-supabase-core:"
    printf '  %s\n' "${shadow_migrations[@]}"
    violations=$((violations + 1))
  fi
fi

for f in "${FORBIDDEN_FILES[@]}"; do
  if [ -e "$f" ]; then
    echo "BOUNDARY VIOLATION: forbidden file reintroduced: $f"
    violations=$((violations + 1))
  fi
done

for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
  matches="$(grep -rIl --fixed-strings -- "$pattern" "${SCAN_PATHS[@]}" 2>/dev/null || true)"
  if [ -n "$matches" ]; then
    echo "BOUNDARY VIOLATION: forbidden pattern \"$pattern\" found in:"
    echo "$matches" | sed 's/^/  /'
    violations=$((violations + 1))
  fi
done

if [ "$violations" -gt 0 ]; then
  echo ""
  echo "Repo ownership boundary check FAILED ($violations violation(s))."
  echo "All Supabase migrations/schema authority belongs in oasis-supabase-core."
  echo "Catalogue Product AI Studio frontend belongs in oasis-ai-studio (/admin/catalogue-product-studio)."
  echo "See docs/repo-ownership-guardrails.md."
  exit 1
fi

echo "Repo ownership boundary check passed — Central owns no Supabase migrations and no Catalogue AI-Studio-owned source."
