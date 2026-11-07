"""Static policy tests for the merge-gate workflows, CODEOWNERS and CI-lane drift (no network, no YAML dependency)."""
import importlib.util
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
WORKFLOWS = ROOT / ".github" / "workflows"
SPEC = importlib.util.spec_from_file_location(
    "appverse_merge_gate", ROOT / "scripts/appverse-control/appverse_merge_gate.py"
)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)

CONTROLLER = (WORKFLOWS / "appverse-merge-gate.yml").read_text()
UNIT_CI = (WORKFLOWS / "appverse-merge-gate-ci.yml").read_text()
QUALITY = (WORKFLOWS / "quality-gate.yml").read_text()


def strip_comments(text: str) -> str:
    """Remove comment-only lines before inspecting workflow YAML."""
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


def workflow_name(text: str) -> str:
    """Extract the workflow name from its YAML text."""
    return re.search(r"^name:\s*(.+?)\s*$", text, re.M).group(1).strip("'\"")


def job_names(text: str) -> set:
    """Collect named workflow jobs from the provided YAML."""
    return {m.group(1).strip("'\"") for m in re.finditer(r"^    name:\s*(.+?)\s*$", text, re.M)}


def pull_request_paths(text: str) -> set:
    """Paths under on.pull_request.paths (two-space nesting as used by every lane workflow)."""
    lines = strip_comments(text).splitlines()
    try:
        start = next(i for i, l in enumerate(lines) if re.match(r"^  pull_request:\s*$", l))
    except StopIteration:
        return set()
    out, in_paths = set(), False
    for line in lines[start + 1:]:
        if re.match(r"^  \S", line) or re.match(r"^\S", line):
            break
        if re.match(r"^    paths:\s*$", line):
            in_paths = True
            continue
        if in_paths:
            m = re.match(r"^      - ['\"]?(.+?)['\"]?\s*$", line)
            if m:
                out.add(m.group(1))
            elif line.strip():
                break
    return out


def run_blocks(text: str) -> list:
    """Collect embedded shell run blocks for security inspection."""
    blocks, lines = [], text.splitlines()
    for i, line in enumerate(lines):
        m = re.match(r"^(\s*)(?:- )?run:\s*(.*)$", line)
        if not m:
            continue
        indent, rest = len(m.group(1)), m.group(2)
        if rest.strip() in {"|", ">", "|-", ">-"}:
            body = []
            for nxt in lines[i + 1:]:
                if nxt.strip() and len(nxt) - len(nxt.lstrip()) <= indent:
                    break
                body.append(nxt)
            blocks.append("\n".join(body))
        else:
            blocks.append(rest)
    return blocks


class ControllerWorkflowSecurityTests(unittest.TestCase):
    """Group workflow and ownership tests for controller workflow security."""
    code = strip_comments(CONTROLLER)

    def test_never_uses_privileged_pr_triggers(self):
        """Verify never uses privileged pr triggers."""
        self.assertNotIn("pull_request_target", self.code)
        self.assertIsNone(re.search(r"^  pull_request:", self.code, re.M))
        self.assertIsNone(re.search(r"^  pull_request_review", self.code, re.M))
        self.assertIsNone(re.search(r"^  issue_comment", self.code, re.M))

    def test_triggers_are_trusted_events_only(self):
        """Verify triggers are trusted events only."""
        triggers = re.search(r"^on:\n((?:  .*\n|\n)+)", self.code, re.M).group(1)
        names = set(re.findall(r"^  ([a-z_]+):", triggers, re.M))
        self.assertEqual(names, {"workflow_run", "schedule", "workflow_dispatch"})

    def test_permissions_are_minimal_and_exact(self):
        """Verify permissions are minimal and exact."""
        block = re.search(r"^permissions:\n((?:  .*\n)+)", self.code, re.M).group(1)
        granted = dict(re.findall(r"^  ([a-z-]+):\s*(\w+)\s*$", block, re.M))
        self.assertEqual(granted, {"contents": "read", "actions": "read", "pull-requests": "read",
                                   "checks": "write", "statuses": "read"})
        for forbidden in ("contents: write", "pull-requests: write", "issues: write", "id-token", "packages",
                          "deployments", "write-all"):
            self.assertNotIn(forbidden, self.code)
        # Secrets exist only in the opt-in authoritative job, and only the single App key.
        self.assertEqual(set(re.findall(r"secrets\.(\w+)", self.code)), {"APPVERSE_GATE_APP_PRIVATE_KEY"})

    def test_checks_out_trusted_main_without_persisted_credentials(self):
        """Verify checks out trusted main without persisted credentials."""
        for job_id, job in job_blocks(self.code).items():
            checkouts = [step for step in step_blocks(job) if "actions/checkout@" in step]
            self.assertEqual(len(checkouts), 1, job_id)
            for step in checkouts:
                self.assertRegex(step, r"(?m)^        uses: actions/checkout@[0-9a-f]{40}(?:[ \t]+#.*)?$", job_id)
                self.assertRegex(step, r"(?m)^          ref: main\s*$", job_id)
                self.assertRegex(step, r"(?m)^          persist-credentials: false\s*$", job_id)
        self.assertNotIn("github.head_ref", self.code)
        self.assertNotIn("github.event.pull_request", self.code)

    def test_only_runs_from_main_in_the_real_repository(self):
        """Verify only runs from main in the real repository."""
        self.assertIn("github.ref == 'refs/heads/main'", self.code)
        self.assertIn("github.repository == 'oasisbaklawa2006/Oasis-Baklawa-Central'", self.code)

    def test_no_untrusted_expression_is_interpolated_into_shell(self):
        """Verify no untrusted expression is interpolated into shell."""
        for block in run_blocks(self.code):
            for expr in re.findall(r"\$\{\{(.+?)\}\}", block):
                self.assertNotRegex(expr, r"github\.event|github\.head_ref|inputs\.", block)

    def test_actions_are_pinned_to_full_commit_shas(self):
        """Verify actions are pinned to full commit shas."""
        for text in (CONTROLLER, UNIT_CI):
            for use in re.findall(r"^\s*(?:- )?uses:\s*(\S+)", strip_comments(text), re.M):
                self.assertRegex(use, r"@[0-9a-f]{40}$", use)
            self.assertTrue(re.search(r"^\s*(?:- )?uses:", strip_comments(text), re.M))

    def test_concurrency_serialises_without_cancelling_in_flight_verdicts(self):
        """Verify concurrency serialises without cancelling in flight verdicts."""
        self.assertIn("group: appverse-trusted-merge-gate", self.code)
        self.assertIn("cancel-in-progress: false", self.code)

    def test_runner_image_is_pinned(self):
        """Verify runner image is pinned."""
        for label, text in (("controller", CONTROLLER), ("unit", UNIT_CI), ("quality", QUALITY)):
            for job_id, job in job_blocks(strip_comments(text)).items():
                images = re.findall(r"(?m)^    runs-on:\s*([^\n]+)$", job)
                self.assertEqual(images, ["ubuntu-24.04"], (label, job_id))

    def test_controller_never_executes_candidate_code_or_installs_dependencies(self):
        """Verify controller never executes candidate code or installs dependencies."""
        for block in run_blocks(self.code):
            for forbidden in ("npm ", "npx ", "pip ", "bun ", "yarn ", "curl ", "wget ", "bash -c"):
                self.assertNotIn(forbidden, block)
        self.assertIn("python3 scripts/appverse-control/appverse_merge_gate.py", self.code)

    def test_workflow_run_watches_only_existing_workflows(self):
        """Verify workflow run watches only existing workflows."""
        listed = re.search(r"workflow_run:\n\s+workflows:\n((?:\s+- .+\n)+)", self.code).group(1)
        watched = {w.strip().strip("'\"") for w in re.findall(r"- (.+)", listed)}
        existing = {workflow_name(p.read_text()) for p in WORKFLOWS.glob("*.yml")}
        self.assertTrue(watched)
        self.assertFalse(watched - existing, f"controller watches non-existent workflows: {watched - existing}")


def job_blocks(text: str) -> dict:
    """Split the workflow's jobs: {job_id: text} (two-space job ids under 'jobs:')."""
    body = text.split("\njobs:\n", 1)[1]
    parts = re.split(r"(?m)^  ([A-Za-z0-9_-]+):\s*$", body)
    return {parts[i]: parts[i + 1] for i in range(1, len(parts), 2)}



def step_blocks(job: str) -> list[str]:
    """Split a workflow job into individual named or action-based step blocks."""
    return re.split(r"(?m)^      - (?=(?:name|uses):)", job)[1:]


def workflow_hardening_problems(text: str, profile: str) -> list[str]:
    """Reject bypass-capable YAML controls outside the documented job/step allowlist."""
    app = "steps.changes.outputs.app == 'true'"
    ui = "steps.changes.outputs.ui == 'true'"
    migration = "steps.changes.outputs.migration == 'true'"
    tooling = "steps.changes.outputs.tooling == 'true'"
    tests = "steps.changes.outputs.tests == 'true'"
    all_changed = " || ".join((app, ui, migration, tooling, tests))
    build_changed = " || ".join((app, ui, tooling))
    controller_main = "github.repository == 'oasisbaklawa2006/Oasis-Baklawa-Central' && github.ref == 'refs/heads/main'"
    expected_jobs = {
        "controller": {"advisory-evaluation", "authoritative-publication"},
        "unit": {"tests"},
        "quality": {"quality-gate"},
    }
    expected_conditions = {
        "controller": {
            ("advisory-evaluation", None): controller_main,
            ("authoritative-publication", None): controller_main + " && vars.APPVERSE_GATE_PUBLISHER == 'actions-environment'",
            ("advisory-evaluation", "Publish advisory check-run (never authoritative)"): "steps.bootstrap.outputs.installed == 'true'",
        },
        "unit": {},
        "quality": {
            ("quality-gate", "Enforce canonical Supabase migration ownership"): "github.event_name == 'pull_request'",
            ("quality-gate", "Setup Node"): all_changed,
            ("quality-gate", "Install dependencies"): all_changed,
            ("quality-gate", "Typecheck"): app + " || " + tooling,
            ("quality-gate", "ESLint changed TypeScript files"): app + " || " + tooling + " || " + tests,
            ("quality-gate", "Unit and migration contract tests"): app + " || " + migration + " || " + tooling + " || " + tests,
            ("quality-gate", "APPVERSE release controller regression tests"): tooling,
            ("quality-gate", "Production build"): build_changed,
            ("quality-gate", "Install Chromium"): build_changed,
            ("quality-gate", "Start PR build locally"): build_changed,
            ("quality-gate", "Playwright PR smoke"): build_changed,
            ("quality-gate", "Docs-only fast pass"): " && ".join(
                flag.replace(" == 'true'", " != 'true'") for flag in (app, ui, migration, tooling, tests)
            ),
            ("quality-gate", "Upload Playwright report"): "$" + "{{ !cancelled() && (" + build_changed + ") }}",
        },
    }
    expected_shell = {
        "controller": {
            ("advisory-evaluation", "Confirm trusted main and main-branch installation"),
            ("authoritative-publication", "Confirm trusted main and main-branch installation"),
        },
        "unit": set(),
        "quality": {
            ("quality-gate", "Classify changed paths"),
            ("quality-gate", "Enforce canonical Supabase migration ownership"),
            ("quality-gate", "ESLint changed TypeScript files"),
            ("quality-gate", "Start PR build locally"),
        },
    }
    if profile not in expected_jobs:
        return ["unknown workflow hardening profile"]
    code = strip_comments(text)
    problems = []
    try:
        jobs = job_blocks(code)
    except (ValueError, IndexError):
        return ["jobs missing"]
    if set(jobs) != expected_jobs[profile]:
        problems.append("job set changed")
    seen_conditions = {}
    seen_shell = set()
    in_jobs, job_id, step_id = False, None, None
    lines = code.splitlines()
    for index, line in enumerate(lines):
        if line == "jobs:":
            in_jobs = True
            continue
        if in_jobs:
            job_match = re.match(r"^  ([A-Za-z0-9_-]+):\s*$", line)
            if job_match:
                job_id, step_id = job_match.group(1), None
            step_match = re.match(r"^      - (?:name|uses):\s*(.+?)\s*$", line)
            if step_match:
                step_id = step_match.group(1)
        match = re.match(r"^(\s*)(?:- )?(if|continue-on-error|shell|working-directory):\s*(.*?)\s*$", line)
        if not match:
            continue
        indent, field, value = len(match.group(1)), match.group(2), match.group(3)
        key = (job_id, step_id if indent == 8 else None)
        if field == "if":
            if not in_jobs or indent not in (4, 8):
                problems.append("unexpected if scope")
                continue
            if value in (">-", ">", "|-", "|"):
                continuation = []
                for next_line in lines[index + 1:]:
                    if not next_line.strip():
                        continue
                    if len(next_line) - len(next_line.lstrip()) <= indent:
                        break
                    continuation.append(next_line.strip())
                value = " ".join(continuation)
            if key in seen_conditions:
                problems.append(f"duplicate if: {key}")
            seen_conditions[key] = value
        elif field == "continue-on-error":
            if value != "false":
                problems.append(f"unsafe continue-on-error: {key}")
        elif field == "working-directory":
            problems.append(f"unexpected working-directory: {key}")
        elif field == "shell":
            if value != "bash" or key not in expected_shell[profile] or key in seen_shell:
                problems.append(f"unexpected shell: {key}")
            seen_shell.add(key)
    if seen_conditions != expected_conditions[profile]:
        problems.append("job or step if guards differ from reviewed baseline")
    if seen_shell != expected_shell[profile]:
        problems.append("required explicit bash shells differ from reviewed baseline")
    return problems



class TwoIdentityWorkflowTests(unittest.TestCase):
    """The shared Actions identity may only publish the advisory check; the dedicated App publishes the real one."""

    jobs = job_blocks(strip_comments(CONTROLLER))

    def test_exactly_one_advisory_and_one_authoritative_job(self):
        """Verify exactly one advisory and one authoritative job."""
        self.assertEqual(set(self.jobs), {"advisory-evaluation", "authoritative-publication"})

    def test_advisory_job_holds_no_secret_environment_or_app_credential(self):
        """Verify advisory job holds no secret environment or app credential."""
        job = self.jobs["advisory-evaluation"]
        self.assertIn("APPVERSE_PUBLISH_MODE: advisory", job)
        for forbidden in ("secrets.", "GH_APP_TOKEN", "environment:", "create-github-app-token", "APPVERSE_GATE_APP"):
            self.assertNotIn(forbidden, job, forbidden)

    def test_authoritative_job_is_opt_in_main_only_and_environment_gated(self):
        """Verify authoritative job is opt in main only and environment gated."""
        job = self.jobs["authoritative-publication"]
        self.assertIn("vars.APPVERSE_GATE_PUBLISHER == 'actions-environment'", job)
        self.assertIn("github.ref == 'refs/heads/main'", job)
        self.assertIn(f"environment: {gate.GATE_ENVIRONMENT}", job)
        self.assertIn("APPVERSE_PUBLISH_MODE: authoritative", job)

    def test_authoritative_job_workflow_token_is_read_only_and_writes_use_the_app(self):
        """Verify authoritative job workflow token is read only and writes use the app."""
        job = self.jobs["authoritative-publication"]
        perms = re.search(r"(?m)^    permissions:\n((?:      .*\n)+)", job).group(1)
        self.assertNotIn("write", perms)
        self.assertEqual(set(re.findall(r"^      ([a-z-]+):", perms, re.M)),
                         {"contents", "actions", "pull-requests", "checks", "statuses"})

    def test_installation_token_is_least_privilege_and_single_repository(self):
        """Verify installation token is least privilege and single repository."""
        job = self.jobs["authoritative-publication"]
        self.assertRegex(job, r"actions/create-github-app-token@[0-9a-f]{40}")
        granted = dict(re.findall(r"permission-([a-z-]+):\s*(\w+)", job))
        self.assertEqual(granted.get("checks"), "write")
        self.assertEqual(granted.get("administration"), "read")
        self.assertEqual({k for k, v in granted.items() if v == "write"}, {"checks"})
        self.assertIn("repositories: ${{ github.event.repository.name }}", job)

    def test_only_the_authoritative_job_may_see_the_private_key(self):
        """Verify only the authoritative job may see the private key."""
        for name, job in self.jobs.items():
            has_secret = "secrets.APPVERSE_GATE_APP_PRIVATE_KEY" in job
            self.assertEqual(has_secret, name == "authoritative-publication", name)

    def test_advisory_publication_cannot_use_the_authoritative_name(self):
        """Verify advisory publication cannot use the authoritative name."""
        self.assertNotEqual(gate.ADVISORY_CHECK_NAME, gate.CHECK_NAME)
        for name, job in self.jobs.items():
            self.assertNotIn(f"name: {gate.CHECK_NAME}\n", job)

    def test_environment_name_matches_the_script_contract(self):
        """Verify environment name matches the script contract."""
        self.assertIn(f"environment: {gate.GATE_ENVIRONMENT}", CONTROLLER)

    def test_no_workflow_requires_the_advisory_check_or_pins_the_actions_app_for_the_gate(self):
        """Verify no workflow requires the advisory check or pins the actions app for the gate."""
        for path in WORKFLOWS.glob("*.yml"):
            text = strip_comments(path.read_text())
            self.assertNotIn("integration_id: 15368", text, path.name)


class UnitTestWorkflowTests(unittest.TestCase):
    """Group workflow and ownership tests for unit test workflow."""
    code = strip_comments(UNIT_CI)

    def test_read_only_and_no_secrets(self):
        """Verify read only and no secrets."""
        self.assertIn("contents: read", self.code)
        self.assertNotIn("write", re.search(r"^permissions:\n((?:  .*\n)+)", self.code, re.M).group(1))
        self.assertNotIn("secrets.", self.code)

    def test_runs_every_policy_and_gate_test_for_the_whole_control_surface(self):
        """Verify runs every policy and gate test for the whole control surface."""
        self.assertIn("-p 'test_*.py'", self.code)
        paths = pull_request_paths(UNIT_CI)
        for needed in (".github/workflows/**", ".github/CODEOWNERS", "scripts/appverse-control/**",
                       "tests/appverse-control/**", "docs/appverse-control/**"):
            self.assertIn(needed, paths)


class QualityGateIntegrityTests(unittest.TestCase):
    """The #659 runner correction must be present and must not have weakened any test."""

    def test_runner_is_pinned_to_ubuntu_2404_for_playwright(self):
        """Verify runner is pinned to ubuntu 2404 for playwright."""
        self.assertIn("runs-on: ubuntu-24.04", QUALITY)
        self.assertIsNone(re.search(r"runs-on:\s*ubuntu-latest", QUALITY))

    def test_browser_install_and_smoke_are_still_enforced(self):
        """Verify browser install and smoke are still enforced."""
        self.assertIn("npx playwright install --with-deps chromium", QUALITY)
        self.assertIn("npx playwright test tests/visual-audit.spec.ts", QUALITY)
        for step in ("npm run typecheck", "npm run test", "npm run build"):
            self.assertIn(step, QUALITY)

    def test_no_test_step_is_neutralised(self):
        """Verify no test step is neutralised."""
        for label, text in (("controller", CONTROLLER), ("unit", UNIT_CI), ("quality", QUALITY)):
            self.assertEqual(workflow_hardening_problems(text, label), [], label)


    def test_mutated_workflow_bypass_fields_are_rejected(self):
        """Verify unexpected skip guards, ignored errors, shells and directories cannot bypass CI."""
        mutations = [
            ("unit", UNIT_CI.replace(
                "        run: python3 -m unittest discover",
                "        continue-on-error: '${{ true }}'\n        run: python3 -m unittest discover", 1)),
            ("unit", UNIT_CI.replace(
                "        run: python3 -m unittest discover",
                "        working-directory: /tmp\n        run: python3 -m unittest discover", 1)),
            ("unit", UNIT_CI.replace(
                "        run: python3 -m unittest discover",
                "        if: ${{ true }}\n        run: python3 -m unittest discover", 1)),
            ("unit", UNIT_CI.replace(
                "        run: python3 -m unittest discover",
                "        shell: sh\n        run: python3 -m unittest discover", 1)),
            ("controller", CONTROLLER.replace(
                "if: steps.bootstrap.outputs.installed == 'true'", "if: false", 1)),
            ("controller", CONTROLLER.replace("ref == 'refs/heads/main'", "ref == 'refs/heads/dev'", 1)),
            ("controller", CONTROLLER.replace("shell: bash", "shell: python", 1)),
            ("quality", QUALITY.replace(
                "if: steps.changes.outputs.tooling == 'true'\n", "if: 'true'\n", 1)),
            ("quality", QUALITY.replace("shell: bash", "shell: sh", 1)),
        ]
        for profile, mutated in mutations:
            original = {"controller": CONTROLLER, "unit": UNIT_CI, "quality": QUALITY}[profile]
            self.assertNotEqual(mutated, original, "mutation must actually change the fixture")
            self.assertTrue(workflow_hardening_problems(mutated, profile), profile)

    def test_extra_checkout_and_runner_drift_are_detected_per_job(self):
        """Verify a second checkout and a runner change cannot hide behind another safe job."""
        original = strip_comments(CONTROLLER)
        jobs = job_blocks(original)
        for job_id, job in jobs.items():
            self.assertEqual(len([step for step in step_blocks(job) if "actions/checkout@" in step]), 1, job_id)
        mutated = original.replace("    runs-on: ubuntu-24.04", "    runs-on: ubuntu-22.04", 1)
        self.assertNotEqual(mutated, original)
        image_sets = [
            re.findall(r"(?m)^    runs-on:\s*([^\n]+)$", job)
            for job in job_blocks(mutated).values()
        ]
        self.assertIn(["ubuntu-22.04"], image_sets)
        self.assertNotEqual(image_sets, [["ubuntu-24.04"]] * len(image_sets))


class CiLaneDriftTests(unittest.TestCase):
    """Gate lane triggers must mirror the real workflows, otherwise PRs deadlock or lanes are silently skipped."""

    LANE_WORKFLOWS = {
        "Disposable Buyer golden path certification": "buyer-golden-path-certification.yml",
        "Disposable Factory certification": "factory-certification-ephemeral.yml",
        "Point100 production-bound software rehearsal": "point100-certification-ephemeral.yml",
    }

    def test_lane_triggers_equal_the_workflow_path_filters(self):
        """Verify lane triggers equal the workflow path filters."""
        self.assertEqual(set(gate.LANE_TRIGGERS), set(self.LANE_WORKFLOWS))
        for lane, filename in self.LANE_WORKFLOWS.items():
            actual = pull_request_paths((WORKFLOWS / filename).read_text())
            self.assertTrue(actual, f"{filename} has no pull_request.paths")
            self.assertEqual(set(gate.LANE_TRIGGERS[lane]), actual, f"{lane} drifted from {filename}")

    def test_every_lane_job_name_exists_in_its_workflow(self):
        """Verify every lane job name exists in its workflow."""
        for lane, filename in self.LANE_WORKFLOWS.items():
            self.assertIn(lane, job_names((WORKFLOWS / filename).read_text()))

    def test_every_github_actions_required_check_is_a_real_job_name(self):
        """Verify every github actions required check is a real job name."""
        names = set()
        for path in WORKFLOWS.glob("*.yml"):
            names |= job_names(path.read_text())
        codeql = {"Analyze (actions)", "Analyze (python)", "Analyze (javascript-typescript)"}
        for name, slug in gate.REQUIRED_CHECKS.items():
            if slug == "github-actions":
                self.assertIn(name, names, f"required check '{name}' is not produced by any workflow")
        self.assertTrue(codeql)  # CodeQL default setup produces these outside the repo's workflow files


def codeowners_rules() -> list:
    """Parse configured CODEOWNERS patterns and reviewer assignments."""
    rules = []
    for line in (ROOT / ".github" / "CODEOWNERS").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            pattern, *owners = line.split()
            rules.append((pattern, owners))
    return rules


UNSUPPORTED_CODEOWNERS_SYNTAX = ("[", "]", "!", "?", "\\")


def codeowners_regex(pattern: str) -> re.Pattern:
    """Model of GitHub's documented CODEOWNERS matching (not a replacement for it; verify with a real PR):

    * a leading '/' (or a '/' inside the pattern) anchors it at the repository root; otherwise it matches at any depth;
    * a trailing '/' matches a DIRECTORY with that name and everything beneath it;
    * a final segment without wildcards names a file or directory; a directory covers everything beneath it
      (docs example: '/apps/github', '**/logs');
    * a final segment WITH a wildcard matches only entries at that level and does not descend
      (docs example: '/docs/*' matches docs/a.md but not docs/a/b.md);
    * '*' stays inside one path segment, '**' crosses directories; a trailing '/**' covers everything beneath.
    Character classes, negation, '?' and escapes are not supported by GitHub and are rejected here."""
    if any(ch in pattern for ch in UNSUPPORTED_CODEOWNERS_SYNTAX):
        raise ValueError(f"unsupported CODEOWNERS syntax in {pattern!r}")
    core = pattern.strip("/")
    anchored = pattern.startswith("/") or "/" in core
    directory_only = pattern.endswith("/")
    last = core.rsplit("/", 1)[-1]
    out, i = [], 0
    while i < len(core):
        if core.startswith("**/", i):
            out.append("(?:.*/)?")
            i += 3
        elif core.startswith("**", i):
            out.append(".*")
            i += 2
        elif core[i] == "*":
            out.append("[^/]*")
            i += 1
        else:
            out.append(re.escape(core[i]))
            i += 1
    if directory_only:
        tail = r"/.+$"
    elif core.endswith("/**") or core == "**":
        tail = r"$"
    elif "*" not in last:
        tail = r"(?:/.+)?$"
    else:
        tail = r"$"
    return re.compile(("^" if anchored else "^(?:.*/)?") + "".join(out) + tail)


def covered(pattern: str, path: str) -> bool:
    """Check whether a CODEOWNERS pattern covers a given repository path."""
    return bool(codeowners_regex(pattern).match(path))


def sensitive_files_on_disk() -> list:
    """Files under the gate's prefix/file lists, found by walking the tree (no subprocess needed)."""
    found = set()
    skip = {"__pycache__", "node_modules", ".git"}

    def add(path: pathlib.Path):
        """Add files from a source path to the sensitive-file test inventory."""
        paths = [path] if path.is_file() else [p for p in path.rglob("*") if p.is_file()]
        for p in paths:
            rel = p.relative_to(ROOT)
            if not skip.intersection(rel.parts):
                found.add(rel.as_posix())

    for prefix in gate.SENSITIVE_PREFIXES:
        if prefix.endswith("/"):
            base = ROOT / prefix.rstrip("/")
            if base.exists():
                add(base)
        else:
            parent, stem = (ROOT / prefix).parent, pathlib.PurePosixPath(prefix).name
            for entry in parent.glob(stem + "*") if parent.exists() else []:
                add(entry)
    for name in gate.SENSITIVE_FILES | gate.GOVERNANCE_FILES:
        if (ROOT / name).is_file():
            found.add(name)
    return sorted(found)


# Single source for the vocabulary block of CODEOWNERS (kept next to the tests that enforce it).
CODEOWNERS_PLAIN_VOCABULARY = ("finance", "payment", "invoice", "settlement", "wallet", "refund", "ledger", "reversal",
                               "rbac", "permission", "password", "credential", "authority", "dispatch", "login", "mfa",
                               "token", "session", "security")
CODEOWNERS_BOUNDARY_VOCABULARY = ("auth", "gate", "role")  # short words: only at a camelCase or - _ boundary
CODEOWNERS_SCRIPT_VOCABULARY = ("authority", "secret", "credential")
# Files the gate classifies by vocabulary that are deliberately NOT natively owned (the gate's human-approval rule
# still covers them): archived reference tests whose names merely contain 'Migration', and a Vite typings file.
VOCABULARY_EXEMPT = ("src/lib/wa-governance/archived-whatsapp-business-intakes-reference/", "src/vite-env.d.ts")


def expected_vocabulary_rules() -> set:
    """File forms (match entries named like the word) and directory forms (trailing '/', cover everything beneath)."""
    rules = set()
    for word in CODEOWNERS_PLAIN_VOCABULARY:
        for form in (f"*{word.capitalize()}*", f"*{word}*"):
            rules |= {f"/src/**/{form}", f"/src/**/{form}/"}
    for word in CODEOWNERS_BOUNDARY_VOCABULARY:
        for form in (f"*{word.capitalize()}*", f"{word}*", f"*-{word}*", f"*_{word}*"):
            rules |= {f"/src/**/{form}", f"/src/**/{form}/"}
    for word in CODEOWNERS_SCRIPT_VOCABULARY:
        rules |= {f"/scripts/**/*{word}*", f"/scripts/**/*{word}*/"}
    return rules


class CodeownersMatcherSemanticsTests(unittest.TestCase):
    """The model must not be permissive: a wildcard filename pattern must not own a directory's contents."""

    def assert_match(self, pattern, path, expected):
        """Assert CODEOWNERS matching behavior for a given pattern and path."""
        self.assertEqual(covered(pattern, path), expected, f"{pattern!r} vs {path!r}")

    def test_wildcard_file_pattern_does_not_own_a_matching_directorys_contents(self):
        """Verify wildcard file pattern does not own a matching directorys contents."""
        self.assert_match("/src/**/*Finance*", "src/FinanceFolder/plain.ts", False)
        self.assert_match("/src/**/*Finance*", "src/a/b/FinanceFolder/c/plain.ts", False)

    def test_wildcard_file_pattern_matches_files_at_every_depth(self):
        """Verify wildcard file pattern matches files at every depth."""
        for path in ("src/FinanceX.ts", "src/a/FinanceX.ts", "src/a/b/c/x.Finance.ts"):
            self.assert_match("/src/**/*Finance*", path, True)
        self.assert_match("/src/**/*Finance*", "src/a/Other.ts", False)
        self.assert_match("/src/**/*Finance*", "lib/FinanceX.ts", False)

    def test_trailing_slash_wildcard_owns_matching_directories_and_everything_beneath(self):
        """Verify trailing slash wildcard owns matching directories and everything beneath."""
        for path in ("src/FinanceFolder/plain.ts", "src/a/b/FinanceFolder/c/d.ts", "src/FinanceFolder/x/y/z.ts"):
            self.assert_match("/src/**/*Finance*/", path, True)
        self.assert_match("/src/**/*Finance*/", "src/FinanceX.ts", False)  # a file is not a directory
        self.assert_match("/src/**/*Finance*/", "src/Other/plain.ts", False)

    def test_double_star_logs_owns_descendants_of_any_directory_named_logs(self):
        """Verify double star logs owns descendants of any directory named logs."""
        for path in ("logs/a.txt", "build/logs/logs.txt", "scripts/logs/deep/x.txt", "logs"):
            self.assert_match("**/logs", path, True)
        self.assert_match("**/logs", "build/mylogs/a.txt", False)
        self.assert_match("**/logs", "build/logsX/a.txt", False)

    def test_single_star_directory_pattern_does_not_descend(self):
        """Verify single star directory pattern does not descend."""
        self.assert_match("/docs/*", "docs/a.md", True)
        self.assert_match("/docs/*", "docs/a/b.md", False)

    def test_trailing_slash_directory_matches_at_any_depth_unless_anchored(self):
        """Verify trailing slash directory matches at any depth unless anchored."""
        self.assert_match("docs/", "docs/a.md", True)
        self.assert_match("docs/", "src/docs/a/b.md", True)
        self.assert_match("docs/", "mydocs/a.md", False)
        self.assert_match("/docs/", "src/docs/a.md", False)

    def test_literal_directory_without_slash_owns_its_contents(self):
        """Verify literal directory without slash owns its contents."""
        self.assert_match("/apps/github", "apps/github/x.ts", True)
        self.assert_match("/apps/github", "apps/github", True)
        self.assert_match("/apps/github", "apps/githubX/x.ts", False)

    def test_wildcard_final_segment_after_literal_prefix_does_not_descend(self):
        """Verify wildcard final segment after literal prefix does not descend."""
        self.assert_match("/src/lib/finance*", "src/lib/financeX.ts", True)
        self.assert_match("/src/lib/finance*", "src/lib/finance-authority/x.ts", False)
        self.assert_match("/src/lib/finance*/", "src/lib/finance-authority/x.ts", True)

    def test_trailing_double_star_owns_everything_beneath_but_not_the_directory_itself(self):
        """Verify trailing double star owns everything beneath but not the directory itself."""
        self.assert_match("/a/**", "a/b/c.ts", True)
        self.assert_match("/a/**", "a", False)

    def test_leading_double_star_and_anchoring(self):
        """Verify leading double star and anchoring."""
        self.assert_match("**/x.ts", "x.ts", True)
        self.assert_match("**/x.ts", "a/b/x.ts", True)
        self.assert_match("/x.ts", "a/x.ts", False)
        self.assert_match("x.ts", "a/b/x.ts", True)


class CodeownersTests(unittest.TestCase):
    """Group workflow and ownership tests for codeowners."""
    def test_only_github_supported_syntax_is_used(self):
        """Verify only github supported syntax is used."""
        for pattern, _ in codeowners_rules():
            codeowners_regex(pattern)  # raises on [ ] ! ? and backslash escapes

    def test_matcher_rejects_unsupported_syntax(self):
        """Verify matcher rejects unsupported syntax."""
        for bad in ("/src/**/*[Ff]inance*", "!/src/x", "/src/?.ts", "/src/\\#x"):
            with self.assertRaises(ValueError):
                codeowners_regex(bad)

    def test_vocabulary_block_matches_its_single_source_of_truth(self):
        """Verify vocabulary block matches its single source of truth."""
        actual = {pattern for pattern, _ in codeowners_rules() if pattern.startswith(("/src/**/", "/scripts/**/"))}
        self.assertEqual(actual, expected_vocabulary_rules())

    def test_authority_code_in_src_and_scripts_is_natively_owned(self):
        """Verify authority code in src and scripts is natively owned."""
        rules = [pattern for pattern, _ in codeowners_rules()]
        flagged = []
        for base in ("src", "scripts"):
            for path in (ROOT / base).rglob("*"):
                if path.is_file() and "node_modules" not in path.parts and "__pycache__" not in path.parts:
                    rel = path.relative_to(ROOT).as_posix()
                    if gate.sensitive_paths({rel}) and not rel.startswith(VOCABULARY_EXEMPT):
                        flagged.append(rel)
        self.assertTrue(len(flagged) > 150, "classifier unexpectedly found too few authority files")
        uncovered = [rel for rel in flagged if not any(covered(rule, rel) for rule in rules)]
        self.assertEqual(uncovered[:10], [], "authority code without a native CODEOWNERS rule (showing up to 10)")

    def test_vocabulary_patterns_avoid_known_false_positives(self):
        """Verify vocabulary patterns avoid known false positives."""
        rules = [pattern for pattern, _ in codeowners_rules()]
        for path in ("src/lib/navigate.ts", "src/lib/aggregateTotals.ts", "src/utils/surrogate.ts",
                     "src/components/Button.tsx"):
            self.assertFalse(any(covered(rule, path) for rule in rules if rule.startswith("/src/**/")), path)
        for path in ("src/pages/admin/AdminSecurityGate.tsx", "src/utils/gateScanEvidence.ts",
                     "src/components/RoleProtectedRoute.tsx", "src/lib/token-hash-verification.ts",
                     "src/lib/msg91-session-bridge-routing.ts", "src/lib/post-claim-buyer-role-race.ts"):
            self.assertTrue(any(covered(rule, path) for rule in rules), path)

    def test_owners_are_exactly_the_trusted_humans_the_gate_accepts(self):
        """Verify owners are exactly the trusted humans the gate accepts."""
        expected = {"@" + login for login in gate.TRUSTED_HUMANS}
        for pattern, owners in codeowners_rules():
            self.assertEqual(set(owners), expected, pattern)

    def test_gate_and_bot_identities_are_never_confused(self):
        """Verify gate and bot identities are never confused."""
        self.assertFalse(any(login.endswith("[bot]") for login in gate.TRUSTED_HUMANS))
        self.assertEqual(gate.TRUSTED_BOT_APPROVERS, {"cursor[bot]"})
        self.assertFalse(gate.TRUSTED_BOT_APPROVERS & gate.TRUSTED_HUMANS)

    def test_every_sensitive_file_on_disk_has_a_code_owner_rule(self):
        """Verify every sensitive file on disk has a code owner rule."""
        rules = [pattern for pattern, _ in codeowners_rules()]
        uncovered = [path for path in sensitive_files_on_disk()
                     if not any(covered(rule, path) for rule in rules)]
        self.assertEqual(uncovered[:10], [], "sensitive files without a CODEOWNERS rule (showing up to 10)")

    def test_new_files_under_every_sensitive_prefix_are_code_owner_protected(self):
        """Forward-looking: a file that does not exist yet must not slip between the gate's prefixes and CODEOWNERS."""
        rules = [pattern for pattern, _ in codeowners_rules()]
        for prefix in gate.SENSITIVE_PREFIXES:
            future = prefix + "nested/FutureFile.ts" if prefix.endswith("/") else prefix + "FutureFile.ts"
            self.assertEqual(gate.sensitive_paths({future}), [future], future)
            self.assertTrue(any(covered(rule, future) for rule in rules), f"no CODEOWNERS rule covers {future}")
            if not prefix.endswith("/"):
                nested = prefix + "-new/nested/FutureFile.ts"  # a new directory whose name starts with the prefix
                self.assertEqual(gate.sensitive_paths({nested}), [nested], nested)
                self.assertTrue(any(covered(rule, nested) for rule in rules), f"no CODEOWNERS rule covers {nested}")
        for name in sorted(gate.SENSITIVE_FILES):
            self.assertTrue(any(covered(rule, name) for rule in rules), f"no CODEOWNERS rule covers {name}")

    def test_every_workflow_including_new_ones_is_code_owner_protected(self):
        """Verify every workflow including new ones is code owner protected."""
        self.assertTrue(any(covered(rule, ".github/workflows/some-future-evidence-job.yml") for rule, _ in codeowners_rules()))
        for path in WORKFLOWS.glob("*.yml"):
            rel = path.relative_to(ROOT).as_posix()
            self.assertTrue(any(covered(rule, rel) for rule, _ in codeowners_rules()), rel)

    def test_workflows_and_lane_producers_are_classified_sensitive_by_the_gate(self):
        """Verify workflows and lane producers are classified sensitive by the gate."""
        for path in (".github/workflows/some-future-evidence-job.yml", "scripts/point100-certification/x.mjs",
                     "scripts/integration-certification/x.mjs", "tests/point100/x.spec.ts"):
            self.assertEqual(gate.sensitive_paths({path}), [path])


class PolicyDocumentTests(unittest.TestCase):
    """Group workflow and ownership tests for policy document."""
    doc = (ROOT / "docs/appverse-control/AUTONOMOUS_RELEASE_POLICY.md").read_text()

    def test_states_evaluator_vs_actuator_and_ai_approval_rules(self):
        """Verify states evaluator vs actuator and ai approval rules."""
        for phrase in ("Merge actuator", "never merges", "#657", "GPT Governance", "bot or AI approval",
                       "Residual risk", "Phase 2", "NAME_MISMATCH", "AUTHORITATIVE_PUBLICATION_WITHHELD",
                       "native auto-merge stays DISABLED", "--evaluate", "FRESHNESS_SECONDS", "ACCEPTED_PREMERGE_FAILURES",
                       "Residual architectural blocker", "Oasis Appverse Merge Gate"):
            self.assertIn(phrase, self.doc, phrase)


if __name__ == "__main__":
    unittest.main()
