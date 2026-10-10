#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
checker="$repo_root/scripts/check-core-backend-authority.sh"
workflow="$repo_root/.github/workflows/core-backend-authority.yml"
advisory_workflow="$repo_root/.github/workflows/core-backend-authority-advisory.yml"
secret_workflow="$repo_root/.github/workflows/secret-exposure-guard.yml"
secret_advisory_workflow="$repo_root/.github/workflows/secret-exposure-guard-advisory.yml"
secret_scanner="$repo_root/scripts/check-tracked-secret-exposure.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

stage_guard_workflow() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$workflow" ]]; then
    cp "$workflow" "$dest"
  else
    printf '%s\n' '# bootstrap guard workflow fixture' > "$dest"
  fi
}

stage_advisory_guard_workflow() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$advisory_workflow" ]]; then
    cp "$advisory_workflow" "$dest"
  else
    printf '%s\n' '# bootstrap advisory guard workflow fixture' > "$dest"
  fi
}

stage_secret_guard_workflow() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$secret_workflow" ]]; then
    cp "$secret_workflow" "$dest"
  else
    printf '%s\n' '# bootstrap secret guard workflow fixture' > "$dest"
  fi
}

stage_secret_advisory_workflow() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  if [[ -f "$secret_advisory_workflow" ]]; then
    cp "$secret_advisory_workflow" "$dest"
  else
    printf '%s\n' '# bootstrap secret advisory workflow fixture' > "$dest"
  fi
}

stage_secret_scanner() {
  local dest="$1"
  mkdir -p "$(dirname "$dest")"
  cp "$secret_scanner" "$dest"
  chmod +x "$dest"
}

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
  local root="$1" base="$2" target="${3:-}"
  local cmd=(bash scripts/check-core-backend-authority.sh "$base")
  if [[ -n "$target" ]]; then cmd+=("$target"); fi
  if ! (cd "$root" && "${cmd[@]}") >"$root/out" 2>"$root/err"; then
    cat "$root/out" "$root/err" >&2 || true
    echo "expected core backend authority guard to pass: $root" >&2
    exit 1
  fi
}

expect_fail_with() {
  local root="$1" base="$2" expected="$3" target="${4:-}"
  local cmd=(bash scripts/check-core-backend-authority.sh "$base")
  if [[ -n "$target" ]]; then cmd+=("$target"); fi
  set +e
  (cd "$root" && "${cmd[@]}") >"$root/out" 2>"$root/err"
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

root="$(new_fixture local-tracked-edge-function)"
base="$(git -C "$root" rev-parse HEAD)"
printf '%s\n' '// uncommitted mutation' > "$root/supabase/functions/legacy/index.ts"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture local-staged-edge-function)"
base="$(git -C "$root" rev-parse HEAD)"
printf '%s\n' '// staged mutation' > "$root/supabase/functions/legacy/index.ts"
git -C "$root" add supabase/functions/legacy/index.ts
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

root="$(new_fixture tab-pathname-edge-function)"
base="$(git -C "$root" rev-parse HEAD)"
tab_dir=$'supabase/functions/shadow\tpath'
mkdir -p "$root/$tab_dir"
printf '%s\n' 'export {}' > "$root/$tab_dir/index.ts"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture copy-protected-edge-function)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/docs"
cp "$root/supabase/functions/legacy/index.ts" "$root/docs/copied-index.ts"
git -C "$root" add docs/copied-index.ts
git -C "$root" commit -qm "copy protected edge function to non-core path"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION'

root="$(new_fixture explicit-base-to-head)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/supabase/functions/shadow"
printf '%s\n' 'export {}' > "$root/supabase/functions/shadow/index.ts"
git -C "$root" add supabase/functions/shadow/index.ts
git -C "$root" commit -qm "add shadow edge function"
head="$(git -C "$root" rev-parse HEAD)"
expect_fail_with "$root" "$base" 'CORE BACKEND AUTHORITY VIOLATION' "$head"

root="$(new_fixture moving-base-tip)"
git -C "$root" checkout -qb target-branch
printf '%s\n' 'benign target change' > "$root/README.target"
git -C "$root" add README.target
git -C "$root" commit -qm "benign target change"
target="$(git -C "$root" rev-parse HEAD)"
git -C "$root" checkout -q master
mkdir -p "$root/supabase/functions/new-on-main"
printf '%s\n' '// base-only Core-owned addition' > "$root/supabase/functions/new-on-main/index.ts"
git -C "$root" add supabase/functions/new-on-main/index.ts
git -C "$root" commit -qm "base tip advances with Core-owned path"
base_tip="$(git -C "$root" rev-parse HEAD)"
expect_pass "$root" "$base_tip" "$target"

gitlink_root="$test_root/secret-gitlink"
mkdir -p "$gitlink_root"
git -C "$gitlink_root" init -q
git -C "$gitlink_root" config user.email "secret@test.local"
git -C "$gitlink_root" config user.name "secret"
printf '%s\n' 'safe' > "$gitlink_root/file.txt"
git -C "$gitlink_root" add file.txt
git -C "$gitlink_root" commit -qm "safe baseline"
gitlink_sha="$(printf '1%.0s' {1..40})"
git -C "$gitlink_root" update-index --add --cacheinfo 160000,"$gitlink_sha",vendor/submodule
git -C "$gitlink_root" commit -qm "add synthetic gitlink"
if ! (cd "$gitlink_root" && bash "$secret_scanner" --git-ref HEAD) >"$gitlink_root/out" 2>"$gitlink_root/err"; then
  cat "$gitlink_root/out" "$gitlink_root/err" >&2 || true
  echo 'git-ref secret scan failed on gitlink instead of skipping it' >&2
  exit 1
fi

root="$(new_fixture guard-bootstrap-addition)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/.github/workflows" "$root/scripts/tests"
stage_guard_workflow "$root/.github/workflows/core-backend-authority.yml"
stage_advisory_guard_workflow "$root/.github/workflows/core-backend-authority-advisory.yml"
stage_secret_guard_workflow "$root/.github/workflows/secret-exposure-guard.yml"
stage_secret_advisory_workflow "$root/.github/workflows/secret-exposure-guard-advisory.yml"
cp "$checker" "$root/scripts/check-core-backend-authority.sh"
stage_secret_scanner "$root/scripts/check-tracked-secret-exposure.sh"
cp "$0" "$root/scripts/tests/verify-core-backend-authority.sh"
chmod +x "$root/scripts/check-core-backend-authority.sh" "$root/scripts/tests/verify-core-backend-authority.sh"
git -C "$root" add .github/workflows/core-backend-authority.yml .github/workflows/core-backend-authority-advisory.yml .github/workflows/secret-exposure-guard.yml .github/workflows/secret-exposure-guard-advisory.yml scripts/check-core-backend-authority.sh scripts/check-tracked-secret-exposure.sh scripts/tests/verify-core-backend-authority.sh
git -C "$root" commit -qm "bootstrap guard artifacts"
head="$(git -C "$root" rev-parse HEAD)"
expect_pass "$root" "$base" "$head"

root="$(new_fixture guard-self-protection)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/.github/workflows" "$root/scripts/tests"
stage_guard_workflow "$root/.github/workflows/core-backend-authority.yml"
stage_advisory_guard_workflow "$root/.github/workflows/core-backend-authority-advisory.yml"
stage_secret_guard_workflow "$root/.github/workflows/secret-exposure-guard.yml"
stage_secret_advisory_workflow "$root/.github/workflows/secret-exposure-guard-advisory.yml"
cp "$checker" "$root/scripts/check-core-backend-authority.sh"
stage_secret_scanner "$root/scripts/check-tracked-secret-exposure.sh"
cp "$0" "$root/scripts/tests/verify-core-backend-authority.sh"
chmod +x "$root/scripts/check-core-backend-authority.sh" "$root/scripts/tests/verify-core-backend-authority.sh"
git -C "$root" add .github/workflows/core-backend-authority.yml .github/workflows/core-backend-authority-advisory.yml .github/workflows/secret-exposure-guard.yml .github/workflows/secret-exposure-guard-advisory.yml scripts/check-core-backend-authority.sh scripts/check-tracked-secret-exposure.sh scripts/tests/verify-core-backend-authority.sh
git -C "$root" commit -qm "bootstrap guard artifacts"
base="$(git -C "$root" rev-parse HEAD)"
printf '\n# weakened\n' >> "$root/scripts/check-core-backend-authority.sh"
git -C "$root" add scripts/check-core-backend-authority.sh
git -C "$root" commit -qm "attempt to weaken guard script"
head="$(git -C "$root" rev-parse HEAD)"
expect_fail_with "$root" "$base" 'guard artifact' "$head"

root="$(new_fixture secret-guard-self-protection)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/.github/workflows" "$root/scripts/tests"
stage_guard_workflow "$root/.github/workflows/core-backend-authority.yml"
stage_advisory_guard_workflow "$root/.github/workflows/core-backend-authority-advisory.yml"
stage_secret_guard_workflow "$root/.github/workflows/secret-exposure-guard.yml"
stage_secret_advisory_workflow "$root/.github/workflows/secret-exposure-guard-advisory.yml"
cp "$checker" "$root/scripts/check-core-backend-authority.sh"
stage_secret_scanner "$root/scripts/check-tracked-secret-exposure.sh"
cp "$0" "$root/scripts/tests/verify-core-backend-authority.sh"
chmod +x "$root/scripts/check-core-backend-authority.sh" "$root/scripts/tests/verify-core-backend-authority.sh"
git -C "$root" add .github/workflows/core-backend-authority.yml .github/workflows/core-backend-authority-advisory.yml .github/workflows/secret-exposure-guard.yml .github/workflows/secret-exposure-guard-advisory.yml scripts/check-core-backend-authority.sh scripts/check-tracked-secret-exposure.sh scripts/tests/verify-core-backend-authority.sh
git -C "$root" commit -qm "bootstrap guard artifacts"
base="$(git -C "$root" rev-parse HEAD)"
printf '\n# weakened\n' >> "$root/scripts/check-tracked-secret-exposure.sh"
git -C "$root" add scripts/check-tracked-secret-exposure.sh
git -C "$root" commit -qm "attempt to weaken secret scanner"
head="$(git -C "$root" rev-parse HEAD)"
expect_fail_with "$root" "$base" 'guard artifact' "$head"

root="$(new_fixture advisory-workflow-self-protection)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/.github/workflows" "$root/scripts/tests"
stage_guard_workflow "$root/.github/workflows/core-backend-authority.yml"
stage_advisory_guard_workflow "$root/.github/workflows/core-backend-authority-advisory.yml"
stage_secret_guard_workflow "$root/.github/workflows/secret-exposure-guard.yml"
stage_secret_advisory_workflow "$root/.github/workflows/secret-exposure-guard-advisory.yml"
cp "$checker" "$root/scripts/check-core-backend-authority.sh"
stage_secret_scanner "$root/scripts/check-tracked-secret-exposure.sh"
cp "$0" "$root/scripts/tests/verify-core-backend-authority.sh"
chmod +x "$root/scripts/check-core-backend-authority.sh" "$root/scripts/tests/verify-core-backend-authority.sh"
git -C "$root" add .github/workflows/core-backend-authority.yml .github/workflows/core-backend-authority-advisory.yml .github/workflows/secret-exposure-guard.yml .github/workflows/secret-exposure-guard-advisory.yml scripts/check-core-backend-authority.sh scripts/check-tracked-secret-exposure.sh scripts/tests/verify-core-backend-authority.sh
git -C "$root" commit -qm "bootstrap guard artifacts"
base="$(git -C "$root" rev-parse HEAD)"
printf '\n# weakened\n' >> "$root/.github/workflows/core-backend-authority-advisory.yml"
git -C "$root" add .github/workflows/core-backend-authority-advisory.yml
git -C "$root" commit -qm "attempt to weaken advisory guard workflow"
head="$(git -C "$root" rev-parse HEAD)"
expect_fail_with "$root" "$base" 'guard artifact' "$head"

root="$(new_fixture secret-workflow-self-protection)"
base="$(git -C "$root" rev-parse HEAD)"
mkdir -p "$root/.github/workflows" "$root/scripts/tests"
stage_guard_workflow "$root/.github/workflows/core-backend-authority.yml"
stage_advisory_guard_workflow "$root/.github/workflows/core-backend-authority-advisory.yml"
stage_secret_guard_workflow "$root/.github/workflows/secret-exposure-guard.yml"
stage_secret_advisory_workflow "$root/.github/workflows/secret-exposure-guard-advisory.yml"
cp "$checker" "$root/scripts/check-core-backend-authority.sh"
stage_secret_scanner "$root/scripts/check-tracked-secret-exposure.sh"
cp "$0" "$root/scripts/tests/verify-core-backend-authority.sh"
chmod +x "$root/scripts/check-core-backend-authority.sh" "$root/scripts/tests/verify-core-backend-authority.sh"
git -C "$root" add .github/workflows/core-backend-authority.yml .github/workflows/core-backend-authority-advisory.yml .github/workflows/secret-exposure-guard.yml .github/workflows/secret-exposure-guard-advisory.yml scripts/check-core-backend-authority.sh scripts/check-tracked-secret-exposure.sh scripts/tests/verify-core-backend-authority.sh
git -C "$root" commit -qm "bootstrap guard artifacts"
base="$(git -C "$root" rev-parse HEAD)"
printf '\n# weakened\n' >> "$root/.github/workflows/secret-exposure-guard.yml"
git -C "$root" add .github/workflows/secret-exposure-guard.yml
git -C "$root" commit -qm "attempt to weaken secret workflow"
head="$(git -C "$root" rev-parse HEAD)"
expect_fail_with "$root" "$base" 'guard artifact' "$head"

real_git="$(command -v git)"
root="$(new_fixture git-diff-failure)"
base="$(git -C "$root" rev-parse HEAD)"
mock_bin="$root/mock-bin"
mkdir -p "$mock_bin"
cat > "$mock_bin/git" <<'MOCK_GIT'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${FAIL_GIT_DIFF:-}" == '1' && "${1:-}" == 'diff' ]]; then
  exit 97
fi
if [[ "${FAIL_GIT_LS_FILES:-}" == '1' && "${1:-}" == 'ls-files' ]]; then
  exit 98
fi
exec "${REAL_GIT:?}" "$@"
MOCK_GIT
chmod +x "$mock_bin/git"
set +e
(cd "$root" && PATH="$mock_bin:$PATH" REAL_GIT="$real_git" FAIL_GIT_DIFF=1 bash scripts/check-core-backend-authority.sh "$base") >"$root/out" 2>"$root/err"
status=$?
set -e
[[ "$status" -ne 0 ]] || { echo 'expected injected git diff failure to fail closed' >&2; exit 1; }
grep -Fq 'git diff failed' "$root/err" || { cat "$root/err" >&2; echo 'missing git diff failure diagnostic' >&2; exit 1; }

root="$(new_fixture git-ls-files-failure)"
base="$(git -C "$root" rev-parse HEAD)"
mock_bin="$root/mock-bin"
mkdir -p "$mock_bin"
cat > "$mock_bin/git" <<'MOCK_GIT'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${FAIL_GIT_LS_FILES:-}" == '1' && "${1:-}" == 'ls-files' ]]; then
  exit 98
fi
exec "${REAL_GIT:?}" "$@"
MOCK_GIT
chmod +x "$mock_bin/git"
set +e
(cd "$root" && PATH="$mock_bin:$PATH" REAL_GIT="$real_git" FAIL_GIT_LS_FILES=1 bash scripts/check-core-backend-authority.sh "$base") >"$root/out" 2>"$root/err"
status=$?
set -e
[[ "$status" -ne 0 ]] || { echo 'expected injected git ls-files failure to fail closed' >&2; exit 1; }
grep -Fq 'git ls-files failed' "$root/err" || { cat "$root/err" >&2; echo 'missing git ls-files failure diagnostic' >&2; exit 1; }

secret_root="$test_root/secret-relative-root"
mkdir -p "$secret_root/checkout"
git -C "$secret_root/checkout" init -q
git -C "$secret_root/checkout" config user.email "secret@test.local"
git -C "$secret_root/checkout" config user.name "secret"
runtime_token="ghp_$(printf 'A%.0s' {1..24})"
printf '%s\n' "$runtime_token" > "$secret_root/checkout/fixture.txt"
git -C "$secret_root/checkout" add fixture.txt
git -C "$secret_root/checkout" commit -qm "tracked synthetic secret fixture"
set +e
(cd "$secret_root" && bash "$secret_scanner" checkout) >"$secret_root/out" 2>"$secret_root/err"
status=$?
set -e
[[ "$status" -ne 0 ]] || { echo 'relative-root secret scan silently skipped tracked files' >&2; exit 1; }
grep -Fq 'TRACKED_SECRET_EXPOSURE_DETECTED' "$secret_root/err" || { cat "$secret_root/err" >&2; echo 'relative-root secret scan missing detection diagnostic' >&2; exit 1; }

lock_root="$test_root/secret-lockfile"
mkdir -p "$lock_root"
git -C "$lock_root" init -q
git -C "$lock_root" config user.email "secret@test.local"
git -C "$lock_root" config user.name "secret"
runtime_token="ghp_$(printf 'B%.0s' {1..24})"
printf '%s\n' "$runtime_token" > "$lock_root/Cargo.lock"
git -C "$lock_root" add Cargo.lock
git -C "$lock_root" commit -qm "tracked lockfile synthetic secret fixture"
set +e
bash "$secret_scanner" "$lock_root" >"$lock_root/out" 2>"$lock_root/err"
status=$?
set -e
[[ "$status" -ne 0 ]] || { echo 'tracked lockfile secret was skipped' >&2; exit 1; }
grep -Fq 'TRACKED_SECRET_EXPOSURE_DETECTED' "$lock_root/err" || { cat "$lock_root/err" >&2; echo 'lockfile secret scan missing detection diagnostic' >&2; exit 1; }

scan_fail_root="$test_root/secret-enumeration-failure"
mkdir -p "$scan_fail_root/repo" "$scan_fail_root/bin"
git -C "$scan_fail_root/repo" init -q
git -C "$scan_fail_root/repo" config user.email "secret@test.local"
git -C "$scan_fail_root/repo" config user.name "secret"
printf '%s\n' 'safe' > "$scan_fail_root/repo/file.txt"
git -C "$scan_fail_root/repo" add file.txt
git -C "$scan_fail_root/repo" commit -qm "safe tracked fixture"
cat > "$scan_fail_root/bin/git" <<'MOCK_GIT'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == 'ls-files' ]]; then
  exit 99
fi
exec "${REAL_GIT:?}" "$@"
MOCK_GIT
chmod +x "$scan_fail_root/bin/git"
set +e
PATH="$scan_fail_root/bin:$PATH" REAL_GIT="$real_git" bash "$secret_scanner" "$scan_fail_root/repo" >"$scan_fail_root/out" 2>"$scan_fail_root/err"
status=$?
set -e
[[ "$status" -ne 0 ]] || { echo 'secret scanner treated git ls-files failure as success' >&2; exit 1; }
grep -Fq 'TRACKED_SECRET_EXPOSURE_SCAN_FAILED' "$scan_fail_root/err" || { cat "$scan_fail_root/err" >&2; echo 'secret scanner missing enumeration failure diagnostic' >&2; exit 1; }

echo 'verify-core-backend-authority.sh: all cases passed'
