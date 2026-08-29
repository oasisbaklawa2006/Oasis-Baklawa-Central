#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
checker="$repo_root/scripts/check-repo-boundaries.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

new_fixture() {
  local name="$1"
  local root="$test_root/$name"
  mkdir -p "$root/scripts" "$root/src" "$root/supabase/migrations"
  cp "$checker" "$root/scripts/check-repo-boundaries.sh"
  chmod +x "$root/scripts/check-repo-boundaries.sh"
  git -C "$root" init -q
  printf '%s\n' "$root"
}

expect_pass() {
  local root="$1"
  if ! (cd "$root" && bash scripts/check-repo-boundaries.sh) >"$root/out" 2>"$root/err"; then
    cat "$root/out" "$root/err" >&2 || true
    echo "expected boundary checker to pass: $root" >&2
    exit 1
  fi
}

expect_fail_with() {
  local root="$1" expected="$2"
  set +e
  (cd "$root" && bash scripts/check-repo-boundaries.sh) >"$root/out" 2>"$root/err"
  local status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    echo "expected boundary checker to fail: $root" >&2
    exit 1
  fi
  if ! cat "$root/out" "$root/err" | grep -Fq -- "$expected"; then
    cat "$root/out" "$root/err" >&2 || true
    echo "expected failure text not found: $expected" >&2
    exit 1
  fi
}

# Baseline: an empty Central-style tree is valid.
root="$(new_fixture baseline)"
expect_pass "$root"

# A nested SQL migration must be rejected; this locks out the former
# `-maxdepth 1` bypass permanently.
root="$(new_fixture nested-sql)"
mkdir -p "$root/supabase/migrations/archive/legacy"
printf '%s\n' 'select 1;' > "$root/supabase/migrations/archive/legacy/20990101010101_shadow.sql"
expect_fail_with "$root" 'Central must not own Supabase migrations'

# Non-SQL files under the migration tree remain in the pre-existing Catalogue
# AI-Studio pattern scan, so restoring migration authority must not narrow the
# older ownership boundary.
root="$(new_fixture migration-pattern)"
printf '%s\n' 'catalogue-builder' > "$root/supabase/migrations/notes.txt"
expect_fail_with "$root" 'forbidden pattern "catalogue-builder"'

# The original src boundary remains active.
root="$(new_fixture src-pattern)"
printf '%s\n' 'AdminCatalogueBuilder' > "$root/src/forbidden.txt"
expect_fail_with "$root" 'forbidden pattern "AdminCatalogueBuilder"'

# A benign non-SQL migration-tree note is allowed; only SQL authority and the
# existing forbidden Catalogue patterns are prohibited.
root="$(new_fixture benign-note)"
printf '%s\n' 'documentation only' > "$root/supabase/migrations/README.txt"
expect_pass "$root"

echo 'verify-repo-boundaries.sh: all cases passed'
