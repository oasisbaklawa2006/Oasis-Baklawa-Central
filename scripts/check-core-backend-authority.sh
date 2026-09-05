#!/usr/bin/env bash
# Fail-closed guard: Central may consume Core contracts but must not mutate
# Supabase migration or Edge Function authority. Historical legacy artifacts
# under these paths are frozen; any add/edit/delete/rename/copy is a violation.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
base_ref="${1:-}"

fail() {
  echo "CORE BACKEND AUTHORITY VIOLATION: $*" >&2
  exit 1
}

[[ -n "$base_ref" ]] || fail "comparison base is required"
[[ ! "$base_ref" =~ ^0+$ ]] || fail "all-zero comparison base is not auditable"
git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1 || fail "comparison base does not resolve: $base_ref"

is_core_owned_path() {
  case "$1" in
    supabase/migrations/*.sql|supabase/archived-migrations/*.sql|supabase/functions/*)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

violations=()
while IFS= read -r -d '' status; do
  IFS= read -r -d '' path1 || fail "invalid diff pathname record"
  [[ -n "$status" ]] || continue
  case "$status" in
    R*|C*)
      IFS= read -r -d '' path2 || fail "invalid rename/copy pathname record"
      if is_core_owned_path "$path1" || is_core_owned_path "$path2"; then
        violations+=("$status $path1 -> $path2")
      fi
      ;;
    *)
      if is_core_owned_path "$path1"; then
        violations+=("$status $path1")
      fi
      ;;
  esac
done < <(git diff --name-status -z -M -C "$base_ref" HEAD)

while IFS= read -r -d '' path; do
  [[ -n "$path" ]] || continue
  if is_core_owned_path "$path"; then
    violations+=("untracked $path")
  fi
done < <(git ls-files -z --others --exclude-standard)

if ((${#violations[@]})); then
  echo "CORE BACKEND AUTHORITY VIOLATION: Oasis-Baklawa-Central may consume Core contracts but may not add, edit, delete, rename or copy Supabase migrations, archived migrations, or Edge Functions." >&2
  printf '  %s\n' "${violations[@]}" >&2
  echo "Move backend/schema changes to oasisbaklawa2006/oasis-supabase-core." >&2
  exit 1
fi

echo "Core backend authority guard passed: historical Central backend artifacts are frozen and no Core-owned backend surface changed."
