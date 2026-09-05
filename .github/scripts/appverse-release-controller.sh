#!/usr/bin/env bash
set -euo pipefail

: "${REPO:?REPO is required}"
: "${HUMAN_REVIEWER:?HUMAN_REVIEWER is required}"
: "${BOOTSTRAP_PR:?BOOTSTRAP_PR is required}"
: "${DISPATCH_PR:?DISPATCH_PR is required}"
: "${RLS_WORKFLOW:?RLS_WORKFLOW is required}"
: "${AI_UAT_WORKFLOW:?AI_UAT_WORKFLOW is required}"

EVENT_NAME="${EVENT_NAME:-}"
WORKFLOW_RUN_ID="${WORKFLOW_RUN_ID:-}"
WORKFLOW_RUN_NAME="${WORKFLOW_RUN_NAME:-}"
WORKFLOW_RUN_CONCLUSION="${WORKFLOW_RUN_CONCLUSION:-}"
WORKFLOW_RUN_URL="${WORKFLOW_RUN_URL:-}"

owner="${REPO%%/*}"
repo_name="${REPO#*/}"

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=appverse-release-controller-lib.sh
source "$script_dir/appverse-release-controller-lib.sh"

# Each hard gate is bound to both the human-readable check name and the
# expected GitHub App slug so a namesake check cannot satisfy release policy.
required_checks=(
  "Typecheck, unit test, production build, and Playwright smoke|github-actions"
  "Enforce Catalogue AI-Studio repo ownership boundaries|github-actions"
  "Codacy Static Code Analysis|codacy-production"
  "CodeQL|github-advanced-security"
  "Cursor Security Agent: Security Reviewer|cursor"
)

# Fetch the current GitHub pull-request document for a governed PR number.
pr_json() {
  gh api "repos/$REPO/pulls/$1"
}

# Return the exact current head SHA for a governed pull request.
pr_head() {
  pr_json "$1" | jq -r '.head.sha'
}

# Return the merge timestamp for a pull request, or an empty string if unmerged.
pr_merged_at() {
  pr_json "$1" | jq -r '.merged_at // empty'
}

# Return the newest conclusion for one named check from its expected GitHub App.
check_conclusion() {
  local head="$1" name="$2" app_slug="$3" runs
  runs="$(gh api -X GET "repos/$REPO/commits/$head/check-runs?per_page=100")"
  trusted_check_conclusion_from_runs "$runs" "$name" "$app_slug"
}

# Verify every stable governed check is successful on the PR's exact current head.
exact_checks_green() {
  local pr="$1" head spec name app_slug conclusion
  head="$(pr_head "$pr")"
  for spec in "${required_checks[@]}"; do
    IFS='|' read -r name app_slug <<<"$spec"
    conclusion="$(check_conclusion "$head" "$name" "$app_slug")"
    if [[ "$conclusion" != "success" ]]; then
      echo "PR #$pr is not exact-head green: $name ($app_slug) => $conclusion"
      return 1
    fi
  done
  return 0
}

# Count unresolved review threads, failing closed when more than one page exists.
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

# Accept human approval only when the latest exact-head decision is APPROVED.
has_exact_human_approval() {
  local pr="$1" head reviews state
  head="$(pr_head "$pr")"
  reviews="$(gh api --paginate --slurp -X GET "repos/$REPO/pulls/$pr/reviews?per_page=100")"
  state="$(jq -r --arg reviewer "$HUMAN_REVIEWER" --arg head "$head" '
    [.[][]
      | select(.user.login == $reviewer)
      | select(.commit_id == $head)
      | select(.state != "COMMENTED")]
    | sort_by(.submitted_at)
    | last
    | .state // "NONE"
  ' <<<"$reviews")"
  [[ "$state" == "APPROVED" ]]
}

# Request the designated independent collaborator review without failing reconciliation.
request_human_review() {
  local pr="$1"
  jq -n --arg reviewer "$HUMAN_REVIEWER" '{reviewers:[$reviewer]}' \
    | gh api -X POST "repos/$REPO/pulls/$pr/requested_reviewers" --input - >/dev/null || true
}

# Post a durable issue marker once after scanning every existing comment page.
comment_once() {
  local issue="$1" marker="$2" body="$3" comments
  comments="$(gh api --paginate --slurp -X GET "repos/$REPO/issues/$issue/comments?per_page=100")"
  if jq -e --arg marker "$marker" 'any(.[][]; ((.body // "") | contains($marker)))' <<<"$comments" >/dev/null; then
    return 0
  fi
  jq -n --arg body "$body" '{body:$body}' \
    | gh api -X POST "repos/$REPO/issues/$issue/comments" --input - >/dev/null
}

# Squash-merge a governed PR only after threads, checks, and human approval pass.
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

# Report whether the workflow-bootstrap pull request has already merged.
bootstrap_is_merged() {
  [[ "$(pr_json "$BOOTSTRAP_PR" | jq -r '.merged')" == "true" ]]
}

# Read the exact Dispatch head SHA pinned by the trusted main RLS workflow.
approved_rls_ref() {
  gh api "repos/$REPO/contents/.github/workflows/$RLS_WORKFLOW?ref=main" --jq '.content' \
    | tr -d '\n' | base64 -d \
    | sed -nE 's/^[[:space:]]*DISPATCH_RLS_CERT_APPROVED_REF:[[:space:]]*([0-9a-f]{40})[[:space:]]*$/\1/p' \
    | head -1
}

# Verify the trusted RLS workflow pin matches the current Dispatch PR head exactly.
rls_binding_current() {
  local approved current
  bootstrap_is_merged || return 1
  approved="$(approved_rls_ref)"
  current="$(pr_head "$DISPATCH_PR")"
  [[ -n "$approved" && "$approved" == "$current" ]]
}

# Return the repository's current trusted main commit SHA.
main_head_sha() {
  gh api "repos/$REPO/commits/main" --jq '.sha'
}

# Return the newest manually dispatched main-branch run for a named workflow.
latest_workflow_run_json() {
  local workflow="$1"
  gh api -X GET "repos/$REPO/actions/workflows/$workflow/runs?event=workflow_dispatch&branch=main&per_page=20" \
    --jq '.workflow_runs | sort_by(.created_at) | last // {}'
}

# Accept production RLS PASS only when its trusted-main run and Dispatch pin are current.
rls_pass_for_current_binding() {
  local merged_at latest conclusion created run_sha main_sha
  rls_binding_current || return 1
  merged_at="$(pr_merged_at "$BOOTSTRAP_PR")"
  [[ -n "$merged_at" ]] || return 1
  latest="$(latest_workflow_run_json "$RLS_WORKFLOW")"
  conclusion="$(jq -r '.conclusion // empty' <<<"$latest")"
  created="$(jq -r '.created_at // empty' <<<"$latest")"
  run_sha="$(jq -r '.head_sha // empty' <<<"$latest")"
  main_sha="$(main_head_sha)"
  [[ "$conclusion" == "success" \
    && -n "$created" \
    && "$created" > "$merged_at" \
    && -n "$run_sha" \
    && "$run_sha" == "$main_sha" ]]
}

# Queue the trusted-main production RLS workflow, retrying transient exposure delays.
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

# Dispatch RLS only when required and persist durable blockers for stale or failed evidence.
dispatch_rls_if_needed() {
  local bootstrap merged_at latest status conclusion created run_sha main_sha current approved marker body
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
  run_sha="$(jq -r '.head_sha // empty' <<<"$latest")"
  main_sha="$(main_head_sha)"

  if [[ -n "$created" && "$created" > "$merged_at" && "$run_sha" == "$main_sha" ]]; then
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

# Return the exact Dispatch PR head SHA used for deployment and AI-UAT binding.
dispatch_pr_head_sha() {
  pr_head "$DISPATCH_PR"
}

# Fetch one workflow run document.
workflow_run_json() {
  local run_id="$1"
  gh api "repos/$REPO/actions/runs/$run_id"
}

# Resolve a successful Vercel-authored deployment/status bound to the exact Dispatch head SHA.
vercel_deployment_for_dispatch_pr() {
  local head deployments id statuses status url
  head="$(dispatch_pr_head_sha)"
  deployments="$(gh api --paginate --slurp -X GET "repos/$REPO/deployments?sha=$head&per_page=100")"

  while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    statuses="$(gh api --paginate --slurp -X GET "repos/$REPO/deployments/$id/statuses?per_page=100")"
    status="$(select_vercel_authored_success_status <<<"$statuses")"
    url="$(jq -r '.environment_url // empty' <<<"$status")"
    if normalize_vercel_target_url "$url" >/dev/null; then
      printf '%s %s\n' "$id" "${url%/}"
      return 0
    fi
  done < <(
    jq -r --arg head "$head" '
      [.[][]
        | select(.sha == $head)
        | select(
            ((.performed_via_github_app.slug // "") == "vercel")
            or ((.creator.login // "") == "vercel[bot]")
          )]
      | sort_by(.created_at)
      | reverse
      | .[].id
    ' <<<"$deployments"
  )

  return 1
}

# Return the current governed AI-UAT correlation tuple: head deployment_id target_url.
expected_ai_uat_correlation() {
  local head deployment_id target_url
  head="$(dispatch_pr_head_sha)"
  if ! read -r deployment_id target_url < <(vercel_deployment_for_dispatch_pr); then
    return 1
  fi
  printf '%s %s %s\n' "$head" "$deployment_id" "$target_url"
}

# Persist the governed AI-UAT correlation before dispatching against exact-head evidence.
persist_ai_uat_correlation() {
  local head="$1" deployment_id="$2" target_url="$3" marker body
  marker="$(ai_uat_correlation_marker "$head" "$deployment_id" "$target_url")"
  body="$marker

Governed APPVERSE AI-UAT correlation for PR #$DISPATCH_PR: dispatch head $head, Vercel deployment $deployment_id, target ${target_url%/}. The AI-UAT workflow independently revalidates this exact tuple before QA secrets are exposed."
  comment_once 437 "$marker" "$body"
}

# Accept an AI-UAT run only when its deterministic identity matches current exact-head evidence.
ai_uat_run_matches_correlation() {
  local run_id="$1" head="$2" deployment_id="$3" merged_at="$4" run_json
  run_json="$(workflow_run_json "$run_id")"
  ai_uat_run_matches_title "$run_json" "$head" "$deployment_id" "$merged_at"
}

# Report whether a correlated AI-UAT dispatch is already queued, running, or succeeded.
governed_ai_uat_in_flight_or_succeeded() {
  local merged_at head deployment_id target_url run_id status conclusion run_json
  merged_at="$(pr_merged_at "$DISPATCH_PR")"
  [[ -n "$merged_at" ]] || return 1
  if ! read -r head deployment_id target_url < <(expected_ai_uat_correlation); then
    return 1
  fi

  while IFS= read -r run_id; do
    [[ -n "$run_id" ]] || continue
    ai_uat_run_matches_correlation "$run_id" "$head" "$deployment_id" "$merged_at" || continue
    run_json="$(workflow_run_json "$run_id")"
    status="$(jq -r '.status // empty' <<<"$run_json")"
    conclusion="$(jq -r '.conclusion // empty' <<<"$run_json")"
    if [[ "$status" == "queued" || "$status" == "in_progress" || "$conclusion" == "success" ]]; then
      return 0
    fi
  done < <(
    gh api --paginate --slurp -X GET "repos/$REPO/actions/workflows/$AI_UAT_WORKFLOW/runs?event=workflow_dispatch&branch=main&per_page=100" \
      | jq -r --arg merged_at "$merged_at" '
          [.[][] | select(.created_at > $merged_at)]
          | sort_by(.created_at)
          | reverse
          | .[].id
        '
  )

  return 1
}

# Dispatch AI-UAT against exact Vercel evidence; the workflow revalidates the tuple before secrets.
dispatch_ai_uat_if_needed() {
  local pr head deployment_id target marker body
  pr="$(pr_json "$DISPATCH_PR")"
  [[ "$(jq -r '.merged' <<<"$pr")" == "true" ]] || return 0
  governed_ai_uat_in_flight_or_succeeded && return 0

  if ! read -r head deployment_id target < <(expected_ai_uat_correlation); then
    marker="APPVERSE_CONTROLLER:AI_UAT_TARGET_MISSING:$(dispatch_pr_head_sha)"
    body="$marker

APPVERSE AI UAT was not dispatched because no successful Vercel-authored deployment status could be recovered for the exact PR #$DISPATCH_PR head."
    comment_once 437 "$marker" "$body"
    return 0
  fi

  persist_ai_uat_correlation "$head" "$deployment_id" "$target"
  echo "Dispatching APPVERSE AI UAT against deployment $deployment_id ($target) for Dispatch head $head"
  gh workflow run "$AI_UAT_WORKFLOW" --repo "$REPO" --ref main \
    -f target_url="$target" \
    -f dispatch_head_sha="$head" \
    -f deployment_id="$deployment_id" \
    -f enable_ai=true \
    -f send_images=false \
    -f synthetic_target=false
}

# Reconcile the bootstrap PR, requesting or consuming only exact-head human approval.
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

# Reconcile Dispatch only after current-head production RLS and exact-head checks are green.
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

# Translate trusted downstream workflow completions into governed durable handoffs.
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
    local head deployment_id target_url merged_at
    if [[ -z "$WORKFLOW_RUN_ID" ]]; then
      echo "APPVERSE AI UAT completion ignored: missing workflow run id."
      return 0
    fi
    merged_at="$(pr_merged_at "$DISPATCH_PR")"
    if ! read -r head deployment_id target_url < <(expected_ai_uat_correlation); then
      echo "APPVERSE AI UAT completion ignored: exact-head Vercel deployment evidence is unavailable."
      return 0
    fi
    if ! ai_uat_run_matches_correlation "$WORKFLOW_RUN_ID" "$head" "$deployment_id" "$merged_at"; then
      echo "APPVERSE AI UAT completion ignored: run $WORKFLOW_RUN_ID is not correlated to the exact PR #$DISPATCH_PR head and Vercel deployment."
      return 0
    fi

    if [[ "$WORKFLOW_RUN_CONCLUSION" == "success" ]]; then
      marker="APPVERSE_CONTROLLER:PHYSICAL_DISPATCH_UAT_REQUIRED:${WORKFLOW_RUN_ID}"
      body="$marker

Automated APPVERSE AI-UAT completed successfully against the exact PR #$DISPATCH_PR head and Vercel-authored deployment. Final physical Dispatch verification is now required on the actual device/workstation before this UAT tranche is physically certified. Run: $WORKFLOW_RUN_URL"
      comment_once 437 "$marker" "$body"
    else
      marker="APPVERSE_CONTROLLER:AI_UAT_FAILED:${WORKFLOW_RUN_ID}"
      body="$marker

APPVERSE AI-UAT reported a software failure/blocker for the correlated exact-head Vercel deployment. Physical sign-off is not requested until the automated evidence is reviewed and corrected. Run: $WORKFLOW_RUN_URL"
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
