#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
checker="$repo_root/scripts/check-core-backend-authority.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

new_fixture() {
  local name="$1"
  local root="$test_root/$name"
  mkdir -p "$root/scripts" "$root/supabase/functions/legacy" "$root/supabase/archived-migrations/legacy"
  cp "$checker" "$root/scripts/check-core-backend-authority.sh"
  chmod +x "$root/scripts/check-core-backend-authority.sh"
  git -C "$root" init -q
  git -C "$root" config user.email "point25@test.local"
  git -C "$root" config user.name "point25"
  printf '%s\n' "// frozen legacy" > "$root/supabase/functions/legacy/index.ts"
  printf '%s\n' 'select 1;' > "$root/supabase/archived-migrations/legacy/20990101010101_frozen.sql"
  git -C "$root" add -A
  git -C "$root" commit -qm "baseline legacy backend artifacts"
  printf '%s\n' "$root"
}

expect_pass() {
  local root="$1" base="$2"
  if ! (cd "$root" && bash scripts/check-core-backend-authority.sh "$base") >"$root/out" 2>"$root/err"; then
    cat "$root/out" "$root/err" >&2 || true
    echo "expected core backend authority guard to pass: $root" >&2
    exit 1
  fi
}

expect_fail_with() {
  local root="$1" base="$2" expected="$3"
  set +e
  (cd "$root" && bash scripts/check-core-backend-authority.sh "$base") >"$root/out" 2>"$root/err"
  local status=$?
  set -e
  if [[ "$status" -eq 0 ]]; then
    echo "expected core backend authority guard to fail: $root" >&2
    exit 1
  fi
  if ! cat "$root/out" "$root/err" | grep -Fq -- "$expected"; then
    cat "$root/out" "$root/err" >&2 || true
    echo "expected failure text not found: $expected" >&2
    exit 1
  fi
}

root="$(new_fixture baseline)"
base="$(git -C "$root" rev-parse HEAD)"
expect_pass "$root" "$base"

root="$(new_fixture new-edge-function)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/supabase/functions/shadow"
printf '%s\n' 'export {}' > "$root/supabase/functions/shadow/index.ts"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture edit-edge-function)"
base="$(git -C "$root" rev-parse HEAD)"
printf '%s\n' '// mutated legacy' > "$root/supabase/functions/legacy/index.ts"
git -C "$root" add supabase/functions/legacy/index.ts
git -C "$root" commit -qm "mutate legacy edge function"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture new-archived-migration)"
base="$(git -C "$root" rev-parse HEAD)"
printf '%s\n' 'select 2;' > "$root/supabase/archived-migrations/legacy/20990101010102_shadow.sql"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture new-active-migration)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/supabase/migrations"
printf '%s\n' 'select 3;' > "$root/supabase/migrations/20990101010103_shadow.sql"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture benign-uat-sql)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/supabase/uat"
printf '%s\n' 'select 4;' > "$root/supabase/uat/local_integrity.sql"
git -C "$root" add supabase/uat/local_integrity.sql
git -C "$root" commit -qm "local uat fixture"
expect_pass "$root" "$base"

echo 'verify-core-backend-authority.sh: all cases passed'
