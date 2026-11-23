#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
STATE="$ROOT/appverse-control/state.json"
# The workflow runs this script from the default branch but writes into the live-state checkout.
OUT="${APPVERSE_GITHUB_STATE_OUT:-$ROOT/appverse-control/generated/github-state.json}"

QUERY='query RepositoryMissionControl($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    isArchived
    defaultBranchRef { name }
    pullRequests(
      states: OPEN
      first: 100
      after: $after
      orderBy: {field: UPDATED_AT, direction: DESC}
    ) {
      totalCount
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        url
        isDraft
        updatedAt
        baseRefName
        headRefOid
        mergeable
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 100) {
                  pageInfo { hasNextPage }
                  nodes {
                    __typename
                    ... on CheckRun {
                      name
                      status
                      conclusion
                      detailsUrl
                    }
                    ... on StatusContext {
                      context
                      state
                      targetUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}'

for tool in gh jq; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Required tool is unavailable: $tool" >&2
    exit 1
  fi
done

if ! REPOSITORIES_JSON="$(
  jq -ce '
    .repositories
    | select(type == "array" and length > 0)
    | select(all(.[]; type == "string" and length > 0))
  ' "$STATE"
)"; then
  echo 'state.json must contain a non-empty string repositories array.' >&2
  exit 1
fi

# Run one GraphQL page without letting `set -e` abort, so a repository the configured token cannot read can be
# told apart from a genuinely fatal error. Sets PAGE_OUT, PAGE_ERR and PAGE_RC.
run_page() {
  local out_file err_file
  out_file="$(mktemp)"
  err_file="$(mktemp)"
  PAGE_RC=0
  gh "$@" >"$out_file" 2>"$err_file" || PAGE_RC=$?
  PAGE_OUT="$(cat "$out_file")"
  PAGE_ERR="$(cat "$err_file")"
  rm -f "$out_file" "$err_file"
}

# Prints NOT_FOUND or FORBIDDEN and returns 0 only when the failure is an access/scope answer for this repository
# (GraphQL NOT_FOUND/FORBIDDEN, HTTP 403/404). Throttling and bad credentials are never access findings: they
# return 1 so the caller fails closed. Anything unrecognised also returns 1.
classify_access_failure() {
  local combined types
  combined="${PAGE_ERR}"$'\n'"${PAGE_OUT}"
  if grep -qiE 'rate limit|abuse detection|secondary|bad credentials|HTTP 401|requires authentication' <<<"$combined"; then
    return 1
  fi
  types="$(jq -r '[.errors[]?.type] | join(",")' <<<"$PAGE_OUT" 2>/dev/null || true)"
  if [[ "$types" == *FORBIDDEN* ]] || grep -qiE 'HTTP 403|Resource not accessible' <<<"$combined"; then
    echo FORBIDDEN
    return 0
  fi
  if [[ "$types" == *NOT_FOUND* ]] || grep -qE 'Could not resolve to a Repository|HTTP 404' <<<"$combined"; then
    echo NOT_FOUND
    return 0
  fi
  return 1
}

UNREADABLE=()

REPOSITORIES_TEXT="$(jq -r '.[]' <<<"$REPOSITORIES_JSON")"
mapfile -t REPOSITORIES <<<"$REPOSITORIES_TEXT"

SNAPSHOT="$(
  jq -cn '{
    authority: "OBJECTIVE_GITHUB_EVIDENCE_ONLY",
    clearance_warning: "This file MUST NOT autonomously mark ASM stages CLEARED.",
    repositories: {}
  }'
)"

for repo in "${REPOSITORIES[@]}"; do
  owner="${repo%%/*}"
  name="${repo#*/}"
  if [[ -z "$owner" || -z "$name" || "$owner" == "$name" || "$name" == */* ]]; then
    echo "Invalid repository in state.json: $repo" >&2
    exit 1
  fi

  after=''
  open_prs='[]'
  expected_count=''
  default_branch='null'
  archived='false'
  unreadable_class=''

  while :; do
    args=(api graphql -f "query=$QUERY" -F "owner=$owner" -F "name=$name")
    if [[ -n "$after" ]]; then
      args+=(-F "after=$after")
    fi

    run_page "${args[@]}"
    if (( PAGE_RC != 0 )); then
      # Only a first-page access answer is degraded; a failure mid-pagination, throttling, a bad credential, a
      # 5xx or anything unrecognised is fatal so incomplete evidence is never published.
      if [[ -z "$after" ]] && access_class="$(classify_access_failure)"; then
        unreadable_class="$access_class"
        break
      fi
      echo "GitHub query failed for $repo (exit $PAGE_RC): $PAGE_ERR" >&2
      exit 1
    fi
    data="$PAGE_OUT"
    repository="$(jq -ce '.data.repository // error("repository unavailable")' <<<"$data")"
    pulls="$(jq -c '.pullRequests' <<<"$repository")"

    if [[ -z "$expected_count" ]]; then
      expected_count="$(jq -r '.totalCount' <<<"$pulls")"
      default_branch="$(jq -c '.defaultBranchRef.name // null' <<<"$repository")"
      archived="$(jq -r '.isArchived' <<<"$repository")"
    fi

    page_prs="$(
      jq -ce '[
        .nodes[]
        | . as $pr
        | ($pr.commits.nodes[-1].commit.statusCheckRollup // null) as $rollup
        | if (($rollup.contexts.pageInfo.hasNextPage // false) == true) then
            error("more than 100 status contexts; refusing incomplete evidence")
          else
            {
              number: $pr.number,
              title: $pr.title,
              url: $pr.url,
              draft: $pr.isDraft,
              mergeable: $pr.mergeable,
              head: $pr.headRefOid,
              base: $pr.baseRefName,
              updated_at: $pr.updatedAt,
              combined_status: ($rollup.state // "UNKNOWN"),
              status_checks: [
                ($rollup.contexts.nodes // [])[]
                | if .__typename == "CheckRun" then
                    {
                      type: "check_run",
                      context: .name,
                      status: .status,
                      conclusion: .conclusion,
                      target_url: .detailsUrl
                    }
                  else
                    {
                      type: "status_context",
                      context: .context,
                      state: .state,
                      target_url: .targetUrl
                    }
                  end
              ]
            }
          end
      ]' <<<"$pulls"
    )"

    open_prs="$(
      jq -cn --argjson current "$open_prs" --argjson page "$page_prs" \
        '$current + $page'
    )"

    has_next="$(jq -r '.pageInfo.hasNextPage' <<<"$pulls")"
    if [[ "$has_next" != 'true' ]]; then
      break
    fi

    after="$(jq -r '.pageInfo.endCursor // empty' <<<"$pulls")"
    if [[ -z "$after" ]]; then
      echo "Missing pagination cursor for $repo" >&2
      exit 1
    fi
  done

  if [[ -n "$unreadable_class" ]]; then
    UNREADABLE+=("$repo")
    echo "::warning title=Mission Control repository unreadable::$repo returned $unreadable_class to the configured token and is recorded as unreadable, not as empty. Provide secrets.APPVERSE_READ_TOKEN (read-only, access to this repository) to include it."
    repo_snapshot="$(
      jq -cn --arg class "$unreadable_class" '{
        readable: false,
        access_status: "unreadable_with_configured_token",
        error_class: $class,
        detail: "GitHub returned NOT_FOUND or FORBIDDEN for the configured token. The repository may be private, renamed or deleted; this file makes no claim about its state.",
        default_branch: null,
        archived: null,
        open_pr_count: null,
        open_prs: null
      }'
    )"
    SNAPSHOT="$(
      jq -cn \
        --argjson snapshot "$SNAPSHOT" \
        --arg repo "$repo" \
        --argjson repo_snapshot "$repo_snapshot" \
        '$snapshot | .repositories[$repo] = $repo_snapshot'
    )"
    continue
  fi

  actual_count="$(jq 'length' <<<"$open_prs")"
  if [[ "$actual_count" != "$expected_count" ]]; then
    echo \
      "Incomplete PR pagination for $repo: expected $expected_count, got $actual_count" \
      >&2
    exit 1
  fi

  repo_snapshot="$(
    jq -cn \
      --argjson default_branch "$default_branch" \
      --argjson archived "$archived" \
      --argjson open_prs "$open_prs" \
      '{
        readable: true,
        access_status: "readable",
        default_branch: $default_branch,
        archived: $archived,
        open_pr_count: ($open_prs | length),
        open_prs: $open_prs
      }'
  )"

  SNAPSHOT="$(
    jq -cn \
      --argjson snapshot "$SNAPSHOT" \
      --arg repo "$repo" \
      --argjson repo_snapshot "$repo_snapshot" \
      '$snapshot | .repositories[$repo] = $repo_snapshot'
  )"
done

if (( ${#UNREADABLE[@]} >= ${#REPOSITORIES[@]} )); then
  echo 'No repository was readable with the configured token; refusing to publish an all-unreadable snapshot.' >&2
  exit 1
fi

UNREADABLE_JSON="$(jq -cn '$ARGS.positional | sort' --args "${UNREADABLE[@]}")"
SNAPSHOT="$(
  jq -cn --argjson snapshot "$SNAPSHOT" --argjson unreadable "$UNREADABLE_JSON" \
    '$snapshot | .unreadable_repositories = $unreadable'
)"

NEW_COMPARABLE="$(jq -S . <<<"$SNAPSHOT")"
EXISTING_COMPARABLE=''
if [[ -f "$OUT" ]]; then
  EXISTING_COMPARABLE="$(jq -S 'del(.generated_at)' "$OUT")"
fi

if [[ "$EXISTING_COMPARABLE" == "$NEW_COMPARABLE" ]]; then
  echo 'Mission Control evidence already current.'
  exit 0
fi

GENERATED_AT="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
OUT_DIR="$(dirname "$OUT")"
mkdir -p "$OUT_DIR"
jq -S --arg generated_at "$GENERATED_AT" \
  '. + {generated_at: $generated_at}' <<<"$SNAPSHOT" >"$OUT"
