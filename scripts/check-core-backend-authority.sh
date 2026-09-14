#!/usr/bin/env bash
# Fail-closed guard: Central may consume Core contracts but must not mutate
# Supabase migration or Edge Function authority. Historical legacy artifacts
# under these paths are frozen; any add/edit/delete/rename/copy is a violation.
#
# Usage: check-core-backend-authority.sh <base_ref> [target_ref]
#   base_ref   — auditable comparison base (required)
#   target_ref — comparison target commit (defaults to HEAD for local/push runs)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
base_ref="${1:-}"
target_ref="${2:-HEAD}"

fail() {
  echo "CORE BACKEND AUTHORITY VIOLATION: $*" >&2
  exit 1
}

[[ -n "$base_ref" ]] || fail "comparison base is required"
[[ ! "$base_ref" =~ ^0+$ ]] || fail "all-zero comparison base is not auditable"
git rev-parse --verify "${base_ref}^{commit}" >/dev/null 2>&1 || fail "comparison base does not resolve: $base_ref"
git rev-parse --verify "${target_ref}^{commit}" >/dev/null 2>&1 || fail "comparison target does not resolve: $target_ref"

target_is_head=false
if [[ "$target_ref" == "HEAD" ]]; then
  target_is_head=true
fi

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

is_guard_artifact_path() {
  case "$1" in
    .github/workflows/core-backend-authority.yml|scripts/check-core-backend-authority.sh|scripts/tests/verify-core-backend-authority.sh)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

guard_artifact_exists_at_base() {
  local path="$1"
  git cat-file -e "${base_ref}:${path}" >/dev/null 2>&1
}

record_guard_artifact_violation() {
  local detail="$1"
  violations+=("guard artifact $detail")
}

violations=()
while IFS= read -r -d '' status; do
  IFS= read -r -d '' path1 || fail "invalid diff pathname record"
  [[ -n "$status" ]] || continue

  path2=""
  if [[ "$status" == R* || "$status" == C* ]]; then
    IFS= read -r -d '' path2 || fail "invalid rename/copy pathname record"
  fi

  if is_guard_artifact_path "$path1" || { [[ -n "$path2" ]] && is_guard_artifact_path "$path2"; }; then
    if guard_artifact_exists_at_base "$path1" || { [[ -n "$path2" ]] && guard_artifact_exists_at_base "$path2"; }; then
      if [[ -n "$path2" ]]; then
        record_guard_artifact_violation "$status $path1 -> $path2"
      else
        record_guard_artifact_violation "$status $path1"
      fi
      continue
    fi
    if [[ "$status" != A ]]; then
      if [[ -n "$path2" ]]; then
        record_guard_artifact_violation "bootstrap-only addition allowed; got $status $path1 -> $path2"
      else
        record_guard_artifact_violation "bootstrap-only addition allowed; got $status $path1"
      fi
      continue
    fi
    continue
  fi

  case "$status" in
    R*|C*)
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
done < <(git diff --name-status -z -M -C --find-copies-harder "$base_ref" "$target_ref")

if [[ "$target_is_head" == true ]]; then
  while IFS= read -r -d '' path; do
    [[ -n "$path" ]] || continue
    if is_core_owned_path "$path"; then
      violations+=("untracked $path")
    fi
  done < <(git ls-files -z --others --exclude-standard)
fi

if ((${#violations[@]})); then
  echo "CORE BACKEND AUTHORITY VIOLATION: Oasis-Baklawa-Central may consume Core contracts but may not add, edit, delete, rename or copy Supabase migrations, archived migrations, or Edge Functions." >&2
  printf '  %s\n' "${violations[@]}" >&2
  echo "Move backend/schema changes to oasisbaklawa2006/oasis-supabase-core." >&2
  echo "Guard enforcement artifacts are self-protected after bootstrap; repository-admin governance is required to modify them." >&2
  exit 1
fi

echo "Core backend authority guard passed: historical Central backend artifacts are frozen and no Core-owned backend surface changed."
