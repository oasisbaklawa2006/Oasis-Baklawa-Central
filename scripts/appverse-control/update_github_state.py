#!/usr/bin/env python3
"""Refresh objective GitHub facts for Appverse Mission Control.

This script never modifies semantic stage clearance in state.json. GitHub facts
are evidence only; programme clearance remains an explicit gate decision.
"""
from __future__ import annotations

import http.client
import json
import os
import pathlib
from datetime import datetime, timezone
from typing import Any

ROOT = pathlib.Path(__file__).resolve().parents[2]
STATE = ROOT / "appverse-control" / "state.json"
OUT = ROOT / "appverse-control" / "generated" / "github-state.json"
GITHUB_API_HOST = "api.github.com"
GRAPHQL_PATH = "/graphql"

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
}
"""


def _token() -> str:
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if not token:
        raise RuntimeError("GH_TOKEN or GITHUB_TOKEN is required")
    return token


def _graphql(query: str, variables: dict[str, Any]) -> dict[str, Any]:
    payload = json.dumps({"query": query, "variables": variables}).encode()
    headers = {
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "Authorization": f"Bearer {_token()}",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oasis-appverse-mission-control",
    }

    with http.client.HTTPSConnection(GITHUB_API_HOST, timeout=30) as connection:
        connection.request("POST", GRAPHQL_PATH, body=payload, headers=headers)
        response = connection.getresponse()
        raw_body = response.read()

    body = json.loads(raw_body.decode("utf-8"))
    if response.status != 200:
        raise RuntimeError(
            f"GitHub GraphQL request failed with HTTP {response.status}"
        )
    if body.get("errors"):
        raise RuntimeError(f"GitHub GraphQL errors: {body['errors']}")
    data = body.get("data")
    if not isinstance(data, dict):
        raise RuntimeError("GitHub GraphQL response did not contain data")
    return data


def load_repositories() -> list[str]:
    state = json.loads(STATE.read_text(encoding="utf-8"))
    repos = state.get("repositories")
    valid = (
        isinstance(repos, list)
        and bool(repos)
        and all(isinstance(repo, str) for repo in repos)
    )
    if not valid:
        raise RuntimeError(
            "appverse-control/state.json must define a non-empty repositories list"
        )
    return repos


def _repo_parts(repo: str) -> tuple[str, str]:
    owner, separator, name = repo.partition("/")
    if separator != "/" or not owner or not name or "/" in name:
        raise RuntimeError(f"Invalid repository name in state.json: {repo!r}")
    return owner, name


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


def _rollup_snapshot(pr: dict[str, Any]) -> tuple[str, list[dict[str, Any]]]:
    commit_nodes = pr.get("commits", {}).get("nodes", [])
    if not commit_nodes:
        return "UNKNOWN", []

    rollup = commit_nodes[-1].get("commit", {}).get("statusCheckRollup")
    if not rollup:
        return "UNKNOWN", []

    contexts = rollup["contexts"]
    if contexts["pageInfo"]["hasNextPage"]:
        raise RuntimeError(
            f"PR #{pr['number']} has more than 100 status contexts; "
            "refusing to publish incomplete evidence"
        )

    normalized = [_normalize_context(node) for node in contexts["nodes"]]
    return rollup.get("state") or "UNKNOWN", normalized


def _pr_snapshot(pr: dict[str, Any]) -> dict[str, Any]:
    combined_status, contexts = _rollup_snapshot(pr)
    return {
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


def collect_repository(repo: str) -> dict[str, Any]:
    owner, name = _repo_parts(repo)
    after: str | None = None
    open_prs: list[dict[str, Any]] = []
    repo_meta: dict[str, Any] | None = None
    total_count: int | None = None

    while True:
        data = _graphql(
            REPO_QUERY,
            {"owner": owner, "name": name, "after": after},
        )
        repository = data.get("repository")
        if repository is None:
            raise RuntimeError(f"Repository not found or inaccessible: {repo}")

        pulls = repository["pullRequests"]
        if repo_meta is None:
            repo_meta = repository
            total_count = pulls["totalCount"]

        open_prs.extend(_pr_snapshot(pr) for pr in pulls["nodes"])
        page_info = pulls["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        after = page_info["endCursor"]
        if not after:
            raise RuntimeError(f"Missing pagination cursor for repository {repo}")

    if total_count != len(open_prs):
        raise RuntimeError(
            f"Incomplete PR pagination for {repo}: expected {total_count}, "
            f"collected {len(open_prs)}"
        )
    if repo_meta is None:
        raise RuntimeError(f"Missing repository metadata for {repo}")

    branch = repo_meta.get("defaultBranchRef")
    return {
        "default_branch": branch["name"] if branch else None,
        "archived": repo_meta["isArchived"],
        "open_pr_count": len(open_prs),
        "open_prs": open_prs,
    }


def _evidence_without_timestamp(snapshot: dict[str, Any]) -> dict[str, Any]:
    comparable = dict(snapshot)
    comparable.pop("generated_at", None)
    return comparable


def _evidence_changed(snapshot: dict[str, Any]) -> bool:
    if not OUT.exists():
        return True
    existing = json.loads(OUT.read_text(encoding="utf-8"))
    return _evidence_without_timestamp(existing) != snapshot


def main() -> None:
    snapshot: dict[str, Any] = {
        "authority": "OBJECTIVE_GITHUB_EVIDENCE_ONLY",
        "clearance_warning": (
            "This file MUST NOT autonomously mark ASM stages CLEARED."
        ),
        "repositories": {},
    }

    for repo in load_repositories():
        snapshot["repositories"][repo] = collect_repository(repo)

    if not _evidence_changed(snapshot):
        print("Mission Control evidence already current.")
        return

    snapshot["generated_at"] = datetime.now(timezone.utc).isoformat()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    rendered = json.dumps(snapshot, indent=2, sort_keys=True) + "\n"
    OUT.write_text(rendered, encoding="utf-8")


if __name__ == "__main__":
    main()
