#!/usr/bin/env python3
"""Refresh objective GitHub facts for Appverse Mission Control.

This script intentionally DOES NOT modify semantic stage clearance in state.json.
Merged/open/CI facts are evidence only; gate clearance remains explicit.
"""
from __future__ import annotations

import json
import os
import pathlib
import urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[2]
OUT = ROOT / "appverse-control" / "generated" / "github-state.json"
REPOS = [
    "oasisbaklawa2006/Oasis-Baklawa-Central",
    "oasisbaklawa2006/oasis-supabase-core",
    "oasisbaklawa2006/oasis-ai-studio",
    "oasisbaklawa2006/oasis-trace",
    "oasisbaklawa2006/oasis-baklawa",
]


def api(path: str):
    req = urllib.request.Request(
        f"https://api.github.com{path}",
        headers={
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "oasis-appverse-mission-control",
        },
    )
    token = os.environ.get("GH_TOKEN") or os.environ.get("GITHUB_TOKEN")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(req, timeout=30) as res:
        return json.load(res)


def main() -> None:
    snapshot = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "authority": "OBJECTIVE_GITHUB_EVIDENCE_ONLY",
        "clearance_warning": "This file MUST NOT autonomously mark ASM stages CLEARED.",
        "repositories": {},
    }
    for repo in REPOS:
        meta = api(f"/repos/{repo}")
        pulls = api(f"/repos/{repo}/pulls?state=open&per_page=100&sort=updated&direction=desc")
        open_prs = []
        for pr in pulls:
            sha = pr["head"]["sha"]
            status = api(f"/repos/{repo}/commits/{sha}/status")
            open_prs.append(
                {
                    "number": pr["number"],
                    "title": pr["title"],
                    "url": pr["html_url"],
                    "draft": pr["draft"],
                    "mergeable_state_source": "PR API not used for semantic clearance",
                    "head": sha,
                    "base": pr["base"]["ref"],
                    "updated_at": pr["updated_at"],
                    "combined_status": status.get("state", "unknown"),
                    "statuses": [
                        {
                            "context": s.get("context"),
                            "state": s.get("state"),
                            "target_url": s.get("target_url"),
                        }
                        for s in status.get("statuses", [])
                    ],
                }
            )
        snapshot["repositories"][repo] = {
            "default_branch": meta["default_branch"],
            "archived": meta["archived"],
            "open_pr_count": len(open_prs),
            "open_prs": open_prs,
        }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(snapshot, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
