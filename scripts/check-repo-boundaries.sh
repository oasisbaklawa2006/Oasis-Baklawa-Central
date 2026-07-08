#!/usr/bin/env bash
# Repo ownership boundary check for Oasis-Baklawa-Central.
# Fails if Catalogue AI-Studio frontend/schema work (owned by oasis-ai-studio /
# oasis-supabase-core) is reintroduced into Central's active source or migrations.
# See docs/repo-ownership-guardrails.md for the ownership split this enforces.
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

# Only active source/migration paths are scanned — never docs/, which
# necessarily names these terms to document the guardrail itself.
SCAN_PATHS=("src")
if [ -d "supabase/migrations" ]; then
  SCAN_PATHS+=("supabase/migrations")
fi

violations=0

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
  echo "Catalogue Product AI Studio frontend belongs in oasis-ai-studio (/admin/catalogue-product-studio);"
  echo "catalogue AI-Studio draft/audit schema belongs in oasis-supabase-core."
  echo "See docs/repo-ownership-guardrails.md."
  exit 1
fi

echo "Repo ownership boundary check passed — no Catalogue AI-Studio work found in Central's src/migrations."
