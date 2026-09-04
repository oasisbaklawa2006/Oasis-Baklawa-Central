#!/usr/bin/env bash
set -euo pipefail

: "${REPO:?REPO is required}"
: "${HUMAN_REVIEWER:?HUMAN_REVIEWER is required}"
: "${BOOTSTRAP_PR:?BOOTSTRAP_PR is required}"
: "${DISPATCH_PR:?DISPATCH_PR is required}"
: "${RLS_WORKFLOW:?RLS_WORKFLOW is required}"
: "${AI_UAT_WORKFLOW:?AI_UAT_WORKFLOW is required}"

EVENT_NAME="${EVENT_NAME:-}"
WORKFLOW_RUN_NAME="${WORKFLOW_RUN_NAME:-}"
WORKFLOW_RUN_CONCLUSION="${WORKFLOW_RUN_CONCLUSION:-}"
WORKFLOW_RUN_URL="${WORKFLOW_RUN_URL:-}"

owner="${REPO%%/*}"
repo_name="${REPO#*/}"

required_checks=(
  "Typecheck, unit test, production build, and Playwright smoke"
  "Enforce Catalogue AI-Studio repo ownership boundaries"
  "Codacy Static Code Analysis"
  "CodeQL"
  "github-advanced-security"
  "Cursor Security Agent: Security Reviewer"
)

pr_json() {
  gh api "repos/$REPO/pulls/$1"
}

pr_head() {
  pr_json "$1" | jq -r '.head.sha'
}

pr_merged_at() {
  pr_json "$1" | jq -r '.merged_at // empty'
}

check_conclusion() {
  local head="$1" name="$2"
  gh api -X GET "repos/$REPO/commits/$head/check-runs?per_page=100" \
    --jq ".check_runs | map(select(.name == \"$name\")) | sort_by(.started_at) | last | .conclusion // \"missing\""
}

exact_checks_green() {
  local pr="$1" head conclusion name
  head="$(pr_head "$pr")"
  for name in "${required_checks[@]}"; do
    conclusion="$(check_conclusion "$head" "$name")"
    if [[ "$conclusion" != "success" ]]; then
      echo "PR #$pr is not exact-head green: $name => $conclusion"
      return 1
    fi
  done
  return 0
}

unresolved_threads() {
  local pr="$1" response has_next count
  response="$(gh api graphql \
    -f query='query($owner:String!,$name:String!,$number:Int!){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved} pageInfo{hasNextPage}}}}}' \
    -f owner="$owner" -f name="$repo_name" -F number="$pr")"
  has_next="$(jq -r '.data.repository.pullRequest.reviewThreads.pageInfo.hasNextPage' <<<"$response")"
  if [[ "$has_next" == "true" ]]; then
    echo "999"
    return 0
  fi
  count="$(jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved == false)] | length' <<<"$response")"
  echo "$count"
}

has_exact_human_approval() {
  local pr="$1" head count
  head="$(pr_head "$pr")"
  count="$(gh api -X GET "repos/$REPO/pulls/$pr/reviews?per_page=100" \
    --jq "[.[] | select(.user.login == \"$HUMAN_REVIEWER\" and .state == \"APPROVED\" and .commit_id == \"$head\")] | length")"
  [[ "$count" =~ ^[1-9][0-9]*$ ]]
}

request_human_review() {
  local pr="$1"
  jq -n --arg reviewer "$HUMAN_REVIEWER" '{reviewers:[$reviewer]}' \
    | gh api -X POST "repos/$REPO/pulls/$pr/requested_reviewers" --input - >/dev/null || true
}

comment_once() {
  local issue="$1" marker="$2" body="$3" comments
  comments="$(gh api -X GET "repos/$REPO/issues/$issue/comments?per_page=100")"
  if jq -e --arg marker "$marker" 'any(.[]; ((.body // "") | contains($marker)))' <<<"$comments" >/dev/null; then
    return 0
  fi
  jq -n --arg body "$body" '{body:$body}' \
    | gh api -X POST "repos/$REPO/issues/$issue/comments" --input - >/dev/null
}

merge_governed_pr() {
  local pr="$1" head threads
  head="$(pr_head "$pr")"
  threads="$(unresolved_threads "$pr")"
  if [[ "$threads" != "0" ]]; then
    echo "PR #$pr has unresolved/unbounded review threads ($threads); refusing merge."
    return 1
  fi
  exact_checks_green "$pr" || return 1
  if ! has_exact_human_approval "$pr"; then
    echo "PR #$pr awaits exact-head human approval from $HUMAN_REVIEWER."
    request_human_review "$pr"
    return 1
  fi
  echo "Merging governed PR #$pr at exact head $head"
  jq -n --arg sha "$head" '{merge_method:"squash",sha:$sha}' \
    | gh api -X PUT "repos/$REPO/pulls/$pr/merge" --input -
}

bootstrap_is_merged() {
  [[ "$(pr_json "$BOOTSTRAP_PR" | jq -r '.merged')" == "true" ]]
}

approved_rls_ref() {
  gh api "repos/$REPO/contents/.github/workflows/$RLS_WORKFLOW?ref=main" --jq '.content' \
    | tr -d '\n' | base64 -d \
    | sed -nE 's/^[[:space:]]*DISPATCH_RLS_CERT_APPROVED_REF:[[:space:]]*([0-9a-f]{40})[[:space:]]*$/\1/p' \
    | head -1
}

rls_binding_current() {
  local approved current
  bootstrap_is_merged || return 1
  approved="$(approved_rls_ref)"
  current="$(pr_head "$DISPATCH_PR")"
  [[ -n "$approved" && "$approved" == "$current" ]]
}

latest_workflow_run_json() {
  local workflow="$1"
  gh api -X GET "repos/$REPO/actions/workflows/$workflow/runs?event=workflow_dispatch&per_page=20" \
    --jq '.workflow_runs | sort_by(.created_at) | last // {}'
}

rls_pass_for_current_binding() {
  local merged_at latest conclusion created
  rls_binding_current || return 1
  merged_at="$(pr_merged_at "$BOOTSTRAP_PR")"
  [[ -n "$merged_at" ]] || return 1
  latest="$(latest_workflow_run_json "$RLS_WORKFLOW")"
  conclusion="$(jq -r '.conclusion // empty' <<<"$latest")"
  created="$(jq -r '.created_at // empty' <<<"$latest")"
  [[ "$conclusion" == "success" && -n "$created" && "$created" > "$merged_at" ]]
}

dispatch_rls() {
  local attempt
  for attempt in 1 2 3 4 5 6; do
    if gh workflow run "$RLS_WORKFLOW" --repo "$REPO" --ref main; then
      echo "Dispatch RLS certification queued."
      return 0
    fi
    echo "RLS workflow not dispatchable yet (attempt $attempt/6); retrying in 10s."
    sleep 10
  done
  return 1
}

dispatch_rls_if_needed() {
  local bootstrap merged_at latest status conclusion created current approved marker body
  bootstrap="$(pr_json "$BOOTSTRAP_PR")"
  [[ "$(jq -r '.merged' <<<"$bootstrap")" == "true" ]] || return 0

  if ! rls_binding_current; then
    current="$(pr_head "$DISPATCH_PR")"
    approved="$(approved_rls_ref || true)"
    marker="APPVERSE_CONTROLLER:RLS_STALE:$current"
    body="$marker

Dispatch production RLS certification is fail-closed because the workflow pin ($approved) does not match current PR #$DISPATCH_PR head ($current). Refresh the pin through review before certification."
    comment_once "$DISPATCH_PR" "$marker" "$body"
    return 0
  fi

  merged_at="$(jq -r '.merged_at' <<<"$bootstrap")"
  latest="$(latest_workflow_run_json "$RLS_WORKFLOW")"
  status="$(jq -r '.status // empty' <<<"$latest")"
  conclusion="$(jq -r '.conclusion // empty' <<<"$latest")"
  created="$(jq -r '.created_at // empty' <<<"$latest")"

  if [[ -n "$created" && "$created" > "$merged_at" ]]; then
    if [[ "$status" == "queued" || "$status" == "in_progress" || "$conclusion" == "success" ]]; then
      return 0
    fi
    marker="APPVERSE_CONTROLLER:RLS_FAILED:$created"
    body="$marker

Dispatch RLS certification did not pass. The controller will not merge #$DISPATCH_PR. Inspect the failed certification run before retrying."
    comment_once "$DISPATCH_PR" "$marker" "$body"
    return 0
  fi

  echo "Dispatching production RLS certification from trusted main."
  if ! dispatch_rls; then
    marker="APPVERSE_CONTROLLER:RLS_DISPATCH_FAILED:$(date -u +%Y%m%dT%H%M)"
    body="$marker

The controller could not dispatch $RLS_WORKFLOW after six trusted-main retries. #$DISPATCH_PR remains blocked."
    comment_once "$DISPATCH_PR" "$marker" "$body"
  fi
}

vercel_preview_for_dispatch_pr() {
  gh api -X GET "repos/$REPO/issues/$DISPATCH_PR/comments?per_page=100" \
    --jq '.[] | select(.user.login == "vercel[bot]") | .body' \
    | grep -oE 'https://[A-Za-z0-9-]+-oasisbaklawa2006-6222s-projects\.vercel\.app' \
    | tail -1
}

ai_uat_run_after_dispatch_merge_exists() {
  local merged_at latest created
  merged_at="$(pr_merged_at "$DISPATCH_PR")"
  [[ -n "$merged_at" ]] || return 1
  latest="$(latest_workflow_run_json "$AI_UAT_WORKFLOW")"
  created="$(jq -r '.created_at // empty' <<<"$latest")"
  [[ -n "$created" && "$created" > "$merged_at" ]]
}

dispatch_ai_uat_if_needed() {
  local pr target marker body
  pr="$(pr_json "$DISPATCH_PR")"
  [[ "$(jq -r '.merged' <<<"$pr")" == "true" ]] || return 0
  ai_uat_run_after_dispatch_merge_exists && return 0

  target="$(vercel_preview_for_dispatch_pr || true)"
  if [[ -z "$target" ]]; then
    marker="APPVERSE_CONTROLLER:AI_UAT_TARGET_MISSING:$(jq -r '.merge_commit_sha // .head.sha' <<<"$pr")"
    body="$marker

APPVERSE AI UAT was not dispatched because no approved Oasis-team Vercel preview URL could be recovered from PR #$DISPATCH_PR."
    comment_once 437 "$marker" "$body"
    return 0
  fi

  echo "Dispatching APPVERSE AI UAT against $target"
  gh workflow run "$AI_UAT_WORKFLOW" --repo "$REPO" --ref main \
    -f target_url="$target" \
    -f enable_ai=true \
    -f send_images=false \
    -f synthetic_target=false
}

reconcile_bootstrap() {
  local pr head marker body
  pr="$(pr_json "$BOOTSTRAP_PR")"
  [[ "$(jq -r '.state' <<<"$pr")" == "open" ]] || return 0
  exact_checks_green "$BOOTSTRAP_PR" || return 0
  [[ "$(unresolved_threads "$BOOTSTRAP_PR")" == "0" ]] || return 0

  if has_exact_human_approval "$BOOTSTRAP_PR"; then
    merge_governed_pr "$BOOTSTRAP_PR" || true
    return 0
  fi

  request_human_review "$BOOTSTRAP_PR"
  head="$(jq -r '.head.sha' <<<"$pr")"
  marker="APPVERSE_CONTROLLER:READY_FOR_APPROVAL:$BOOTSTRAP_PR:$head"
  body="$marker

PR #$BOOTSTRAP_PR is exact-head green and review-clean. Independent collaborator approval from @$HUMAN_REVIEWER is the only remaining merge gate."
  comment_once "$BOOTSTRAP_PR" "$marker" "$body"
}

reconcile_dispatch() {
  local pr head marker body
  bootstrap_is_merged || return 0
  pr="$(pr_json "$DISPATCH_PR")"
  [[ "$(jq -r '.state' <<<"$pr")" == "open" ]] || return 0
  rls_pass_for_current_binding || return 0
  exact_checks_green "$DISPATCH_PR" || return 0
  [[ "$(unresolved_threads "$DISPATCH_PR")" == "0" ]] || return 0

  request_human_review "$DISPATCH_PR"
  head="$(jq -r '.head.sha' <<<"$pr")"
  marker="APPVERSE_CONTROLLER:RLS_PASS:$DISPATCH_PR:$head"
  body="$marker

Production Dispatch RLS certification PASS is bound to current PR #$DISPATCH_PR head, and exact-head CI/security is green. Independent collaborator approval is the remaining merge gate."
  comment_once "$DISPATCH_PR" "$marker" "$body"

  if has_exact_human_approval "$DISPATCH_PR"; then
    merge_governed_pr "$DISPATCH_PR" || true
  fi
}

handle_workflow_completion() {
  local marker body
  [[ "$EVENT_NAME" == "workflow_run" ]] || return 0

  if [[ "$WORKFLOW_RUN_NAME" == "Dispatch RBAC Production RLS Certification" ]]; then
    if [[ "$WORKFLOW_RUN_CONCLUSION" == "success" ]] && rls_binding_current; then
      reconcile_dispatch
    else
      marker="APPVERSE_CONTROLLER:RLS_WORKFLOW_BLOCKED:${GITHUB_RUN_ID}"
      body="$marker

Dispatch RLS certification did not produce a current-head PASS. #$DISPATCH_PR remains blocked. Run: $WORKFLOW_RUN_URL"
      comment_once "$DISPATCH_PR" "$marker" "$body"
    fi
    return 0
  fi

  if [[ "$WORKFLOW_RUN_NAME" == "APPVERSE AI UAT" ]]; then
    if [[ "$WORKFLOW_RUN_CONCLUSION" == "success" ]]; then
      marker="APPVERSE_CONTROLLER:PHYSICAL_DISPATCH_UAT_REQUIRED:${GITHUB_RUN_ID}"
      body="$marker

Automated APPVERSE AI-UAT tranche completed successfully. Final physical Dispatch verification is now required on the actual device/workstation before this UAT tranche is considered physically certified. Run: $WORKFLOW_RUN_URL"
      comment_once 437 "$marker" "$body"
    else
      marker="APPVERSE_CONTROLLER:AI_UAT_FAILED:${GITHUB_RUN_ID}"
      body="$marker

APPVERSE AI-UAT reported a software failure/blocker. Physical sign-off is not requested until the automated evidence is reviewed and corrected. Run: $WORKFLOW_RUN_URL"
      comment_once 437 "$marker" "$body"
    fi
  fi
}

# Dependency order is intentional. A merge performed in an earlier function is
# visible to the next function in this same trusted controller run.
reconcile_bootstrap
dispatch_rls_if_needed
reconcile_dispatch
dispatch_ai_uat_if_needed
handle_workflow_completion
