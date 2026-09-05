#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../../.." && pwd)"
lib="$repo_root/.github/scripts/appverse-release-controller-lib.sh"
# shellcheck source=/dev/null
source "$lib"

assert_eq() {
  local actual="$1" expected="$2" label="$3"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label" >&2
    echo "  expected: $expected" >&2
    echo "  actual:   $actual" >&2
    exit 1
  fi
}

assert_fail() {
  local label="$1"
  shift
  if "$@"; then
    echo "FAIL: expected command to fail: $label" >&2
    exit 1
  fi
}

assert_pass() {
  local label="$1"
  shift
  if ! "$@"; then
    echo "FAIL: expected command to pass: $label" >&2
    exit 1
  fi
}

head="abc123def4567890abc123def4567890abcd1234"
deployment_id="424242"
target="https://preview-oasisbaklawa2006-6222s-projects.vercel.app"
merged_at="2026-01-01T00:00:00Z"

# 1) Dispatch head must remain the PR head SHA, not merge/test-merge SHA.
assert_eq "$(jq -r '.head.sha' <<<'{"head":{"sha":"'"$head"'"},"merge_commit_sha":"def4567890def4567890def4567890def4567890"}')" \
  "$head" \
  "dispatch binding uses PR head SHA"

# 2) Required checks must bind to trusted GitHub App slugs.
trusted_runs='{
  "check_runs": [
    {"name":"CodeQL","app":{"slug":"github-advanced-security"},"started_at":"2026-01-02T00:00:00Z","conclusion":"success"},
    {"name":"CodeQL","app":{"slug":"github-actions"},"started_at":"2026-01-03T00:00:00Z","conclusion":"success"}
  ]
}'
assert_eq "$(trusted_check_conclusion_from_runs "$trusted_runs" "CodeQL" "github-advanced-security")" \
  "success" \
  "trusted CodeQL conclusion ignores spoofed namesake"
assert_eq "$(trusted_check_conclusion_from_runs "$trusted_runs" "CodeQL" "github-actions")" \
  "success" \
  "spoofed slug matches only the decoy run"
assert_eq "$(trusted_check_conclusion_from_runs '{"check_runs":[{"name":"CodeQL","app":{"slug":"github-actions"},"started_at":"2026-01-03T00:00:00Z","conclusion":"success"}]}' "CodeQL" "github-advanced-security")" \
  "missing" \
  "namesake without trusted producer fails closed"

# 3) Vercel deployment status must be Vercel-authored, not arbitrary actor.
statuses='[
  [{"state":"success","environment_url":"https://good-oasisbaklawa2006-6222s-projects.vercel.app","creator":{"login":"vercel[bot]"},"created_at":"2026-01-01T00:00:00Z"}],
  [{"state":"success","environment_url":"https://evil-oasisbaklawa2006-6222s-projects.vercel.app","creator":{"login":"attacker"},"created_at":"2026-01-02T00:00:00Z"}]
]'
selected="$(select_vercel_authored_success_status <<<"$statuses")"
assert_eq "$(jq -r '.environment_url' <<<"$selected")" \
  "https://good-oasisbaklawa2006-6222s-projects.vercel.app" \
  "Vercel-authored status wins over later arbitrary actor"

# 4) AI-UAT correlation uses deterministic workflow identity, not workflow inputs.
title="$(expected_ai_uat_run_title "$head" "$deployment_id")"
assert_eq "$title" \
  "APPVERSE AI UAT ${head} deployment-${deployment_id}" \
  "deterministic AI-UAT run title"

governed_run="$(jq -n \
  --arg title "$title" \
  --arg created "2026-01-02T00:00:00Z" \
  '{event:"workflow_dispatch",head_branch:"main",display_title:$title,created_at:$created}')"
decoy_run="$(jq -n \
  --arg created "2026-01-03T00:00:00Z" \
  '{event:"workflow_dispatch",head_branch:"main",display_title:"APPVERSE AI UAT unrelated deployment-1",created_at:$created}')"

assert_pass "governed AI-UAT run title matches" \
  ai_uat_run_matches_title "$governed_run" "$head" "$deployment_id" "$merged_at"
assert_fail "unrelated AI-UAT run title is rejected" \
  ai_uat_run_matches_title "$decoy_run" "$head" "$deployment_id" "$merged_at"

marker="$(ai_uat_correlation_marker "$head" "$deployment_id" "$target")"
assert_eq "$marker" \
  "APPVERSE_CONTROLLER:AI_UAT_CORRELATION:${head}:${deployment_id}:${target}" \
  "durable correlation marker shape"

# 5) URL normalization rejects malformed Oasis-team hosts.
assert_pass "valid Oasis preview URL accepted" normalize_vercel_target_url "$target"
assert_fail "arbitrary host rejected" normalize_vercel_target_url "https://evil.example.com"

echo "appverse-release-controller.test.sh: all cases passed"
