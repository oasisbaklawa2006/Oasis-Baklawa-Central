#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE="$ROOT/appverse-control/state.json"
OUT="$ROOT/appverse-control/generated/github-state.json"

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

mapfile -t REPOSITORIES < <(jq -r '.[]' <<<"$REPOSITORIES_JSON")

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

  while :; do
    args=(api graphql -f "query=$QUERY" -F "owner=$owner" -F "name=$name")
    if [[ -n "$after" ]]; then
      args+=(-F "after=$after")
    fi

    data="$(gh "${args[@]}")"
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
mkdir -p "$(dirname "$OUT")"
jq -S --arg generated_at "$GENERATED_AT" \
  '. + {generated_at: $generated_at}' <<<"$SNAPSHOT" >"$OUT"
