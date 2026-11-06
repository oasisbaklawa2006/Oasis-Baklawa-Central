#!/usr/bin/env python3
"""Trusted-main Appverse PR merge gate.

Evaluates merge *eligibility* and publishes one fail-closed check-run on the exact PR head. It is NOT a merge
actuator: it never executes PR branch code, never merges, never enables auto-merge and never changes rulesets.
That is enforced structurally by the request allow-list in ``api`` (see ``ALLOWED_POST_PATHS``).
"""
from __future__ import annotations

import http.client
import json
import os
import re
import time

REPO = "oasisbaklawa2006/Oasis-Baklawa-Central"
RULESET_ID = 19200597
GOVERNANCE_RULESET_ID = 19820724
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
API_HOST = "api.github.com"
# The controller may only (a) read, (b) publish its own check-run and (c) run read-only GraphQL queries.
ALLOWED_POST_PATHS = {"/graphql", f"/repos/{REPO}/check-runs"}

# ---- Sensitive-path classifier -------------------------------------------------------------------------------
# A PR touching any of these may NEVER be satisfied by a bot/AI approval alone: an independent trusted human
# code-owner approval on the exact head is mandatory. The list is deliberately conservative (over-matching only
# costs a human review; under-matching would let a bot approve Finance/auth/Gate changes).
SENSITIVE_PREFIXES = (
    ".github/", ".appverse/", "supabase/",
    "scripts/appverse-control/", "tests/appverse-control/", "docs/appverse-control/",
    # CI evidence producers: changing them can make a green check meaningless.
    "scripts/point100-certification/", "scripts/factory-certification/", "scripts/buyer-certification/",
    "scripts/integration-certification/", "tests/point100/", "tests/factory-certification/",
    "tests/buyer-certification/", "src/lib/point100/",
    # Finance / payments / order authority, auth and roles, dispatch and Gate authority, stock authority.
    "src/lib/finance", "src/lib/order-authority/", "src/lib/execution-authority/", "src/lib/stock-authority/",
    "src/lib/inventory-authority/", "src/lib/dispatch", "src/lib/macro-order-dispatch/", "src/lib/auth/",
    "src/lib/roleNormalization", "src/lib/point79Wallet",
)
SENSITIVE_FILES = {
    "package.json", "package-lock.json", "bun.lock", "bun.lockb", "deno.lock", "vercel.json",
    "SECURITY.md", "AGENTS.md", "CLAUDE.md", "APPVERSE_MISSION_CONTROL.md", "APPVERSE_THREAD_GUARDRAIL.md",
    "BACKEND_OWNERSHIP.md",
}
# Substrings (finance/payment vocabulary and other unambiguous security terms).
SENSITIVE_SUBSTRINGS = (
    "finance", "payment", "invoice", "proforma", "settlement", "wallet", "refund", "ledger", "reversal",
    "rbac", "permission", "password", "secret", "credential", "authority", "dispatch", "deploy", "migration",
)
# Whole camelCase/kebab/snake tokens (avoids "navigate"/"aggregate" matching "gate", "author" matching "auth").
SENSITIVE_TOKENS = {
    "auth", "authn", "authz", "authentication", "authorization", "authorize", "login", "logout", "mfa", "rls",
    "gate", "token", "tokens", "session", "jwt", "oauth", "role", "roles", "security", "secrets", "env",
}

# ---- CI lane triggers, mirrored from the workflows' own ``on.pull_request.paths`` ----------------------------
# A lane is required only when the real workflow would run for the changed files; requiring a lane that cannot
# trigger would deadlock the PR. tests/appverse-control/test_workflow_policy.py asserts these stay in sync.
LANE_TRIGGERS = {
    "Disposable Buyer golden path certification": (
        ".github/workflows/buyer-golden-path-certification.yml", "playwright.buyer-cert.config.ts",
        "scripts/buyer-certification/**", "tests/app-e2e-buyer-golden-path.cert.spec.ts",
        "tests/buyer-certification/**", "src/pages/customer/BuyerApp.tsx", "src/lib/customerApp/**",
        "APP_E2E_FRONT_BUYER_COMPLETION_LEDGER.md", "docs/APP_E2E_BUYER_SYNTHETIC_FIXTURE.md",
    ),
    "Disposable Factory certification": (
        ".github/workflows/factory-certification-ephemeral.yml", "playwright.factory-cert.config.ts",
        "scripts/factory-certification/**", "src/lib/factoryCertification*.ts", "src/lib/factoryOperations*.ts",
        "src/lib/__tests__/factoryCertification*.test.ts", "src/lib/__tests__/factoryOperations*.test.ts",
        "tests/factory-operations-*.cert.spec.ts", "tests/factory-certification/**",
    ),
    "Point100 production-bound software rehearsal": (
        ".github/workflows/point100-certification-ephemeral.yml", "playwright.point100.config.ts",
        "scripts/point100-certification/**", "src/lib/point100/**", "tests/point100/**",
        ".appverse/MACRO_POINT100_INTEGRATION_MISSION.md",
    ),
}
BAD_CONCLUSIONS = {"failure", "cancelled", "timed_out", "action_required", "startup_failure", "stale"}


class GateError(Exception):
    """Unknown, missing or inconsistent evidence never satisfies merge requirements."""


def api(path: str, *, method: str = "GET", data: dict | None = None) -> dict | list:
    """Single choke point for GitHub I/O: fixed HTTPS host, bounded retries on GET, allow-listed writes."""
    if not path.startswith("/") or any(ch in path for ch in "\r\n "):
        raise GateError("Invalid GitHub API path; fail closed")
    if method not in {"GET", "POST"}:
        raise GateError(f"HTTP method {method} is not permitted for the controller")
    if method == "POST" and path not in ALLOWED_POST_PATHS:
        raise GateError(f"POST {path} is not permitted: the controller may only publish its check-run")
    token = os.environ["GH_TOKEN"]
    body = None if data is None else json.dumps(data).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "oasis-appverse-gate",
        **({"Content-Type": "application/json"} if body is not None else {}),
    }
    attempts = 3 if method == "GET" else 1  # POST is never blindly retried
    for attempt in range(attempts):
        connection = http.client.HTTPSConnection(API_HOST, timeout=25)
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            payload = response.read()
            if response.status in {429, 500, 502, 503, 504} and attempt + 1 < attempts:
                time.sleep(2 ** attempt)
                continue
            if response.status >= 400:
                raise GateError(f"GitHub API {method} {path}: HTTP {response.status}")
            return json.loads(payload) if payload else {}
        except (OSError, http.client.HTTPException, ValueError) as exc:
            if attempt + 1 < attempts:
                time.sleep(2 ** attempt)
                continue
            raise GateError(f"GitHub API {method} {path}: {type(exc).__name__}") from exc
        finally:
            connection.close()
    raise GateError(f"GitHub API {method} {path}: retries exhausted")


def graphql(query: str, variables: dict) -> dict:
    if re.search(r"\bmutation\b", query, re.IGNORECASE):
        raise GateError("GraphQL mutations are not permitted for the controller")
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


def _main_ruleset_problems(label: str, ruleset: dict) -> list[str]:
    """Common server-side enforcement preconditions for a ruleset that must protect main."""
    problems = []
    if ruleset.get("enforcement") != "active":
        problems.append(f"{label}: enforcement is not active")
    bypass = ruleset.get("bypass_actors")
    if not isinstance(bypass, list):
        # Absent means the controller token cannot see it. Absence must never be read as "no bypass actors".
        problems.append(f"{label}: bypass_actors not visible to the controller token; cannot attest no-bypass")
    elif bypass:
        problems.append(f"{label}: bypass actors are configured")
    if ruleset.get("target") != "branch":
        problems.append(f"{label}: target is not branch")
    targets = (ruleset.get("conditions") or {}).get("ref_name") or {}
    if not {"refs/heads/main", "~DEFAULT_BRANCH"}.intersection(targets.get("include") or []):
        problems.append(f"{label}: does not target main")
    return problems


def ruleset_problems() -> list[str]:
    """Both independent server-side rulesets must enforce their protections; returns the reasons they do not."""
    problems = []
    ruleset = api(f"/repos/{REPO}/rulesets/{RULESET_ID}")
    problems += _main_ruleset_problems(f"CI ruleset {RULESET_ID}", ruleset)
    required_status = next((x for x in ruleset.get("rules", [])
                            if x.get("type") == "required_status_checks"), None)
    params = (required_status or {}).get("parameters") or {}
    # Pin to the GitHub Actions app: a name alone could be satisfied by any other app or a user-posted status.
    exact_gate_source = any(
        x.get("context") == CHECK_NAME and x.get("integration_id") == GITHUB_ACTIONS_APP_ID
        for x in params.get("required_status_checks", [])
    )
    if not exact_gate_source:
        problems.append(f"CI ruleset {RULESET_ID}: '{CHECK_NAME}' is not required from the GitHub Actions app")
    if not params.get("strict_required_status_checks_policy"):
        problems.append(f"CI ruleset {RULESET_ID}: strict (up-to-date) policy is not enabled")

    governance = api(f"/repos/{REPO}/rulesets/{GOVERNANCE_RULESET_ID}")
    problems += _main_ruleset_problems(f"governance ruleset {GOVERNANCE_RULESET_ID}", governance)
    pr_rule = next((x for x in governance.get("rules", []) if x.get("type") == "pull_request"), None)
    review = (pr_rule or {}).get("parameters") or {}
    for label, ok in (
        ("a required approving review", int(review.get("required_approving_review_count") or 0) >= 1),
        ("code-owner review", bool(review.get("require_code_owner_review"))),
        ("dismissal of stale reviews on push", bool(review.get("dismiss_stale_reviews_on_push"))),
        ("review-thread resolution", bool(review.get("required_review_thread_resolution"))),
    ):
        if not ok:
            problems.append(f"governance ruleset {GOVERNANCE_RULESET_ID}: {label} is not enforced")
    return problems


def configured_ruleset() -> bool:
    return not ruleset_problems()


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
    # Never rely on API list order: pick the newest by (updated_at, id) per context so a stale success cannot win.
    for status in sorted(statuses, key=lambda x: (x.get("updated_at") or x.get("created_at") or "",
                                                  int(x.get("id") or 0)), reverse=True):
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


def _glob_regex(pattern: str) -> re.Pattern:
    """GitHub path-filter semantics: ``*`` stays inside a segment, ``**`` crosses ``/``."""
    out, i = [], 0
    while i < len(pattern):
        if pattern.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif pattern.startswith("**", i):
            out.append(".*")
            i += 2
        elif pattern[i] == "*":
            out.append("[^/]*")
            i += 1
        elif pattern[i] == "?":
            out.append("[^/]")
            i += 1
        else:
            out.append(re.escape(pattern[i]))
            i += 1
    return re.compile("".join(out) + r"\Z")


def path_matches(pattern: str, path: str) -> bool:
    return bool(_glob_regex(pattern).match(path))


def relevant_checks(paths: set[str]) -> dict[str, str]:
    """Required evidence for the changed-file scope, derived from what the real workflows would actually run."""
    required = dict(REQUIRED_CHECKS)
    if any(path.startswith(".github/workflows/") for path in paths):
        required["Analyze (actions)"] = "github-actions"
    if any(path.endswith(".py") for path in paths):
        required["Analyze (python)"] = "github-actions"
    if any(path.endswith((".js", ".mjs", ".jsx", ".ts", ".tsx")) for path in paths):
        required["Analyze (javascript-typescript)"] = "github-actions"
    for lane, patterns in LANE_TRIGGERS.items():
        if any(path_matches(pattern, path) for pattern in patterns for path in paths):
            required[lane] = "github-actions"
    return required


def sensitive_paths(paths: set[str]) -> list[str]:
    """Changed paths whose approval can never come from a bot/AI alone (sorted, deterministic)."""
    hits = []
    for path in sorted(paths):
        lowered = path.lower()
        tokens = {t.lower() for t in re.findall(r"[A-Z]?[a-z]+|[A-Z]+(?![a-z])|\d+", path)}
        if (path in SENSITIVE_FILES or path in GOVERNANCE_FILES
                or path.startswith(SENSITIVE_PREFIXES)
                or any(word in lowered for word in SENSITIVE_SUBSTRINGS)
                or tokens & SENSITIVE_TOKENS):
            hits.append(path)
    return hits


def unexpected_check_state(checks: dict, required: dict[str, str]) -> list[str]:
    """Any other check on the head that is failing or still running also blocks: a lane the gate did not list
    (or a path-filter drift) must never be able to fail silently. Skipped/neutral extras and advisory jobs are fine."""
    problems = []
    for (name, slug), item in sorted(checks.items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1]))):
        if name == CHECK_NAME or "(advisory)" in (name or "") or required.get(name) == slug:
            continue
        if item.get("status") != "completed":
            problems.append(f"Additional check {name} ({slug}) is not complete: {item.get('status')}")
        elif item.get("conclusion") in BAD_CONCLUSIONS:
            problems.append(f"Additional check {name} ({slug}) failed: {item.get('conclusion')}")
    return problems


def coderabbit_review_clean(number: int, sha: str) -> bool:
    """A passed CodeRabbit check alone does not settle substantive review notes."""
    import re
    reviews = paginated(f"/repos/{REPO}/pulls/{number}/reviews")
    current = [r for r in reviews if (r.get("user") or {}).get("login") == "coderabbitai[bot]"
               and r.get("commit_id") == sha]
    if not current:
        return False
    newest = current[-1]
    if newest.get("state") == "CHANGES_REQUESTED":
        return False
    marker = re.search(r"Actionable comments posted:\s*(\d+)", newest.get("body") or "")
    return marker is not None and int(marker.group(1)) == 0


def validate(pr: dict) -> list[str]:
    errors = []
    number, sha = pr["number"], pr["head"]["sha"]
    ruleset_issues = ruleset_problems()
    if ruleset_issues:
        errors.append("BLOCKED_RULESET: " + "; ".join(ruleset_issues[:4]))
    if pr.get("state") != "open" or pr.get("draft"):
        errors.append("PR is closed or draft")
    if pr.get("base", {}).get("ref") != "main":
        errors.append("Only direct-to-main PRs are eligible; stacked PRs stay blocked")
    if number == 651 or "not for merge" in (pr.get("title") or "").lower():
        errors.append("Evidence-only candidate excluded")
    if pr.get("mergeable") is not True or pr.get("mergeable_state") in {"dirty", "unknown", "draft"}:
        errors.append("PR mergeability is not proven clean")

    changed = paginated(f"/repos/{REPO}/pulls/{number}/files")
    filenames = {
        name for item in changed
        for name in (item.get("filename"), item.get("previous_filename")) if name
    }
    sensitive = sensitive_paths(filenames)
    if any(name.startswith("supabase/migrations/") for name in filenames):
        errors.append("Core-owned migration in Central is prohibited")

    checks = latest_checks(sha)
    required = relevant_checks(filenames)
    errors.extend(unexpected_check_state(checks, required))
    for name, slug in required.items():
        item = checks.get((name, slug))
        if not item or item.get("status") != "completed" or item.get("conclusion") != "success":
            condition = "missing" if not item else f"{item.get('status')}/{item.get('conclusion')}"
            errors.append(f"Required check {name} ({slug}) not PASS: {condition}")
    statuses = latest_statuses(sha)
    for context, (state, creator) in REQUIRED_STATUSES.items():
        item = statuses.get(context) or {}
        if item.get("state") != state or (item.get("creator") or {}).get("login") != creator:
            errors.append(f"Required external status {context} is not authenticated PASS")
    if unresolved_threads(number):
        errors.append("Unresolved independent review threads")
    author = (pr.get("user") or {}).get("login", "")
    if not review_approval(number, sha, author, require_human=bool(sensitive)):
        if sensitive:
            shown = ", ".join(sensitive[:6]) + (", ..." if len(sensitive) > 6 else "")
            errors.append(f"Sensitive paths changed ({shown}): an independent trusted human code-owner approval "
                          "on the current head is required; bot/AI approval does not count")
        else:
            errors.append("No valid current-head approval")
    if not coderabbit_review_clean(number, sha):
        errors.append("CodeRabbit has not completed a clean zero-actionable review on this head")

    now = current_pr(number)
    if now["head"]["sha"] != sha or now["base"]["sha"] != pr["base"]["sha"]:
        errors.append("HEAD_OR_BASE_CHANGED_DURING_VERIFICATION")
    return errors


def update_gate_check(number: int) -> None:
    pr = current_pr(number)
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
    # A globally mandatory check must be published for every main-bound PR,
    # not only PRs opted into optional native auto-merge.
    failures = []
    for pr in paginated(f"/repos/{REPO}/pulls?state=open"):
        if pr.get("base", {}).get("ref") != "main":
            continue
        try:
            update_gate_check(int(pr["number"]))
        except Exception as exc:
            failures.append(f"#{pr['number']}: {type(exc).__name__}: {exc}")
    if failures:
        raise SystemExit("Gate publication failed: " + "; ".join(failures))


if __name__ == "__main__":
    main()
