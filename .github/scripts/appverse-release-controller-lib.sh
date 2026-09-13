#!/usr/bin/env bash

# Pure helpers for the APPVERSE release controller. Sourced by the controller
# script and regression tests; no GitHub API calls live here.

# Normalize Oasis-team Vercel preview URLs for exact correlation comparisons.
normalize_vercel_target_url() {
  local url="${1%/}"
  [[ -n "$url" ]] || return 1
  if [[ "$url" =~ ^https://[A-Za-z0-9-]+-oasisbaklawa2006-6222s-projects\.vercel\.app$ ]]; then
    printf '%s\n' "$url"
    return 0
  fi
  return 1
}

# Build the deterministic workflow run title used for exact AI-UAT correlation.
expected_ai_uat_run_title() {
  local head="$1" deployment_id="$2"
  printf 'APPVERSE AI UAT %s deployment-%s\n' "$head" "$deployment_id"
}

# Build the durable correlation marker for a governed AI-UAT dispatch.
ai_uat_correlation_marker() {
  local head="$1" deployment_id="$2" target_url="$3"
  printf 'APPVERSE_CONTROLLER:AI_UAT_CORRELATION:%s:%s:%s' "$head" "$deployment_id" "${target_url%/}"
}

# Return the newest trusted check-run conclusion for one exact commit/name pair.
trusted_check_conclusion_from_runs() {
  local check_runs_json="$1" name="$2" app_slug="$3"
  jq -r --arg name "$name" --arg app "$app_slug" '
    [.check_runs[]
      | select(.name == $name)
      | select((.app.slug // "") == $app)]
    | sort_by(.started_at)
    | last
    | .conclusion // "missing"
  ' <<<"$check_runs_json"
}

# Report whether one deployment status object is Vercel-authored.
vercel_authored_status() {
  jq -e '
    (.state == "success")
    and ((.environment_url // "") != "")
    and (
      ((.creator.login // "") == "vercel[bot]")
      or ((.performed_via_github_app.slug // "") == "vercel")
    )
  ' <<<"$1" >/dev/null
}

# Select the newest Vercel-authored successful deployment status JSON object.
select_vercel_authored_success_status() {
  jq '
    [.[][]
      | select(.state == "success")
      | select((.environment_url // "") != "")
      | select(
          ((.creator.login // "") == "vercel[bot]")
          or ((.performed_via_github_app.slug // "") == "vercel")
        )]
    | sort_by(.created_at)
    | last // {}
  '
}

# Build the durable dead-target marker for a failed exact-tuple AI-UAT correlation.
ai_uat_dead_target_marker() {
  local head="$1" deployment_id="$2"
  printf 'APPVERSE_CONTROLLER:AI_UAT_DEAD_TARGET:%s:%s' "$head" "$deployment_id"
}

# Count correlated AI-UAT terminal failures for one exact head+deployment tuple.
correlated_ai_uat_failure_count() {
  local runs_json="$1" head="$2" deployment_id="$3" merged_at="$4"
  local expected_title
  expected_title="$(expected_ai_uat_run_title "$head" "$deployment_id")"
  jq -r --arg merged_at "$merged_at" --arg expected_title "$expected_title" '
    [.[]
      | select(.created_at > $merged_at)
      | select(.event == "workflow_dispatch")
      | select(.head_branch == "main")
      | select(.display_title == $expected_title)
      | select(.conclusion == "failure" or .conclusion == "cancelled" or .conclusion == "timed_out" or .conclusion == "action_required")
    ] | length
  ' <<<"$runs_json"
}

# Report whether correlated AI-UAT failures have exhausted retry for one tuple.
ai_uat_tuple_is_dead() {
  local failure_count="$1"
  [[ "$failure_count" -ge 2 ]]
}

# Report whether the Dispatch PR head is behind current trusted main.
is_historical_dispatch_head() {
  local dispatch_head="$1" main_head="$2"
  [[ -n "$dispatch_head" && -n "$main_head" && "$dispatch_head" != "$main_head" ]]
}

# Accept an AI-UAT run when its deterministic workflow identity matches exact-head evidence.
ai_uat_run_matches_title() {
  local run_json="$1" head="$2" deployment_id="$3" merged_at="$4"
  local expected_title event branch title created
  expected_title="$(expected_ai_uat_run_title "$head" "$deployment_id")"
  event="$(jq -r '.event // empty' <<<"$run_json")"
  branch="$(jq -r '.head_branch // empty' <<<"$run_json")"
  title="$(jq -r '.display_title // empty' <<<"$run_json")"
  created="$(jq -r '.created_at // empty' <<<"$run_json")"
  [[ "$event" == "workflow_dispatch" \
    && "$branch" == "main" \
    && "$title" == "$expected_title" \
    && -n "$merged_at" \
    && -n "$created" \
    && "$created" > "$merged_at" ]]
}
