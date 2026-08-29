#!/usr/bin/env python3
"""Refresh objective GitHub facts for Appverse Mission Control.

This script intentionally DOES NOT modify semantic stage clearance in state.json.
Merged/open/CI facts are evidence only; gate clearance remains explicit.
"""
from __future__ import annotations

import json
import os
import pathlib
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
STATE = ROOT / "appverse-control" / "state.json"
OUT = ROOT / "appverse-control" / "generated" / "github-state.json"
GITHUB_API_ORIGIN = "https://api.github.com"
GRAPHQL_URL = f"{GITHUB_API_ORIGIN}/graphql"


def _token() -> str:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GH_TOKEN or GITHUB_TOKEN is required")
    return token


def _open_json(req: urllib.request.Request) -> Any:
    parsed = urllib.parse.urlsplit(req.full_url)
    if parsed.scheme != "https" or parsed.netloc != "api.github.com":
        raise ValueError(f"Forbidden GitHub API URL: {req.full_url}")
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return json.load(res)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API request failed ({exc.code}): {detail}") from exc


def graphql(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    req = urllib.request.Request(
        GRAPHQL_URL,
        data=payload,
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {_token()}",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "oasis-appverse-mission-control",
        },
    )
    body = _open_json(req)
    if body.get("errors"):
        raise RuntimeError(f"GitHub GraphQL errors: {body['errors']}")
    return body["data"]


REPO_QUERY = """
query RepositoryMissionControl($owner: String!, $name: String!, $after: String) {
  repository(owner: $owner, name: $name) {
    nameWithOwner
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
}
"""


def load_repositories() -> list[str]:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    repos = state.get("repositories")
    if not isinstance(repos, list) or not repos or not all(isinstance(repo, str) for repo in repos):
        raise RuntimeError("appverse-control/state.json must define a non-empty repositories list")
    return repos


def _normalize_context(node: dict[str, Any]) -> dict[str, Any]:
    if node["__typename"] == "CheckRun":
        return {
            "type": "check_run",
            "context": node.get("name"),
            "status": node.get("status"),
            "conclusion": node.get("conclusion"),
            "target_url": node.get("detailsUrl"),
        }
    return {
        "type": "status_context",
        "context": node.get("context"),
        "state": node.get("state"),
        "target_url": node.get("targetUrl"),
    }


def collect_repository(repo: str) -> dict[str, Any]:
    try:
        owner, name = repo.split("/", 1)
    except ValueError as exc:
        raise RuntimeError(f"Invalid repository name in state.json: {repo!r}") from exc

    after: str | None = None
    open_prs: list[dict[str, Any]] = []
    repo_meta: dict[str, Any] | None = None
    total_count: int | None = None

    while True:
        data = graphql(REPO_QUERY, {"owner": owner, "name": name, "after": after})
        repository = data.get("repository")
        if repository is None:
            raise RuntimeError(f"Repository not found or inaccessible: {repo}")
        if repo_meta is None:
            repo_meta = repository
            total_count = repository["pullRequests"]["totalCount"]

        pulls = repository["pullRequests"]
        for pr in pulls["nodes"]:
            commit_nodes = pr.get("commits", {}).get("nodes", [])
            rollup = None
            if commit_nodes:
                rollup = commit_nodes[-1].get("commit", {}).get("statusCheckRollup")
            contexts = []
            combined_status = "UNKNOWN"
            if rollup:
                combined_status = rollup.get("state") or "UNKNOWN"
                contexts = [_normalize_context(node) for node in rollup["contexts"]["nodes"]]
            open_prs.append(
                {
                    "number": pr["number"],
                    "title": pr["title"],
                    "url": pr["url"],
                    "draft": pr["isDraft"],
                    "mergeable": pr["mergeable"],
                    "head": pr["headRefOid"],
                    "base": pr["baseRefName"],
                    "updated_at": pr["updatedAt"],
                    "combined_status": combined_status,
                    "status_checks": contexts,
                }
            )

        page = pulls["pageInfo"]
        if not page["hasNextPage"]:
            break
        after = page["endCursor"]

    if total_count != len(open_prs):
        raise RuntimeError(
            f"Incomplete PR pagination for {repo}: expected {total_count}, collected {len(open_prs)}"
        )

    assert repo_meta is not None
    return {
        "default_branch": repo_meta["defaultBranchRef"]["name"] if repo_meta["defaultBranchRef"] else None,
        "archived": repo_meta["isArchived"],
        "open_pr_count": len(open_prs),
        "open_prs": open_prs,
    }


def _evidence_without_timestamp(snapshot: dict[str, Any]) -> dict[str, Any]:
    comparable = dict(snapshot)
    comparable.pop("generated_at", None)
    return comparable


def main() -> None:
    snapshot: dict[str, Any] = {
        "authority": "OBJECTIVE_GITHUB_EVIDENCE_ONLY",
        "clearance_warning": "This file MUST NOT autonomously mark ASM stages CLEARED.",
        "repositories": {},
    }

    for repo in load_repositories():
        snapshot["repositories"][repo] = collect_repository(repo)

    if OUT.exists():
        existing = json.loads(OUT.read_text(encoding="utf-8"))
        if _evidence_without_timestamp(existing) == snapshot:
            print("Mission Control evidence already current.")
            return

    snapshot["generated_at"] = datetime.now(timezone.utc).isoformat()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
