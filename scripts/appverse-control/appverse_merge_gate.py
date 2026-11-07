#!/usr/bin/env python3
"""Trusted-main Appverse PR merge gate.

Evaluates merge *eligibility* and publishes fail-closed check-runs on the exact PR head. It is NOT a merge
actuator: it never executes PR branch code, never merges, never enables auto-merge and never changes rulesets.
That is enforced structurally by the request allow-list in ``api`` (see ``ALLOWED_POST_PATHS``).

Two publication identities, never mixed (``APPVERSE_PUBLISH_MODE``):

* ``advisory``      - runs with the shared GitHub Actions token and publishes ONLY ``Appverse Merge Gate (advisory)``.
                      Every workflow in the repository shares that identity, so it can never be authoritative.
* ``authoritative`` - publishes ``Appverse Merge Gate`` ONLY with an installation token of the dedicated GitHub App
                      (``GATE_APP_ID``) and ONLY when the secret-bearing environment is verifiably restricted to main.

The ruleset must pin ``Appverse Merge Gate`` to ``GATE_APP_ID``; a same-named check from any other app is a
spoof attempt and is reported as one.
"""
from __future__ import annotations

import datetime
import http.client
import json
import os
import re
import sys
import time

REPO = "oasisbaklawa2006/Oasis-Baklawa-Central"
RULESET_ID = 19200597
GOVERNANCE_RULESET_ID = 19820724
LABEL = "appverse-gated"  # Controls optional auto-merge enrollment, NOT required check publication.
CHECK_NAME = "Appverse Merge Gate"
GITHUB_ACTIONS_APP_ID = 15368  # shared by every workflow: valid for CI evidence, NEVER for the gate itself
GATE_APP_ID = 5645415  # dedicated "Oasis Appverse Merge Gate" GitHub App: the only accepted publisher of CHECK_NAME
ADVISORY_CHECK_NAME = "Appverse Merge Gate (advisory)"  # shared-identity output; must never be a required check
GATE_ENVIRONMENT = "appverse-merge-gate"  # holds the App credentials; must be restricted to deployments from main
PUBLISH_MODES = {"advisory", "authoritative"}
# A required status check cannot expire on its own: if the publisher disappears, an earlier SUCCESS on the same SHA keeps
# satisfying the ruleset. The only safe consumer is therefore a merge actor that re-validates at merge time and treats
# any authoritative SUCCESS older than this as stale (see authoritative_success_problems / --evaluate).
FRESHNESS_SECONDS = 1800
CODERABBIT_LOGIN = "coderabbitai[bot]"
# CodeRabbit "Failed pre-merge checks" that the owner has explicitly reviewed and accepted. Empty = fail closed. Changing
# this set is a change to this (code-owner protected, sensitive) file and so needs independent human approval.
ACCEPTED_PREMERGE_FAILURES: frozenset = frozenset()
# Which environment variable carries each identity's credential (values are variable NAMES, never secrets).
CREDENTIAL_ENV = {"actions": "GH_TOKEN", "app": "GH_APP_TOKEN"}
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


def api(path: str, *, method: str = "GET", data: dict | None = None, identity: str = "actions") -> dict | list:
    """Single choke point for GitHub I/O: fixed HTTPS host, bounded retries on GET, allow-listed writes."""
    if not path.startswith("/") or any(ch in path for ch in "\r\n "):
        raise GateError("Invalid GitHub API path; fail closed")
    if method not in {"GET", "POST"}:
        raise GateError(f"HTTP method {method} is not permitted for the controller")
    if method == "POST" and path not in ALLOWED_POST_PATHS:
        raise GateError(f"POST {path} is not permitted: the controller may only publish its check-run")
    if identity not in CREDENTIAL_ENV:
        raise GateError("Unknown credential identity; fail closed")
    token = os.environ.get(CREDENTIAL_ENV[identity])
    if not token:
        raise GateError(f"{identity} credential is not available")
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


def ruleset_identity() -> str:
    """bypass_actors is only returned to callers with administration read. Prefer the dedicated App's least-privilege
    installation token for ruleset reads; the workflow token stays read-only and usually cannot attest bypass actors."""
    return "app" if os.environ.get(CREDENTIAL_ENV["app"]) else "actions"


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
    ruleset = api(f"/repos/{REPO}/rulesets/{RULESET_ID}", identity=ruleset_identity())
    problems += _main_ruleset_problems(f"CI ruleset {RULESET_ID}", ruleset)
    required_status = next((x for x in ruleset.get("rules", [])
                            if x.get("type") == "required_status_checks"), None)
    params = (required_status or {}).get("parameters") or {}
    # The gate must be required from the DEDICATED App. The shared Actions identity is impersonable by any workflow
    # that can request checks:write, so a pin to it (or an unpinned entry) gives no provenance at all.
    gate_entries = [x for x in params.get("required_status_checks", []) if x.get("context") == CHECK_NAME]
    if not gate_entries:
        problems.append(f"CI ruleset {RULESET_ID}: '{CHECK_NAME}' is not a required status check")
    elif any(x.get("integration_id") == GITHUB_ACTIONS_APP_ID for x in gate_entries):
        problems.append(f"CI ruleset {RULESET_ID}: '{CHECK_NAME}' is pinned to the shared GitHub Actions identity "
                        f"({GITHUB_ACTIONS_APP_ID}); any workflow can impersonate it, pin the dedicated App {GATE_APP_ID}")
    elif any(x.get("integration_id") != GATE_APP_ID for x in gate_entries):
        problems.append(f"CI ruleset {RULESET_ID}: '{CHECK_NAME}' is not pinned exclusively to the dedicated gate App {GATE_APP_ID}")
    if not params.get("strict_required_status_checks_policy"):
        problems.append(f"CI ruleset {RULESET_ID}: strict (up-to-date) policy is not enabled")

    governance = api(f"/repos/{REPO}/rulesets/{GOVERNANCE_RULESET_ID}", identity=ruleset_identity())
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


def foreign_gate_checks(checks: dict) -> list[str]:
    """Check-runs carrying the gate's authoritative name that were NOT published by the dedicated App."""
    found = []
    for (name, slug), item in checks.items():
        if name == CHECK_NAME and (item.get("app") or {}).get("id") != GATE_APP_ID:
            found.append(f"{slug or 'unknown'}")
    return sorted(set(found))


def unrecognised_gate_app_checks(checks: dict) -> list[str]:
    """Checks published by the dedicated gate App under any name other than the single authoritative one. The ruleset can
    only ever be satisfied by CHECK_NAME, so a differently named publication is a misconfiguration, not an approval."""
    return sorted({name for (name, _), item in checks.items()
                   if (item.get("app") or {}).get("id") == GATE_APP_ID and name != CHECK_NAME})


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


def parse_coderabbit_review(body: str) -> dict:
    """Structured facts from a CodeRabbit review body. CodeRabbit prints 'Actionable comments posted: N' only when N > 0
    (observed: an absent marker accompanies zero inline findings), lists 'Nitpick comments: N', and names failed
    pre-merge checks under 'Failed pre-merge checks:'."""
    raw = body or ""
    text = re.sub(r"<[^>]*>", "", raw)
    marker = re.search(r"Actionable comments posted:\s*(\d+)", text)
    nitpicks = re.search(r"Nitpick comments?:\s*(\d+)", text)
    failed: list[str] = []
    section = re.search(r"Failed pre-merge checks?:\s*\n(.*?)(?:\n\s*(?:After applying|```|Passed pre-merge)|\Z)", text, re.S)
    if section:
        failed = [m.group(1).strip() for m in re.finditer(r"^\s*-\s*(.+?):?\s*$", section.group(1), re.M)]
    return {
        "genuine": "coderabbit-ai-generated" in raw,
        "actionable": int(marker.group(1)) if marker else None,
        "nitpicks": int(nitpicks.group(1)) if nitpicks else 0,
        "failed_premerge": failed,
    }


def coderabbit_review_problems(number: int, sha: str) -> list[str]:
    """Why the CodeRabbit review on this exact head is not clean; an empty list means clean. A green standalone
    'CodeRabbit' check is never evidence: only the review of this head is."""
    reviews = paginated(f"/repos/{REPO}/pulls/{number}/reviews")
    current = [r for r in reviews if (r.get("user") or {}).get("login") == CODERABBIT_LOGIN
               and r.get("commit_id") == sha]
    if not current:
        return ["no CodeRabbit review exists for this exact head"]
    newest = current[-1]
    if newest.get("state") == "CHANGES_REQUESTED":
        return ["CodeRabbit requested changes on this head"]
    facts = parse_coderabbit_review(newest.get("body") or "")
    if not facts["genuine"]:
        return ["the CodeRabbit review body is empty or not a recognisable CodeRabbit review; cleanliness is unverifiable"]
    problems = []
    if facts["actionable"] is None:
        # No marker: corroborate with the inline comments that belong to this very review.
        inline = [c for c in paginated(f"/repos/{REPO}/pulls/{number}/comments")
                  if (c.get("user") or {}).get("login") == CODERABBIT_LOGIN
                  and c.get("pull_request_review_id") == newest.get("id") and c.get("in_reply_to_id") is None]
        if inline:
            problems.append(f"{len(inline)} inline finding(s) belong to this review but it carries no actionable-count marker")
    elif facts["actionable"] > 0:
        problems.append(f"{facts['actionable']} actionable finding(s) reported on this head")
    unaccepted = [name for name in facts["failed_premerge"] if name not in ACCEPTED_PREMERGE_FAILURES]
    if unaccepted:
        problems.append("failed pre-merge check(s): " + ", ".join(unaccepted))
    return problems


def coderabbit_review_clean(number: int, sha: str) -> bool:
    return not coderabbit_review_problems(number, sha)


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
    for source in foreign_gate_checks(checks):
        errors.append(f"SPOOF_ATTEMPT: a check named '{CHECK_NAME}' was published by '{source}', not by the dedicated "
                      f"gate App {GATE_APP_ID}; it carries no authority")
    for name in unrecognised_gate_app_checks(checks):
        errors.append(f"NAME_MISMATCH: the dedicated gate App {GATE_APP_ID} published '{name}', but the single authoritative "
                      f"name is '{CHECK_NAME}'; the ruleset is never satisfied until the publisher uses that exact name")
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
    errors.extend(f"CodeRabbit review not clean: {problem}" for problem in coderabbit_review_problems(number, sha))

    now = current_pr(number)
    if now["head"]["sha"] != sha or now["base"]["sha"] != pr["base"]["sha"]:
        errors.append("HEAD_OR_BASE_CHANGED_DURING_VERIFICATION")
    return errors


def publisher_problems() -> list[str]:
    """Authoritative publication is allowed only when the credential could not have been read by a branch workflow."""
    if not os.environ.get(CREDENTIAL_ENV["app"]):
        return ["dedicated App installation token not provided"]
    problems = []
    try:
        environment = api(f"/repos/{REPO}/environments/{GATE_ENVIRONMENT}", identity="app")
        policy = environment.get("deployment_branch_policy") or {}
        if not policy.get("custom_branch_policies"):
            problems.append(f"environment {GATE_ENVIRONMENT}: deployment branches are not restricted to selected branches")
        else:
            listing = api(f"/repos/{REPO}/environments/{GATE_ENVIRONMENT}/deployment-branch-policies", identity="app")
            names = {entry.get("name") for entry in listing.get("branch_policies", [])}
            if names != {"main"}:
                problems.append(f"environment {GATE_ENVIRONMENT}: allowed branches are {sorted(map(str, names))}, expected exactly ['main']")
    except GateError as exc:
        problems.append(f"environment {GATE_ENVIRONMENT} policy could not be verified: {exc}")
    return problems


def verdict_and_summary(number: int, head: str, errors: list[str]) -> tuple[str, str]:
    """Verdict plus the stable (timestamp-free) summary body; the evaluation stamp is appended separately."""
    verdict = "failure" if errors else "success"
    summary = (f"PR #{number}; exact head {head}; {verdict.upper()}.\n"
               + ("\n".join("- " + error for error in errors[:35]) if errors
                  else "All required exact-head checks and reviews PASS; GitHub rules remain authoritative."))[:4500]
    return verdict, summary


def utc_now() -> datetime.datetime:
    return datetime.datetime.now(datetime.timezone.utc)


def parse_time(value: str | None) -> datetime.datetime | None:
    try:
        return datetime.datetime.fromisoformat((value or "").replace("Z", "+00:00"))
    except ValueError:
        return None


def stamped(summary: str, now: datetime.datetime) -> str:
    return (f"{summary}\n\nEvaluated at {now.strftime('%Y-%m-%dT%H:%M:%SZ')}. Treat this result as stale after "
            f"{FRESHNESS_SECONDS}s. Eligibility evidence only: native auto-merge stays disabled and a merge actor must "
            "re-validate at merge time (see policy).")


def authoritative_success_problems(check: dict, head: str, now: datetime.datetime | None = None) -> list[str]:
    """For the MERGE ACTOR: why this check-run may not be trusted to authorise merging `head` right now. A required
    check cannot expire by itself, so freshness has to be judged by whoever merges. Empty list = acceptable evidence,
    which is still not sufficient on its own: the actor must also call evaluate() and pin the merge to `head`."""
    problems = []
    now = now or utc_now()
    if check.get("name") != CHECK_NAME:
        problems.append("not the authoritative check name")
    if (check.get("app") or {}).get("id") != GATE_APP_ID:
        problems.append(f"not published by the dedicated gate App {GATE_APP_ID}")
    if check.get("status") != "completed" or check.get("conclusion") != "success":
        problems.append(f"not a completed success: {check.get('status')}/{check.get('conclusion')}")
    if check.get("head_sha") != head or not str(check.get("external_id") or "").endswith(f"-{head}"):
        problems.append("not bound to this exact head SHA")
    completed = parse_time(check.get("completed_at"))
    if completed is None:
        problems.append("no valid completion time")
    elif (now - completed).total_seconds() > FRESHNESS_SECONDS:
        problems.append(f"stale: older than {FRESHNESS_SECONDS}s")
    elif (completed - now).total_seconds() > 60:
        problems.append("completion time is in the future")
    return problems


def evaluate(number: int, expect_sha: str | None = None) -> dict:
    """Read-only live evaluation for the merge actor. Publishes nothing (it cannot: it never issues a POST)."""
    head = None
    try:
        pr = current_pr(number)
        head = pr["head"]["sha"]
        if expect_sha and head != expect_sha:
            errors = [f"HEAD_MISMATCH: expected {expect_sha}, live head is {head}"]
        else:
            errors = validate(pr)
    except Exception as exc:  # every failure, including the first PR read, is an ineligible verdict
        errors = [f"BLOCKED_GATE_VERIFICATION: {type(exc).__name__}: {exc}"]
    return {"pr": number, "head": head, "eligible": not errors, "errors": errors,
            "evaluated_at": utc_now().strftime("%Y-%m-%dT%H:%M:%SZ"),
            "native_automerge": "DISABLED: a required check cannot guarantee freshness if its publisher is unavailable"}


def authoritative_checks_on(head: str) -> list[dict]:
    return sorted((item for (name, _), item in latest_checks(head).items()
                   if name == CHECK_NAME and (item.get("app") or {}).get("id") == GATE_APP_ID),
                  key=lambda item: int(item.get("id") or 0))


def update_gate_check(number: int, mode: str = "advisory") -> None:
    if mode not in PUBLISH_MODES:
        raise GateError(f"Unknown publish mode {mode!r}")
    pr = current_pr(number)
    head = pr["head"]["sha"]
    try:
        errors = validate(pr)
    except Exception as exc:
        errors = [f"BLOCKED_GATE_VERIFICATION: {type(exc).__name__}: {exc}"]
    verdict, body = verdict_and_summary(number, head, errors)
    if mode == "authoritative":
        name, identity = CHECK_NAME, "app"
        problems = publisher_problems()
        if problems:
            # A required check cannot be revoked by anyone but its publisher, so an earlier SUCCESS on this head would stay
            # in force. Nothing can be published here; fail LOUDLY (red job) and say exactly which consequence applies.
            try:
                prior_success = any(c.get("conclusion") == "success" for c in authoritative_checks_on(head))
            except (GateError, KeyError, ValueError):
                prior_success = None
            consequence = {True: "a PRIOR authoritative SUCCESS exists on this head and is now STALE: it must not authorise a merge",
                           False: "no authoritative success exists on this head",
                           None: "whether an authoritative SUCCESS exists on this head could not be determined: assume it is STALE"}[prior_success]
            raise GateError(f"AUTHORITATIVE_PUBLICATION_WITHHELD for #{number}: " + "; ".join(problems) + f". {consequence}.")
    else:
        name, identity = ADVISORY_CHECK_NAME, "actions"
    now = utc_now()
    previous = None
    try:
        publisher_id = GITHUB_ACTIONS_APP_ID if mode == "advisory" else GATE_APP_ID
        previous = next((item for (n, _), item in latest_checks(head).items()
                         if n == name and (item.get("app") or {}).get("id") == publisher_id), None)
    except (GateError, KeyError, ValueError):
        previous = None  # an optimisation lookup must NEVER suppress publication of the current verdict
    if previous and previous.get("status") == "completed" and previous.get("conclusion") == verdict:
        completed = parse_time(previous.get("completed_at"))
        age = (now - completed).total_seconds() if completed else None
        if (((previous.get("output") or {}).get("summary") or "").startswith(body)
                and age is not None and 0 <= age < FRESHNESS_SECONDS / 2):
            print(f"#{number}: unchanged {verdict} ({mode})")
            return
    posted = api(f"/repos/{REPO}/check-runs", method="POST", identity=identity, data={
        "name": name, "head_sha": head, "status": "completed",
        "conclusion": verdict, "external_id": f"appverse-pr-{number}-{head}",
        "details_url": f"https://github.com/{REPO}/pull/{number}",
        "output": {"title": ("Appverse merge eligible" if not errors else "Appverse merge blocked")
                   + (" (advisory, not authoritative)" if mode == "advisory" else ""),
                   "summary": stamped(body, now)},
    })
    if mode == "authoritative":
        if (posted.get("app") or {}).get("id") != GATE_APP_ID:
            raise GateError(f"authoritative check was published by app {(posted.get('app') or {}).get('id')}, "
                            f"expected {GATE_APP_ID}; the ruleset will ignore it")
        # Read back: the verdict we just published must now be the newest authoritative check on this head. If GitHub does
        # not show that, the previous result may still be what the ruleset sees, which must not go unnoticed.
        newest = authoritative_checks_on(head)
        if not newest or int(newest[-1].get("id") or 0) != int(posted.get("id") or -1):
            raise GateError(f"SUPERSESSION_NOT_CONFIRMED for #{number}: the newly published {verdict} is not the newest "
                            "authoritative check on this head; an earlier result may still be in force")
    print(f"#{number}: {verdict} ({mode}); " + "; ".join(errors[:5]))


def run_evaluate(argv: list[str]) -> int:
    """`--evaluate N [--expect-sha SHA]`: print JSON, exit 0 eligible, 3 ineligible, 2 usage error. Read-only."""
    try:
        position = argv.index("--evaluate")
        number = argv[position + 1]
    except (ValueError, IndexError):
        print("usage: --evaluate PR_NUMBER [--expect-sha SHA]", file=sys.stderr)
        return 2
    expect = None
    if "--expect-sha" in argv:
        expect = argv[argv.index("--expect-sha") + 1] if argv.index("--expect-sha") + 1 < len(argv) else ""
        if not re.fullmatch(r"[0-9a-f]{40}", expect):
            print("invalid --expect-sha", file=sys.stderr)
            return 2
    if not (number.isascii() and number.isdecimal()):
        print("invalid PR number", file=sys.stderr)
        return 2
    try:
        result = evaluate(int(number), expect)
    except Exception as exc:  # the contract is JSON plus exit 3, whatever goes wrong
        result = {"pr": int(number), "head": None, "eligible": False,
                  "errors": [f"BLOCKED_GATE_VERIFICATION: {type(exc).__name__}: {exc}"]}
    print(json.dumps(result, indent=2))
    return 0 if result["eligible"] else 3


def main(argv: list[str] | None = None) -> None:
    argv = sys.argv[1:] if argv is None else argv
    if os.environ.get("GITHUB_REPOSITORY") != REPO:
        raise SystemExit("Incorrect repository; fail closed")
    if "--evaluate" in argv:
        raise SystemExit(run_evaluate(argv))
    mode = os.environ.get("APPVERSE_PUBLISH_MODE", "advisory").strip()
    if mode not in PUBLISH_MODES:
        raise SystemExit("Invalid publish mode; fail closed")
    if mode == "advisory" and os.environ.get(CREDENTIAL_ENV["app"]):
        # The shared-identity job must never hold the dedicated App credential.
        raise SystemExit("Advisory mode refuses to run with the dedicated App token present; fail closed")
    # GitHub Actions supplies the trusted numeric PR identifier directly;
    # never read a filesystem path supplied through the environment.
    pr_number = os.environ.get("APPVERSE_PR_NUMBER", "").strip()
    if pr_number:
        if not pr_number.isascii() or not pr_number.isdecimal():
            raise SystemExit("Invalid PR number; fail closed")
        update_gate_check(int(pr_number), mode)
        return
    # A globally mandatory check must be published for every main-bound PR,
    # not only PRs opted into optional native auto-merge.
    failures = []
    for pr in paginated(f"/repos/{REPO}/pulls?state=open"):
        if pr.get("base", {}).get("ref") != "main":
            continue
        try:
            update_gate_check(int(pr["number"]), mode)
        except Exception as exc:
            failures.append(f"#{pr['number']}: {type(exc).__name__}: {exc}")
    if failures:
        raise SystemExit("Gate publication failed: " + "; ".join(failures))


if __name__ == "__main__":
    main()
