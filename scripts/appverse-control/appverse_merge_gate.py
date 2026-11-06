#!/usr/bin/env python3
"""Trusted-main Appverse PR merge gate. Never executes PR branch code or merges PRs."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request

REPO = "oasisbaklawa2006/Oasis-Baklawa-Central"
RULESET_ID = 19200597
LABEL = "appverse-gated"  # Controls optional auto-merge enrollment, NOT required check publication.
CHECK_NAME = "Appverse Merge Gate"
GITHUB_ACTIONS_APP_ID = 15368
TRUSTED_HUMANS = {"oasisbaklawa2006", "dineshmutrejabackup-cmd"}
TRUSTED_BOT_APPROVERS = {"cursor[bot]"}
REQUIRED_CHECKS = {
    "Typecheck, unit test, production build, and Playwright smoke": "github-actions",
    "Enforce Catalogue AI-Studio repo ownership boundaries": "github-actions",
    "Scan tracked files for secret values (trusted)": "github-actions",
    "Enforce oasis-supabase-core backend authority (trusted)": "github-actions",
    "Codacy Static Code Analysis": "codacy-production",
    "Cursor Security Agent: Security Reviewer": "cursor",
    "Cursor Approval Agent: Pull Request Approver": "cursor",
    "CodeRabbit": "coderabbitai",
}
REQUIRED_STATUSES = {
    "security/snyk (oasisbaklawa2006)": ("success", "snyk-io[bot]"),
    "Vercel": ("success", "vercel[bot]"),
}
GATE_FILE = ".github/workflows/appverse-merge-gate.yml"
GATE_SCRIPT = "scripts/appverse-control/appverse_merge_gate.py"
GOVERNANCE_FILES = {
    GATE_FILE, GATE_SCRIPT, ".github/CODEOWNERS",
    ".github/workflows/appverse-merge-gate-ci.yml",
    "tests/appverse-control/test_appverse_merge_gate.py",
}


class GateError(Exception):
    """Unknown, missing or inconsistent evidence never satisfies merge requirements."""


def api(path: str, *, method: str = "GET", data: dict | None = None) -> dict | list:
    token = os.environ["GH_TOKEN"]
    body = None if data is None else json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        "https://api.github.com" + path,
        data=body, method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "oasis-appverse-gate",
            **({"Content-Type": "application/json"} if body is not None else {}),
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        raise GateError(f"GitHub API {method} {path}: HTTP {exc.code}") from exc


def graphql(query: str, variables: dict) -> dict:
    response = api("/graphql", method="POST", data={"query": query, "variables": variables})
    if response.get("errors"):
        raise GateError("Review thread query failed; fail closed")
    return response["data"]


def paginated(path: str, key: str | None = None) -> list:
    result = []
    for page in range(1, 6):
        suffix = "&" if "?" in path else "?"
        response = api(f"{path}{suffix}per_page=100&page={page}")
        items = response.get(key, []) if key else response
        if not isinstance(items, list):
            raise GateError("Unexpected GitHub list response")
        result.extend(items)
        if len(items) < 100:
            return result
    raise GateError("GitHub pagination over 500 items; cannot attest completeness")


def current_pr(number: int) -> dict:
    return api(f"/repos/{REPO}/pulls/{number}")


def configured_ruleset() -> bool:
    """Both independent server-side rulesets must enforce their protections."""
    ruleset = api(f"/repos/{REPO}/rulesets/{RULESET_ID}")
    if ruleset.get("enforcement") != "active" or ruleset.get("bypass_actors"):
        return False
    required_status = next((x for x in ruleset.get("rules", [])
                            if x.get("type") == "required_status_checks"), None)
    if required_status is None:
        return False
    params = required_status.get("parameters") or {}
    # Pin to the GitHub Actions app (Core ruleset uses integration 15368).
    exact_gate_source = any(
        x.get("context") == CHECK_NAME and x.get("integration_id") == 15368
        for x in params.get("required_status_checks", [])
    )
    if not exact_gate_source or not params.get("strict_required_status_checks_policy"):
        return False

    governance = api(f"/repos/{REPO}/rulesets/19820724")
    if governance.get("enforcement") != "active" or governance.get("bypass_actors"):
        return False
    pr_rule = next((x for x in governance.get("rules", [])
                    if x.get("type") == "pull_request"), None)
    if pr_rule is None:
        return False
    review = pr_rule.get("parameters") or {}
    return (int(review.get("required_approving_review_count") or 0) >= 1
            and bool(review.get("require_code_owner_review"))
            and bool(review.get("dismiss_stale_reviews_on_push"))
            and bool(review.get("required_review_thread_resolution")))


def latest_checks(sha: str) -> dict:
    checks = paginated(f"/repos/{REPO}/commits/{sha}/check-runs", key="check_runs")
    selected = {}
    for item in checks:
        key = (item.get("name"), (item.get("app") or {}).get("slug"))
        rank = (item.get("started_at") or item.get("created_at") or "", int(item.get("id") or 0))
        if key not in selected or rank > selected[key][0]:
            selected[key] = (rank, item)
    return {key: value[1] for key, value in selected.items()}


def latest_statuses(sha: str) -> dict:
    statuses = paginated(f"/repos/{REPO}/commits/{sha}/statuses")
    newest = {}
    for status in statuses:
        newest.setdefault(status.get("context"), status)
    return newest


def unresolved_threads(number: int) -> int:
    query = """query($owner:String!,$repo:String!,$number:Int!) {
      repository(owner:$owner,name:$repo) {pullRequest(number:$number) {
        reviewThreads(first:100) {nodes {isResolved} pageInfo {hasNextPage}}
      }} }"""
    args = {"owner": REPO.split("/")[0], "repo": REPO.split("/")[1], "number": number}
    result = graphql(query, args)["repository"]["pullRequest"]["reviewThreads"]
    if result["pageInfo"]["hasNextPage"]:
        raise GateError("Review threads exceed one page; fail closed")
    return sum(not thread["isResolved"] for thread in result["nodes"])


def trusted_review_decisions(number: int, author: str) -> tuple[dict, set]:
    """Only verified agent or actual repository code-owner actors count."""
    if not author:
        raise GateError("Cannot verify reviewer independence: PR author missing")
    latest = {}
    human = set()
    for review in paginated(f"/repos/{REPO}/pulls/{number}/reviews"):
        user = (review.get("user") or {}).get("login", "")
        if not user or user == author:
            continue
        association = review.get("author_association", "")
        trusted_human = (user in TRUSTED_HUMANS
                         and association in {"OWNER", "MEMBER", "COLLABORATOR"})
        trusted_bot = user in TRUSTED_BOT_APPROVERS
        if not trusted_human and not trusted_bot:
            continue
        if trusted_human:
            human.add(user)
        if review.get("state") in {"APPROVED", "CHANGES_REQUESTED", "DISMISSED"}:
            latest[user] = review
    return latest, human


def review_approval(number: int, sha: str, author: str, require_human: bool = False) -> bool:
    latest, humans = trusted_review_decisions(number, author)
    if any(review.get("state") == "CHANGES_REQUESTED" for review in latest.values()):
        return False
    return any(
        review.get("state") == "APPROVED" and review.get("commit_id") == sha
        and (not require_human or username in humans)
        for username, review in latest.items()
    )


def validate(pr: dict) -> list[str]:
    errors = []
    number, sha = pr["number"], pr["head"]["sha"]
    if not configured_ruleset():
        errors.append("BLOCKED_MISSING_REQUIRED_CI_RULESET: Central #19200597 must strictly require Appverse Merge Gate")
    if pr.get("state") != "open" or pr.get("draft"):
        errors.append("PR is closed or draft")
    if pr.get("base", {}).get("ref") != "main":
        errors.append("Only direct-to-main PRs eligible; stacked PRs blocked")
    if number == 651 or "not for merge" in (pr.get("title") or "").lower():
        errors.append("Evidence-only #651/candidate is excluded")
    if LABEL not in {label.get("name") for label in pr.get("labels", [])}:
        errors.append("PR is not opted in with appverse-gated label")
    if pr.get("mergeable") is not True or pr.get("mergeable_state") in {"dirty", "unknown", "draft"}:
        errors.append("Mergeability not established")

    changed = paginated(f"/repos/{REPO}/pulls/{number}/files")
    filenames = {item.get("filename") for item in changed}
    if any(name in filenames for name in
           (GATE_FILE, GATE_SCRIPT, ".github/workflows/appverse-merge-gate-ci.yml")):
        errors.append("Changes to gate authority require separate manual review")
    if any((name or "").startswith("supabase/migrations/") for name in filenames):
        errors.append("Core-owned migrations cannot be introduced by Central")

    checks = latest_checks(sha)
    for name, app in REQUIRED_CHECKS.items():
        check = checks.get((name, app))
        if not check or check.get("status") != "completed" or check.get("conclusion") != "success":
            state = "missing" if not check else f"{check.get('status')}/{check.get('conclusion')}"
            errors.append(f"Required check {name} ({app}) not PASS: {state}")
    statuses = latest_statuses(sha)
    for context, expected in REQUIRED_STATUSES.items():
        if (statuses.get(context) or {}).get("state") != expected:
            errors.append(f"Required external status {context} not PASS")
    if unresolved_threads(number):
        errors.append("Unresolved review threads")
    if not review_approval(number, sha, (pr.get("user") or {}).get("login", "")):
        errors.append("No independent current-head APPROVED review, or changes requested")
    latest = current_pr(number)
    if latest["head"]["sha"] != sha or latest["base"]["sha"] != pr["base"]["sha"]:
        errors.append("HEAD_OR_BASE_CHANGED_DURING_VERIFICATION")
    return errors


def update_gate_check(number: int) -> None:
    pr = current_pr(number)
    if LABEL not in {label.get("name") for label in pr.get("labels", [])}:
        return
    head = pr["head"]["sha"]
    try:
        errors = validate(pr)
    except Exception as exc:
        errors = [f"BLOCKED_GATE_VERIFICATION: {type(exc).__name__}: {exc}"]
    verdict = "failure" if errors else "success"
    summary = (f"PR #{number}; exact head {head}; {verdict.upper()}.\n"
               + ("\n".join("- " + error for error in errors[:35]) if errors
                  else "All required exact-head checks and reviews PASS; GitHub rules remain authoritative."))[:5000]
    previous = latest_checks(head).get((CHECK_NAME, "github-actions"))
    if (previous and previous.get("status") == "completed"
        and previous.get("conclusion") == verdict
        and ((previous.get("output") or {}).get("summary") or "") == summary):
        print(f"#{number}: unchanged {verdict}")
        return
    api(f"/repos/{REPO}/check-runs", method="POST", data={
        "name": CHECK_NAME, "head_sha": head, "status": "completed",
        "conclusion": verdict, "external_id": f"appverse-pr-{number}-{head}",
        "details_url": f"https://github.com/{REPO}/pull/{number}",
        "output": {"title": "Appverse merge eligible" if not errors else "Appverse merge blocked",
                   "summary": summary},
    })
    print(f"#{number}: {verdict}; " + "; ".join(errors[:5]))


def main() -> None:
    if os.environ.get("GITHUB_REPOSITORY") != REPO:
        raise SystemExit("Incorrect repository; fail closed")
    # GitHub Actions supplies the trusted numeric PR identifier directly;
    # never read a filesystem path supplied through the environment.
    pr_number = os.environ.get("APPVERSE_PR_NUMBER", "").strip()
    if pr_number:
        if not pr_number.isascii() or not pr_number.isdecimal():
            raise SystemExit("Invalid PR number; fail closed")
        update_gate_check(int(pr_number))
        return
    for pr in paginated(f"/repos/{REPO}/pulls?state=open"):
        if LABEL in {label.get("name") for label in pr.get("labels", [])}:
            update_gate_check(int(pr["number"]))


if __name__ == "__main__":
    main()
