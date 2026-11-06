"""Static policy tests for the merge-gate workflows, CODEOWNERS and CI-lane drift (no network, no YAML dependency)."""
import fnmatch
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
    return "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("#"))


def workflow_name(text: str) -> str:
    return re.search(r"^name:\s*(.+?)\s*$", text, re.M).group(1).strip("'\"")


def job_names(text: str) -> set:
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
    code = strip_comments(CONTROLLER)

    def test_never_uses_privileged_pr_triggers(self):
        self.assertNotIn("pull_request_target", self.code)
        self.assertIsNone(re.search(r"^  pull_request:", self.code, re.M))
        self.assertIsNone(re.search(r"^  pull_request_review", self.code, re.M))
        self.assertIsNone(re.search(r"^  issue_comment", self.code, re.M))

    def test_triggers_are_trusted_events_only(self):
        triggers = re.search(r"^on:\n((?:  .*\n|\n)+)", self.code, re.M).group(1)
        names = set(re.findall(r"^  ([a-z_]+):", triggers, re.M))
        self.assertEqual(names, {"workflow_run", "schedule", "workflow_dispatch"})

    def test_permissions_are_minimal_and_exact(self):
        block = re.search(r"^permissions:\n((?:  .*\n)+)", self.code, re.M).group(1)
        granted = dict(re.findall(r"^  ([a-z-]+):\s*(\w+)\s*$", block, re.M))
        self.assertEqual(granted, {"contents": "read", "actions": "read", "pull-requests": "read",
                                   "checks": "write", "statuses": "read"})
        for forbidden in ("contents: write", "pull-requests: write", "issues: write", "id-token", "packages",
                          "administration", "deployments", "write-all", "secrets."):
            self.assertNotIn(forbidden, self.code)

    def test_checks_out_trusted_main_without_persisted_credentials(self):
        self.assertIn("ref: main", self.code)
        self.assertIn("persist-credentials: false", self.code)
        self.assertNotIn("github.head_ref", self.code)
        self.assertNotIn("github.event.pull_request", self.code)

    def test_only_runs_from_main_in_the_real_repository(self):
        self.assertIn("github.ref == 'refs/heads/main'", self.code)
        self.assertIn("github.repository == 'oasisbaklawa2006/Oasis-Baklawa-Central'", self.code)

    def test_no_untrusted_expression_is_interpolated_into_shell(self):
        for block in run_blocks(self.code):
            for expr in re.findall(r"\$\{\{(.+?)\}\}", block):
                self.assertNotRegex(expr, r"github\.event|github\.head_ref|inputs\.", block)

    def test_actions_are_pinned_to_full_commit_shas(self):
        for text in (CONTROLLER, UNIT_CI):
            for use in re.findall(r"^\s*(?:- )?uses:\s*(\S+)", strip_comments(text), re.M):
                self.assertRegex(use, r"@[0-9a-f]{40}$", use)
            self.assertTrue(re.search(r"^\s*(?:- )?uses:", strip_comments(text), re.M))

    def test_concurrency_serialises_without_cancelling_in_flight_verdicts(self):
        self.assertIn("group: appverse-trusted-merge-gate", self.code)
        self.assertIn("cancel-in-progress: false", self.code)

    def test_runner_image_is_pinned(self):
        for text in (CONTROLLER, UNIT_CI):
            self.assertIsNone(re.search(r"runs-on:\s*ubuntu-latest", text))
            self.assertIn("runs-on: ubuntu-24.04", text)

    def test_controller_never_executes_candidate_code_or_installs_dependencies(self):
        for block in run_blocks(self.code):
            for forbidden in ("npm ", "npx ", "pip ", "bun ", "yarn ", "curl ", "wget ", "bash -c"):
                self.assertNotIn(forbidden, block)
        self.assertIn("python3 scripts/appverse-control/appverse_merge_gate.py", self.code)

    def test_workflow_run_watches_only_existing_workflows(self):
        listed = re.search(r"workflow_run:\n\s+workflows:\n((?:\s+- .+\n)+)", self.code).group(1)
        watched = {w.strip().strip("'\"") for w in re.findall(r"- (.+)", listed)}
        existing = {workflow_name(p.read_text()) for p in WORKFLOWS.glob("*.yml")}
        self.assertTrue(watched)
        self.assertFalse(watched - existing, f"controller watches non-existent workflows: {watched - existing}")


class UnitTestWorkflowTests(unittest.TestCase):
    code = strip_comments(UNIT_CI)

    def test_read_only_and_no_secrets(self):
        self.assertIn("contents: read", self.code)
        self.assertNotIn("write", re.search(r"^permissions:\n((?:  .*\n)+)", self.code, re.M).group(1))
        self.assertNotIn("secrets.", self.code)

    def test_runs_every_policy_and_gate_test_for_the_whole_control_surface(self):
        self.assertIn("-p 'test_*.py'", self.code)
        paths = pull_request_paths(UNIT_CI)
        for needed in (".github/workflows/**", ".github/CODEOWNERS", "scripts/appverse-control/**",
                       "tests/appverse-control/**", "docs/appverse-control/**"):
            self.assertIn(needed, paths)


class QualityGateIntegrityTests(unittest.TestCase):
    """The #659 runner correction must be present and must not have weakened any test."""

    def test_runner_is_pinned_to_ubuntu_2404_for_playwright(self):
        self.assertIn("runs-on: ubuntu-24.04", QUALITY)
        self.assertIsNone(re.search(r"runs-on:\s*ubuntu-latest", QUALITY))

    def test_browser_install_and_smoke_are_still_enforced(self):
        self.assertIn("npx playwright install --with-deps chromium", QUALITY)
        self.assertIn("npx playwright test tests/visual-audit.spec.ts", QUALITY)
        for step in ("npm run typecheck", "npm run test", "npm run build"):
            self.assertIn(step, QUALITY)

    def test_no_test_step_is_neutralised(self):
        code = strip_comments(QUALITY)
        self.assertNotIn("continue-on-error: true", code)
        self.assertIsNone(re.search(r"^\s*if:\s*(false|\$\{\{\s*false\s*\}\})\s*$", code, re.M))


class CiLaneDriftTests(unittest.TestCase):
    """Gate lane triggers must mirror the real workflows, otherwise PRs deadlock or lanes are silently skipped."""

    LANE_WORKFLOWS = {
        "Disposable Buyer golden path certification": "buyer-golden-path-certification.yml",
        "Disposable Factory certification": "factory-certification-ephemeral.yml",
        "Point100 production-bound software rehearsal": "point100-certification-ephemeral.yml",
    }

    def test_lane_triggers_equal_the_workflow_path_filters(self):
        self.assertEqual(set(gate.LANE_TRIGGERS), set(self.LANE_WORKFLOWS))
        for lane, filename in self.LANE_WORKFLOWS.items():
            actual = pull_request_paths((WORKFLOWS / filename).read_text())
            self.assertTrue(actual, f"{filename} has no pull_request.paths")
            self.assertEqual(set(gate.LANE_TRIGGERS[lane]), actual, f"{lane} drifted from {filename}")

    def test_every_lane_job_name_exists_in_its_workflow(self):
        for lane, filename in self.LANE_WORKFLOWS.items():
            self.assertIn(lane, job_names((WORKFLOWS / filename).read_text()))

    def test_every_github_actions_required_check_is_a_real_job_name(self):
        names = set()
        for path in WORKFLOWS.glob("*.yml"):
            names |= job_names(path.read_text())
        codeql = {"Analyze (actions)", "Analyze (python)", "Analyze (javascript-typescript)"}
        for name, slug in gate.REQUIRED_CHECKS.items():
            if slug == "github-actions":
                self.assertIn(name, names, f"required check '{name}' is not produced by any workflow")
        self.assertTrue(codeql)  # CodeQL default setup produces these outside the repo's workflow files


def codeowners_rules() -> list:
    rules = []
    for line in (ROOT / ".github" / "CODEOWNERS").read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#"):
            pattern, *owners = line.split()
            rules.append((pattern, owners))
    return rules


def covered(pattern: str, path: str) -> bool:
    """Anchored CODEOWNERS pattern: leading segments must match (directory patterns cover their contents)."""
    if not pattern.startswith("/"):
        return False
    pattern_parts = pattern.strip("/").split("/")
    path_parts = path.split("/")
    if len(path_parts) < len(pattern_parts):
        return False
    return all(fnmatch.fnmatchcase(path_parts[i], pattern_parts[i]) for i in range(len(pattern_parts)))


def sensitive_files_on_disk() -> list:
    """Files under the gate's prefix/file lists, found by walking the tree (no subprocess needed)."""
    found = set()
    skip = {"__pycache__", "node_modules", ".git"}

    def add(path: pathlib.Path):
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


class CodeownersTests(unittest.TestCase):
    def test_owners_are_exactly_the_trusted_humans_the_gate_accepts(self):
        expected = {"@" + login for login in gate.TRUSTED_HUMANS}
        for pattern, owners in codeowners_rules():
            self.assertEqual(set(owners), expected, pattern)

    def test_gate_and_bot_identities_are_never_confused(self):
        self.assertFalse(any(login.endswith("[bot]") for login in gate.TRUSTED_HUMANS))
        self.assertEqual(gate.TRUSTED_BOT_APPROVERS, {"cursor[bot]"})
        self.assertFalse(gate.TRUSTED_BOT_APPROVERS & gate.TRUSTED_HUMANS)

    def test_every_sensitive_file_on_disk_has_a_code_owner_rule(self):
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
        for name in sorted(gate.SENSITIVE_FILES):
            self.assertTrue(any(covered(rule, name) for rule in rules), f"no CODEOWNERS rule covers {name}")

    def test_every_workflow_including_new_ones_is_code_owner_protected(self):
        self.assertTrue(any(covered(rule, ".github/workflows/some-future-evidence-job.yml") for rule, _ in codeowners_rules()))
        for path in WORKFLOWS.glob("*.yml"):
            rel = path.relative_to(ROOT).as_posix()
            self.assertTrue(any(covered(rule, rel) for rule, _ in codeowners_rules()), rel)

    def test_workflows_and_lane_producers_are_classified_sensitive_by_the_gate(self):
        for path in (".github/workflows/some-future-evidence-job.yml", "scripts/point100-certification/x.mjs",
                     "scripts/integration-certification/x.mjs", "tests/point100/x.spec.ts"):
            self.assertEqual(gate.sensitive_paths({path}), [path])


class PolicyDocumentTests(unittest.TestCase):
    doc = (ROOT / "docs/appverse-control/AUTONOMOUS_RELEASE_POLICY.md").read_text()

    def test_states_evaluator_vs_actuator_and_ai_approval_rules(self):
        for phrase in ("Merge actuator", "never merges", "#657", "GPT Governance", "bot or AI approval",
                       "Residual risk", "Phase 2"):
            self.assertIn(phrase, self.doc, phrase)


if __name__ == "__main__":
    unittest.main()
