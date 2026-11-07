"""Offline fail-closed tests for the trusted Appverse merge gate.

No test may reach the network: setUp replaces ``gate.api`` with a function that fails the test if called unless a
test installs its own fake.
"""
import datetime
import importlib.util
import json
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "appverse_merge_gate", ROOT / "scripts/appverse-control/appverse_merge_gate.py"
)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)

SHA = "1" * 40
ENV_API = "GH_TOKEN"  # name of the env var the controller reads; values used in tests are dummies
DUMMY_CREDENTIAL = "x" * 8


def env(actions=None, app=None, **extra):
    """Environment mapping built from the script's own identity->variable table (values are dummies)."""
    out = dict(extra)
    if actions:
        out[gate.CREDENTIAL_ENV["actions"]] = actions if isinstance(actions, str) else "dummy-actions"
    if app:
        out[gate.CREDENTIAL_ENV["app"]] = app if isinstance(app, str) else "dummy-app"
    return out
BASE = "b" * 40
AUTHOR = "oasisbaklawa2006"
OWNER2 = "dineshmutrejabackup-cmd"


def no_network(*args, **kwargs):
    """Reject unexpected network requests during offline unit tests."""
    raise AssertionError(f"unexpected network call: {args} {kwargs}")


class GateTestCase(unittest.TestCase):
    """Provide common isolated fixtures and cleanup for gate tests."""
    def setUp(self):
        """Prepare isolated mocks and fixtures for the next test."""
        patcher = mock.patch.object(gate, "api", side_effect=no_network)
        patcher.start()
        self.addCleanup(patcher.stop)
        sleeper = mock.patch.object(gate.time, "sleep")
        sleeper.start()
        self.addCleanup(sleeper.stop)


def ok_status_rule(**overrides):
    """Create a valid required-status ruleset fixture."""
    rule = {"enforcement": "active", "target": "branch", "bypass_actors": [],
            "conditions": {"ref_name": {"include": ["refs/heads/main"]}},
            "rules": [{"type": "required_status_checks", "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [{"context": gate.CHECK_NAME, "integration_id": gate.GATE_APP_ID}]}}]}
    rule.update(overrides)
    return rule


def ok_governance(**params):
    """Create a valid pull-request governance ruleset fixture."""
    base = {"required_approving_review_count": 1, "require_code_owner_review": True,
            "dismiss_stale_reviews_on_push": True, "required_review_thread_resolution": True}
    base.update(params)
    return {"enforcement": "active", "target": "branch", "bypass_actors": [],
            "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"]}},
            "rules": [{"type": "pull_request", "parameters": base}]}


class RulesetTests(GateTestCase):
    """Group offline tests for ruleset."""
    def evaluate(self, status_rule, governance):
        """Evaluate the supplied rulesets with mocked GitHub responses."""
        with mock.patch.object(gate, "api", side_effect=[status_rule, governance]):
            return gate.ruleset_problems()

    def test_no_required_ruleset_rejects(self):
        """Verify no required ruleset rejects."""
        with mock.patch.object(gate, "api", return_value={"enforcement": "active", "rules": []}):
            self.assertFalse(gate.configured_ruleset())

    def test_loose_required_rule_rejects(self):
        """Verify loose required rule rejects."""
        response = {"enforcement": "active", "rules": [{"type": "required_status_checks",
            "parameters": {"strict_required_status_checks_policy": False,
                           "required_status_checks": [{"context": gate.CHECK_NAME}]}}]}
        with mock.patch.object(gate, "api", return_value=response):
            self.assertFalse(gate.configured_ruleset())

    def test_strict_pinned_rules_accept(self):
        """Verify strict pinned rules accept."""
        self.assertEqual(self.evaluate(ok_status_rule(), ok_governance()), [])

    def test_missing_integration_id_rejects(self):
        """Verify missing integration id rejects."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"] = [{"context": gate.CHECK_NAME}]
        problems = self.evaluate(rule, ok_governance())
        self.assertTrue(any("not pinned exclusively to the dedicated gate App" in p for p in problems))

    def test_wrong_integration_id_rejects(self):
        """Verify wrong integration id rejects."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"][0]["integration_id"] = 999
        self.assertTrue(self.evaluate(rule, ok_governance()))

    def test_pin_to_the_shared_actions_identity_is_rejected_as_impersonable(self):
        """Verify pin to the shared actions identity is rejected as impersonable."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"][0]["integration_id"] = gate.GITHUB_ACTIONS_APP_ID
        problems = self.evaluate(rule, ok_governance())
        self.assertTrue(any("shared GitHub Actions identity" in p and "impersonate" in p for p in problems), problems)

    def test_actions_entry_alongside_the_dedicated_app_is_rejected(self):
        """Verify actions entry alongside the dedicated app is rejected."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"].append(
            {"context": gate.CHECK_NAME, "integration_id": gate.GITHUB_ACTIONS_APP_ID})
        self.assertTrue(self.evaluate(rule, ok_governance()))

    def test_gate_must_be_required_at_all(self):
        """Verify gate must be required at all."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"] = [{"context": "Something Else", "integration_id": gate.GATE_APP_ID}]
        self.assertTrue(any("not a required status check" in p for p in self.evaluate(rule, ok_governance())))

    def test_the_advisory_check_name_can_never_satisfy_the_requirement(self):
        """Verify the advisory check name can never satisfy the requirement."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"] = [
            {"context": gate.ADVISORY_CHECK_NAME, "integration_id": gate.GITHUB_ACTIONS_APP_ID}]
        self.assertTrue(self.evaluate(rule, ok_governance()))
        self.assertNotEqual(gate.ADVISORY_CHECK_NAME, gate.CHECK_NAME)
        self.assertIn("(advisory)", gate.ADVISORY_CHECK_NAME)

    def test_dedicated_app_is_the_expected_identity(self):
        """Verify dedicated app is the expected identity."""
        self.assertEqual(gate.GATE_APP_ID, 5645415)
        self.assertNotEqual(gate.GATE_APP_ID, gate.GITHUB_ACTIONS_APP_ID)

    def test_bypass_actor_rejects(self):
        """Verify bypass actor rejects."""
        problems = self.evaluate(ok_status_rule(bypass_actors=[{"actor_id": 5}]), ok_governance())
        self.assertTrue(any("bypass actors are configured" in p for p in problems))

    def test_hidden_bypass_actors_never_means_no_bypass(self):
        """Verify hidden bypass actors never means no bypass."""
        rule = ok_status_rule()
        del rule["bypass_actors"]
        problems = self.evaluate(rule, ok_governance())
        self.assertTrue(any("bypass_actors not visible" in p for p in problems))

    def test_hidden_bypass_actors_on_governance_ruleset_rejects(self):
        """Verify hidden bypass actors on governance ruleset rejects."""
        governance = ok_governance()
        del governance["bypass_actors"]
        self.assertTrue(self.evaluate(ok_status_rule(), governance))

    def test_code_owner_review_must_be_enforced(self):
        """Verify code owner review must be enforced."""
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(require_code_owner_review=False)))

    def test_stale_review_dismissal_must_be_enforced(self):
        """Verify stale review dismissal must be enforced."""
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(dismiss_stale_reviews_on_push=False)))

    def test_thread_resolution_must_be_enforced(self):
        """Verify thread resolution must be enforced."""
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(required_review_thread_resolution=False)))

    def test_zero_required_approvals_rejects(self):
        """Verify zero required approvals rejects."""
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(required_approving_review_count=0)))

    def test_inactive_or_non_main_ruleset_rejects(self):
        """Verify inactive or non main ruleset rejects."""
        self.assertTrue(self.evaluate(ok_status_rule(enforcement="evaluate"), ok_governance()))
        other = ok_status_rule(conditions={"ref_name": {"include": ["refs/heads/other"]}})
        self.assertTrue(self.evaluate(other, ok_governance()))

    def test_non_strict_policy_rejects(self):
        """Verify non strict policy rejects."""
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["strict_required_status_checks_policy"] = False
        self.assertTrue(self.evaluate(rule, ok_governance()))


class EvidenceProvenanceTests(GateTestCase):
    """Group offline tests for evidence provenance."""
    def test_pending_outranks_stale_success(self):
        """Verify pending outranks stale success."""
        checks = [
            {"name": "CodeRabbit", "app": {"slug": "coderabbitai"}, "status": "completed",
             "conclusion": "success", "id": 1, "started_at": "2026-11-06T00:00:00Z"},
            {"name": "CodeRabbit", "app": {"slug": "coderabbitai"}, "status": "in_progress",
             "conclusion": None, "id": 2, "started_at": "2026-11-06T01:00:00Z"},
        ]
        with mock.patch.object(gate, "paginated", return_value=checks):
            self.assertEqual(gate.latest_checks("0" * 40)[("CodeRabbit", "coderabbitai")]["status"], "in_progress")

    def test_same_name_from_different_app_is_a_different_identity(self):
        """Verify same name from different app is a different identity."""
        checks = [{"name": "CodeRabbit", "app": {"slug": "github-actions"}, "status": "completed",
                   "conclusion": "success", "id": 1, "started_at": "2026-11-06T00:00:00Z"}]
        with mock.patch.object(gate, "paginated", return_value=checks):
            found = gate.latest_checks(SHA)
        self.assertNotIn(("CodeRabbit", "coderabbitai"), found)

    def test_newest_status_wins_regardless_of_list_order(self):
        """Verify newest status wins regardless of list order."""
        statuses = [
            {"context": "Vercel", "state": "pending", "updated_at": "2026-11-06T02:00:00Z", "id": 9,
             "creator": {"login": "vercel[bot]"}},
            {"context": "Vercel", "state": "success", "updated_at": "2026-11-06T01:00:00Z", "id": 3,
             "creator": {"login": "vercel[bot]"}},
        ]
        for ordering in (statuses, list(reversed(statuses))):
            with mock.patch.object(gate, "paginated", return_value=ordering):
                self.assertEqual(gate.latest_statuses(SHA)["Vercel"]["state"], "pending")

    def test_unresolved_review_thread_rejects(self):
        """Verify unresolved review thread rejects."""
        payload = {"repository": {"pullRequest": {"reviewThreads": {
            "nodes": [{"isResolved": False}], "pageInfo": {"hasNextPage": False}}}}}
        with mock.patch.object(gate, "graphql", return_value=payload):
            self.assertEqual(gate.unresolved_threads(5), 1)

    def test_more_than_one_thread_page_fails_closed(self):
        """Verify more than one thread page fails closed."""
        payload = {"repository": {"pullRequest": {"reviewThreads": {
            "nodes": [], "pageInfo": {"hasNextPage": True}}}}}
        with mock.patch.object(gate, "graphql", return_value=payload):
            with self.assertRaises(gate.GateError):
                gate.unresolved_threads(5)


def review(user, state="APPROVED", sha=SHA, association="NONE"):
    """Build a review submission with the requested author and state."""
    return {"user": {"login": user}, "state": state, "commit_id": sha, "author_association": association}


class ReviewTrustTests(GateTestCase):
    """Group offline tests for review trust."""
    def approve(self, reviews, *, human=False, author=AUTHOR, sha=SHA):
        """Check whether the supplied review fixtures meet the approval requirement."""
        with mock.patch.object(gate, "paginated", return_value=reviews):
            return gate.review_approval(1, sha, author, require_human=human)

    def test_old_head_approval_rejects(self):
        """Verify old head approval rejects."""
        self.assertFalse(self.approve([review("cursor[bot]", sha="9" * 40)]))

    def test_author_self_approval_rejects(self):
        """Verify author self approval rejects."""
        self.assertFalse(self.approve([review(AUTHOR, association="OWNER")], human=True))

    def test_untrusted_account_cannot_approve(self):
        """Verify untrusted account cannot approve."""
        self.assertFalse(self.approve([review("random-user", association="COLLABORATOR")]))

    def test_trusted_login_without_trusted_association_cannot_approve(self):
        """Verify trusted login without trusted association cannot approve."""
        self.assertFalse(self.approve([review(OWNER2, association="NONE")], human=True))

    def test_untrusted_changes_requested_neither_blocks_nor_approves(self):
        """Verify untrusted changes requested neither blocks nor approves."""
        reviews = [review("cursor[bot]"), review("drive-by", "CHANGES_REQUESTED", association="NONE")]
        self.assertTrue(self.approve(reviews))

    def test_trusted_changes_requested_rejects_bot_approval(self):
        """Verify trusted changes requested rejects bot approval."""
        reviews = [review("cursor[bot]"), review(OWNER2, "CHANGES_REQUESTED", association="COLLABORATOR")]
        self.assertFalse(self.approve(reviews))

    def test_dismissed_approval_rejects(self):
        """Verify dismissed approval rejects."""
        reviews = [review(OWNER2, "APPROVED", association="COLLABORATOR"),
                   review(OWNER2, "DISMISSED", association="COLLABORATOR")]
        self.assertFalse(self.approve(reviews, human=True))

    def test_empty_author_fails_closed(self):
        """Verify empty author fails closed."""
        with mock.patch.object(gate, "paginated", return_value=[review(OWNER2, association="COLLABORATOR")]):
            with self.assertRaises(gate.GateError):
                gate.review_approval(1, SHA, "", require_human=True)

    def test_bot_only_approval_rejects_when_human_required(self):
        """Verify bot only approval rejects when human required."""
        self.assertFalse(self.approve([review("cursor[bot]")], human=True))

    def test_trusted_bot_may_approve_non_sensitive(self):
        """Verify trusted bot may approve non sensitive."""
        self.assertTrue(self.approve([review("cursor[bot]")], human=False))

    def test_trusted_human_codeowner_can_approve_sensitive(self):
        """Verify trusted human codeowner can approve sensitive."""
        self.assertTrue(self.approve([review(OWNER2, association="COLLABORATOR")], human=True))

    def test_human_approval_plus_bot_changes_requested_rejects(self):
        """Verify human approval plus bot changes requested rejects."""
        reviews = [review(OWNER2, association="COLLABORATOR"), review("cursor[bot]", "CHANGES_REQUESTED")]
        self.assertFalse(self.approve(reviews, human=True))


class SensitivePathTests(GateTestCase):
    """Group offline tests for sensitive path."""
    def test_sensitive_areas_are_classified(self):
        """Verify sensitive areas are classified."""
        sensitive = [
            "src/lib/finance-authority/reverse.ts", "src/lib/finance-governance/bundle.ts",
            "src/pages/admin/AdminFinance.tsx", "src/components/PaymentProofForm.tsx",
            "src/lib/order-authority/financeReversalClient.ts", "src/lib/auth/session.ts", "src/lib/auth-flow.ts",
            "src/pages/StaffLogin.tsx", "src/pages/SecurityMfa.tsx", "src/lib/roleNormalization.ts",
            "src/lib/dispatch-authority/gate.ts", "src/lib/dispatchGovernedRpc.ts",
            "src/lib/dispatchRbacRlsCert/probe.ts", "src/lib/point79WalletAuthority.ts",
            "src/lib/stock-authority/x.ts", "supabase/config.toml", "supabase/functions/x/index.ts",
            ".github/workflows/quality-gate.yml", ".github/workflows/anything-new.yml", ".github/CODEOWNERS",
            ".github/rulesets/main.json", "vercel.json", "package.json", "package-lock.json", "bun.lock",
            "scripts/appverse-control/appverse_merge_gate.py", "tests/appverse-control/test_x.py",
            "docs/appverse-control/AUTONOMOUS_RELEASE_POLICY.md", ".appverse/anything.md",
            "scripts/point100-certification/finalize.mjs", "scripts/factory-certification/seed.mjs",
            "scripts/buyer-certification/run.mjs", "scripts/integration-certification/verify.mjs",
            "tests/point100/x.spec.ts", "tests/factory-certification/x.ts", "src/lib/point100/guard.ts",
            "SECURITY.md", "CLAUDE.md", "AGENTS.md", "src/lib/secretsRedaction.ts", "docs/ledger-notes.md",
            "src/lib/rlsPolicyHelpers.ts", "src/lib/apiTokenStore.ts",
        ]
        for path in sensitive:
            self.assertEqual(gate.sensitive_paths({path}), [path], path)

    def test_ordinary_paths_are_not_classified(self):
        """Verify ordinary paths are not classified."""
        ordinary = ["docs/README.md", "src/components/Button.tsx", "src/pages/PublicLanding.tsx",
                    "src/lib/navigateHelpers.ts", "src/lib/aggregateTotals.ts", "src/lib/authorList.ts",
                    "src/styles/theme.css", "public/robots.txt"]
        for path in ordinary:
            self.assertEqual(gate.sensitive_paths({path}), [], path)

    def test_result_is_deterministic_and_complete(self):
        """Verify result is deterministic and complete."""
        paths = {"src/components/Button.tsx", "src/lib/finance-authority/a.ts", ".github/CODEOWNERS"}
        self.assertEqual(gate.sensitive_paths(paths), [".github/CODEOWNERS", "src/lib/finance-authority/a.ts"])


class ScopeTests(GateTestCase):
    """Group offline tests for scope."""
    def test_ordinary_change_requires_only_baseline_checks(self):
        """Verify ordinary change requires only baseline checks."""
        required = gate.relevant_checks({"docs/README.md"})
        self.assertEqual(set(required), set(gate.REQUIRED_CHECKS))

    def test_each_lane_requires_only_what_its_workflow_triggers_on(self):
        """Verify each lane requires only what its workflow triggers on."""
        factory = gate.relevant_checks({"scripts/factory-certification/seed.mjs"})
        self.assertIn("Disposable Factory certification", factory)
        self.assertNotIn("Point100 production-bound software rehearsal", factory)  # that workflow cannot trigger
        buyer = gate.relevant_checks({"src/pages/customer/BuyerApp.tsx"})
        self.assertIn("Disposable Buyer golden path certification", buyer)
        self.assertNotIn("Disposable Factory certification", buyer)
        point = gate.relevant_checks({"scripts/point100-certification/x.mjs"})
        self.assertIn("Point100 production-bound software rehearsal", point)

    def test_lane_config_files_trigger_their_lane(self):
        """Verify lane config files trigger their lane."""
        self.assertIn("Disposable Factory certification", gate.relevant_checks({"playwright.factory-cert.config.ts"}))
        self.assertIn("Disposable Buyer golden path certification", gate.relevant_checks({"playwright.buyer-cert.config.ts"}))
        self.assertIn("Point100 production-bound software rehearsal", gate.relevant_checks({"playwright.point100.config.ts"}))

    def test_unrelated_appverse_file_does_not_require_point100(self):
        """Verify unrelated appverse file does not require point100."""
        # Requiring a lane that can never trigger would deadlock the PR.
        self.assertNotIn("Point100 production-bound software rehearsal", gate.relevant_checks({".appverse/OTHER.md"}))

    def test_glob_semantics(self):
        """Verify glob semantics."""
        self.assertTrue(gate.path_matches("scripts/a/**", "scripts/a/b/c.mjs"))
        self.assertTrue(gate.path_matches("src/lib/factoryOperations*.ts", "src/lib/factoryOperationsX.ts"))
        self.assertFalse(gate.path_matches("src/lib/factoryOperations*.ts", "src/lib/sub/factoryOperationsX.ts"))
        self.assertFalse(gate.path_matches("tests/point100/**", "tests/point1000/x.ts"))
        self.assertTrue(gate.path_matches("**/x.ts", "x.ts"))

    def test_codeql_languages_follow_changed_files(self):
        """Verify codeql languages follow changed files."""
        required = gate.relevant_checks({"a.py", ".github/workflows/x.yml", "src/a.tsx"})
        for name in ("Analyze (python)", "Analyze (actions)", "Analyze (javascript-typescript)"):
            self.assertIn(name, required)
        self.assertNotIn("Analyze (python)", gate.relevant_checks({"docs/a.md"}))

    def test_extra_failing_or_pending_checks_block_but_gate_itself_and_advisory_do_not(self):
        """Verify extra failing or pending checks block but gate itself and advisory do not."""
        def run(name, slug, status, conclusion):
            """Build the requested synthetic check-run entry."""
            return {(name, slug): {"status": status, "conclusion": conclusion}}
        required = {"CodeRabbit": "coderabbitai"}
        self.assertTrue(gate.unexpected_check_state(run("Some Lane", "github-actions", "completed", "failure"), required))
        self.assertTrue(gate.unexpected_check_state(run("Some Lane", "github-actions", "in_progress", None), required))
        self.assertTrue(gate.unexpected_check_state(run("Some Lane", "github-actions", "completed", "cancelled"), required))
        self.assertTrue(gate.unexpected_check_state(run("Some Lane", "github-actions", "completed", "timed_out"), required))
        self.assertTrue(gate.unexpected_check_state(run("Some Lane", "x", "completed", "action_required"), required))
        for ok in (("Some Lane", "github-actions", "completed", "success"),
                   ("Some Lane", "github-actions", "completed", "skipped"),
                   ("Some Lane", "github-actions", "completed", "neutral"),
                   (gate.CHECK_NAME, "github-actions", "completed", "failure"),
                   ("Scan (advisory)", "github-actions", "completed", "failure")):
            self.assertEqual(gate.unexpected_check_state(run(*ok), required), [], ok)


def check(name, slug, conclusion="success", status="completed", cid=1, app_id=None):
    """Build a check-run fixture for a named publisher and conclusion."""
    return {"name": name, "app": {"slug": slug, **({"id": app_id} if app_id else {})}, "status": status,
            "conclusion": conclusion, "id": cid, "started_at": "2026-11-06T00:00:00Z"}


def all_green(required):
    """Build successful check-run fixtures for every required check."""
    return [check(name, slug, cid=i) for i, (name, slug) in enumerate(required.items(), 1)]


def base_pr(**overrides):
    """Create a minimal pull-request fixture with configurable fields."""
    pr = {"number": 700, "head": {"sha": SHA}, "base": {"ref": "main", "sha": BASE}, "state": "open",
          "draft": False, "title": "Ordinary change", "mergeable": True, "mergeable_state": "clean",
          "user": {"login": AUTHOR}}
    pr.update(overrides)
    return pr


class ValidateMatrixTests(GateTestCase):
    """Full required-check matrix for an ordinary PR, and each way it must fail closed."""

    def run_validate(self, *, files=("docs/README.md",), checks=None, statuses=None, threads=0, approved=True,
                     coderabbit=True, ruleset=(), pr=None, now_pr=None, renames=None):
        """Run merge eligibility against controlled GitHub and review fixtures."""
        pr = pr or base_pr()
        changed = [{"filename": f, **({"previous_filename": renames[f]} if renames and f in renames else {})} for f in files]
        required = gate.relevant_checks(set(files) | set((renames or {}).values()))
        runs = all_green(required) if checks is None else checks
        statuses = statuses if statuses is not None else {
            "security/snyk (oasisbaklawa2006)": {"state": "success", "creator": {"login": "snyk-io[bot]"}},
            "Vercel": {"state": "success", "creator": {"login": "vercel[bot]"}}}
        approvals = []
        def fake_review_approval(number, sha, author, require_human=False):
            """Record human-review requirements while simulating approval."""
            approvals.append(require_human)
            return approved
        with mock.patch.multiple(
            gate, ruleset_problems=lambda: list(ruleset),
            paginated=lambda path, key=None: changed, latest_checks=lambda sha: {
                (c["name"], c["app"]["slug"]): c for c in runs},
            latest_statuses=lambda sha: statuses, unresolved_threads=lambda n: threads,
            review_approval=fake_review_approval,
            coderabbit_review_problems=lambda n, s: ([] if coderabbit is True else ['actionable finding(s)'] if coderabbit is False else list(coderabbit)),
            current_pr=lambda n: now_pr or pr,
        ):
            self.approvals = approvals
            return gate.validate(pr)

    def test_ordinary_eligible_pr_passes_every_gate(self):
        """Verify ordinary eligible pr passes every gate."""
        self.assertEqual(self.run_validate(), [])
        self.assertEqual(self.approvals, [False])  # bot approval acceptable for non-sensitive

    def test_every_required_check_missing_skipped_cancelled_or_failed_blocks(self):
        """Verify every required check missing skipped cancelled or failed blocks."""
        required = gate.relevant_checks({"docs/README.md"})
        for name, slug in required.items():
            for mode in ("missing", "skipped", "cancelled", "failure", "pending", "neutral", "timed_out"):
                runs = [c for c in all_green(required) if c["name"] != name]
                if mode == "pending":
                    runs.append(check(name, slug, None, "in_progress", 99))
                elif mode != "missing":
                    runs.append(check(name, slug, mode, "completed", 99))
                errors = self.run_validate(checks=runs)
                self.assertTrue(any(f"Required check {name}" in e for e in errors), f"{name} {mode}: {errors}")

    def test_required_check_from_wrong_app_does_not_count(self):
        """Verify required check from wrong app does not count."""
        required = gate.relevant_checks({"docs/README.md"})
        runs = [check(n, "github-actions" if s == "coderabbitai" else s, cid=i)
                for i, (n, s) in enumerate(required.items(), 1)]
        errors = self.run_validate(checks=runs)
        self.assertTrue(any("Required check CodeRabbit" in e for e in errors))

    def test_additional_failing_lane_blocks(self):
        """Verify additional failing lane blocks."""
        required = gate.relevant_checks({"docs/README.md"})
        runs = all_green(required) + [check("Unlisted Lane", "github-actions", "failure", cid=77)]
        self.assertTrue(any("Unlisted Lane" in e for e in self.run_validate(checks=runs)))

    def test_forged_or_failed_external_status_blocks(self):
        """Verify forged or failed external status blocks."""
        forged = {"security/snyk (oasisbaklawa2006)": {"state": "success", "creator": {"login": "attacker"}},
                  "Vercel": {"state": "success", "creator": {"login": "vercel[bot]"}}}
        self.assertTrue(any("snyk" in e for e in self.run_validate(statuses=forged)))
        failed = {"security/snyk (oasisbaklawa2006)": {"state": "failure", "creator": {"login": "snyk-io[bot]"}},
                  "Vercel": {"state": "success", "creator": {"login": "vercel[bot]"}}}
        self.assertTrue(self.run_validate(statuses=failed))
        self.assertTrue(self.run_validate(statuses={}))

    def test_unresolved_threads_block(self):
        """Verify unresolved threads block."""
        self.assertTrue(any("Unresolved" in e for e in self.run_validate(threads=2)))

    def test_missing_approval_blocks(self):
        """Verify missing approval blocks."""
        self.assertTrue(any("No valid current-head approval" in e for e in self.run_validate(approved=False)))

    def test_coderabbit_actionable_blocks(self):
        """Verify coderabbit actionable blocks."""
        self.assertTrue(any(e.startswith("CodeRabbit review not clean") for e in self.run_validate(coderabbit=False)))

    def test_ruleset_problem_blocks_with_reason(self):
        """Verify ruleset problem blocks with reason."""
        errors = self.run_validate(ruleset=["governance ruleset: code-owner review is not enforced"])
        self.assertTrue(any(e.startswith("BLOCKED_RULESET") and "code-owner" in e for e in errors))

    def test_sensitive_change_requires_human_and_reports_paths(self):
        """Verify sensitive change requires human and reports paths."""
        files = ("src/lib/finance-authority/reverse.ts",)
        errors = self.run_validate(files=files, approved=False)
        self.assertTrue(any("Sensitive paths changed" in e and "finance-authority" in e for e in errors))
        self.assertEqual(self.approvals, [True])
        # With the required independent human approval the sensitive PR is not deadlocked by the gate itself.
        self.assertEqual(self.run_validate(files=files, approved=True), [])
        self.assertEqual(self.approvals, [True])

    def test_every_sensitive_class_forces_human_approval_requirement(self):
        """Verify every sensitive class forces human approval requirement."""
        for path in ("src/lib/auth/session.ts", "supabase/config.toml", ".github/workflows/new.yml",
                     "src/lib/dispatch-authority/gate.ts", "package.json", "scripts/point100-certification/a.mjs"):
            self.run_validate(files=(path,))
            self.assertEqual(self.approvals, [True], path)

    def test_rename_away_from_sensitive_path_is_still_sensitive(self):
        """Verify rename away from sensitive path is still sensitive."""
        errors = self.run_validate(files=("docs/moved.md",), renames={"docs/moved.md": "src/lib/finance-authority/old.ts"},
                                   approved=False)
        self.assertTrue(any("Sensitive paths changed" in e for e in errors))
        self.assertEqual(self.approvals, [True])

    def test_core_migration_in_central_blocks(self):
        """Verify core migration in central blocks."""
        errors = self.run_validate(files=("supabase/migrations/20261106_x.sql",))
        self.assertTrue(any("Core-owned migration" in e for e in errors))

    def test_draft_closed_stacked_and_conflicting_pr_block(self):
        """Verify draft closed stacked and conflicting pr block."""
        for override in ({"draft": True}, {"state": "closed"}, {"base": {"ref": "feature", "sha": BASE}},
                         {"mergeable": None}, {"mergeable": False}, {"mergeable_state": "dirty"},
                         {"mergeable_state": "unknown"}):
            self.assertTrue(self.run_validate(pr=base_pr(**override)), override)

    def test_evidence_only_candidate_never_eligible(self):
        """Verify evidence only candidate never eligible."""
        self.assertTrue(any("Evidence-only" in e for e in self.run_validate(pr=base_pr(number=651))))
        self.assertTrue(any("Evidence-only" in e for e in self.run_validate(pr=base_pr(title="X NOT FOR MERGE"))))

    def test_head_or_base_change_during_verification_blocks(self):
        """Verify head or base change during verification blocks."""
        moved_head = base_pr(head={"sha": "3" * 40})
        moved_base = base_pr(base={"ref": "main", "sha": "4" * 40})
        for now in (moved_head, moved_base):
            self.assertTrue(any("HEAD_OR_BASE_CHANGED" in e for e in self.run_validate(now_pr=now)))


class UpdateAndSweepTests(GateTestCase):
    """Group offline tests for update and sweep."""
    def test_exception_during_validation_publishes_failure_on_exact_head(self):
        """Verify exception during validation publishes failure on exact head."""
        posted = []
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", side_effect=gate.GateError("boom")), \
             mock.patch.object(gate, "latest_checks", return_value={}), \
             mock.patch.object(gate, "api", side_effect=lambda path, **kw: posted.append((path, kw))):
            gate.update_gate_check(700)
        (path, kw), = posted
        self.assertEqual(path, f"/repos/{gate.REPO}/check-runs")
        self.assertEqual(kw["data"]["head_sha"], SHA)
        self.assertEqual(kw["data"]["conclusion"], "failure")
        self.assertIn("BLOCKED_GATE_VERIFICATION", kw["data"]["output"]["summary"])

    def test_success_is_published_only_when_there_are_no_errors(self):
        """Verify success is published only when there are no errors."""
        posted = []
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", return_value=[]), \
             mock.patch.object(gate, "latest_checks", return_value={}), \
             mock.patch.object(gate, "api", side_effect=lambda path, **kw: posted.append(kw)):
            gate.update_gate_check(700)
        self.assertEqual(posted[0]["data"]["conclusion"], "success")

    def test_sweep_isolates_per_pr_failures_and_exits_non_zero(self):
        """Verify sweep isolates per pr failures and exits non zero."""
        calls = []
        def fake_update(number, mode="advisory"):
            """Record which pull request numbers the sweep attempts to update."""
            calls.append(number)
            if number == 2:
                raise RuntimeError("transient")
        prs = [{"number": 1, "base": {"ref": "main"}}, {"number": 2, "base": {"ref": "main"}},
               {"number": 3, "base": {"ref": "main"}}, {"number": 4, "base": {"ref": "feature"}}]
        env = {"GITHUB_REPOSITORY": gate.REPO}
        with mock.patch.dict(gate.os.environ, env, clear=False), \
             mock.patch.dict(gate.os.environ, {"APPVERSE_PR_NUMBER": ""}), \
             mock.patch.object(gate, "paginated", return_value=prs), \
             mock.patch.object(gate, "update_gate_check", side_effect=fake_update):
            with self.assertRaises(SystemExit) as raised:
                gate.main()
        self.assertEqual(calls, [1, 2, 3])  # #3 still evaluated after #2 failed; stacked #4 skipped
        self.assertIn("#2", str(raised.exception))

    def test_wrong_repository_and_bad_pr_number_fail_closed(self):
        """Verify wrong repository and bad pr number fail closed."""
        with mock.patch.dict(gate.os.environ, {"GITHUB_REPOSITORY": "someone/else"}):
            with self.assertRaises(SystemExit):
                gate.main()
        for bad in ("12; rm -rf /", "../../etc/passwd", "１２", "-1", "1.5"):
            with mock.patch.dict(gate.os.environ, {"GITHUB_REPOSITORY": gate.REPO, "APPVERSE_PR_NUMBER": bad}):
                with self.assertRaises(SystemExit):
                    gate.main()


class ControllerCannotMergeTests(GateTestCase):
    """The controller is an evaluator, never an actuator. These tests make that structural."""

    def test_writes_other_than_its_own_check_run_are_refused(self):
        """Verify writes other than its own check run are refused."""
        original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(original)
        with mock.patch.dict(original.os.environ, {ENV_API: DUMMY_CREDENTIAL}), \
             mock.patch.object(original.http.client, "HTTPSConnection") as conn:
            for method, path in (
                ("POST", f"/repos/{original.REPO}/pulls/1/merge"),
                ("POST", f"/repos/{original.REPO}/pulls/1/reviews"),
                ("POST", f"/repos/{original.REPO}/issues/1/comments"),
                ("POST", f"/repos/{original.REPO}/rulesets/19200597"),
                ("PUT", f"/repos/{original.REPO}/pulls/1/merge"),
                ("PATCH", f"/repos/{original.REPO}/rulesets/1"),
                ("DELETE", f"/repos/{original.REPO}/git/refs/heads/main"),
            ):
                with self.assertRaises(original.GateError, msg=f"{method} {path}"):
                    original.api(path, method=method, data={})
            conn.assert_not_called()  # refused before any socket is opened

    def test_graphql_mutations_are_refused(self):
        """Verify graphql mutations are refused."""
        original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(original)
        for query in ("mutation { enablePullRequestAutoMerge(input:{}) { clientMutationId } }",
                      "  MUTATION x { mergePullRequest(input:{}) { clientMutationId } }"):
            with self.assertRaises(original.GateError):
                original.graphql(query, {})

    def test_invalid_paths_are_refused(self):
        """Verify invalid paths are refused."""
        original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(original)
        with mock.patch.dict(original.os.environ, {ENV_API: DUMMY_CREDENTIAL}):
            for path in ("https://evil.example/x", "repos/x", "/repos/x\r\nHost: evil", "/repos/x y"):
                with self.assertRaises(original.GateError, msg=path):
                    original.api(path)

    def test_source_contains_no_merge_or_auto_merge_endpoints(self):
        """Verify source contains no merge or auto merge endpoints."""
        source = (ROOT / "scripts/appverse-control/appverse_merge_gate.py").read_text()
        for forbidden in ("/merge", "auto_merge", "enablePullRequestAutoMerge", "mergePullRequest",
                          "pull_request_target", "subprocess", "os.system", "eval(", "exec("):
            self.assertNotIn(forbidden, source, forbidden)


class TransportTests(GateTestCase):
    """Group offline tests for transport."""
    def setUp(self):
        """Prepare isolated mocks and fixtures for the next test."""
        super().setUp()
        self.original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(self.original)
        env = mock.patch.dict(self.original.os.environ, {ENV_API: DUMMY_CREDENTIAL})
        env.start()
        self.addCleanup(env.stop)
        sleeper = mock.patch.object(self.original.time, "sleep")
        sleeper.start()
        self.addCleanup(sleeper.stop)

    def response(self, status, payload=None):
        """Build a mocked HTTP response for transport tests."""
        r = mock.Mock()
        r.status = status
        r.read.return_value = json.dumps(payload if payload is not None else {}).encode()
        return r

    def test_get_retries_transient_failures_then_succeeds(self):
        """Verify get retries transient failures then succeeds."""
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.side_effect = [self.response(503), self.response(502),
                                                          self.response(200, {"ok": True})]
            self.assertEqual(self.original.api("/repos/x"), {"ok": True})
            self.assertEqual(conn.return_value.getresponse.call_count, 3)

    def test_get_gives_up_and_fails_closed(self):
        """Verify get gives up and fails closed."""
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.return_value = self.response(503)
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")

    def test_client_errors_are_not_retried(self):
        """Verify client errors are not retried."""
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.return_value = self.response(404)
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")
            self.assertEqual(conn.return_value.getresponse.call_count, 1)

    def test_post_is_never_retried(self):
        """Verify post is never retried."""
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.return_value = self.response(503)
            with self.assertRaises(self.original.GateError):
                self.original.api(f"/repos/{self.original.REPO}/check-runs", method="POST", data={})
            self.assertEqual(conn.return_value.getresponse.call_count, 1)

    def test_network_errors_become_gate_errors_and_token_goes_only_to_api_host(self):
        """Verify network errors become gate errors and token goes only to api host."""
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.request.side_effect = OSError("down")
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")
            host_args = {call.args[0] for call in conn.call_args_list}
            self.assertEqual(host_args, {"api.github.com"})

    def test_invalid_json_fails_closed(self):
        """Verify invalid json fails closed."""
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            bad = mock.Mock(status=200)
            bad.read.return_value = b"<html>"
            conn.return_value.getresponse.return_value = bad
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")

    def test_pagination_over_limit_fails_closed(self):
        """Verify pagination over limit fails closed."""
        with mock.patch.object(self.original, "api", return_value=[{}] * 100):
            with self.assertRaises(self.original.GateError):
                self.original.paginated("/repos/x/list")

    def test_non_list_pagination_response_fails_closed(self):
        """Verify non list pagination response fails closed."""
        with mock.patch.object(self.original, "api", return_value={"message": "oops"}):
            with self.assertRaises(self.original.GateError):
                self.original.paginated("/repos/x/list")


class SpoofDetectionTests(GateTestCase):
    """The gate's authoritative name carries authority only when published by the dedicated App."""

    def test_check_with_the_gate_name_from_actions_is_a_spoof(self):
        """Verify check with the gate name from actions is a spoof."""
        checks = {(gate.CHECK_NAME, "github-actions"): check(gate.CHECK_NAME, "github-actions", app_id=gate.GITHUB_ACTIONS_APP_ID)}
        self.assertEqual(gate.foreign_gate_checks(checks), ["github-actions"])

    def test_check_with_the_gate_name_from_any_other_app_or_unknown_app_is_a_spoof(self):
        """Verify check with the gate name from any other app or unknown app is a spoof."""
        for app_id in (1, 999999, None):
            checks = {(gate.CHECK_NAME, "evil-app"): check(gate.CHECK_NAME, "evil-app", app_id=app_id)}
            self.assertEqual(gate.foreign_gate_checks(checks), ["evil-app"], app_id)

    def test_check_from_the_dedicated_app_is_not_a_spoof(self):
        """Verify check from the dedicated app is not a spoof."""
        checks = {(gate.CHECK_NAME, "oasis-appverse-merge-gate"):
                  check(gate.CHECK_NAME, "oasis-appverse-merge-gate", app_id=gate.GATE_APP_ID)}
        self.assertEqual(gate.foreign_gate_checks(checks), [])

    def test_advisory_name_is_not_flagged_and_other_checks_are_ignored(self):
        """Verify advisory name is not flagged and other checks are ignored."""
        checks = {(gate.ADVISORY_CHECK_NAME, "github-actions"): check(gate.ADVISORY_CHECK_NAME, "github-actions", app_id=15368),
                  ("CodeRabbit", "coderabbitai"): check("CodeRabbit", "coderabbitai", app_id=1)}
        self.assertEqual(gate.foreign_gate_checks(checks), [])

    def test_validate_reports_the_spoof_attempt(self):
        """Verify validate reports the spoof attempt."""
        required = gate.relevant_checks({"docs/README.md"})
        runs = all_green(required) + [check(gate.CHECK_NAME, "github-actions", app_id=gate.GITHUB_ACTIONS_APP_ID, cid=900)]
        errors = ValidateMatrixTests("run_validate").run_validate(checks=runs)
        self.assertTrue(any(e.startswith("SPOOF_ATTEMPT") and "github-actions" in e for e in errors), errors)

    def test_a_branch_workflow_posting_the_gate_name_cannot_make_the_ruleset_pass(self):
        """Verify a branch workflow posting the gate name cannot make the ruleset pass."""
        # The ruleset pin is the real control: an entry pinned to Actions is itself reported as unsafe.
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"][0]["integration_id"] = gate.GITHUB_ACTIONS_APP_ID
        with mock.patch.object(gate, "api", side_effect=[rule, ok_governance()]):
            self.assertFalse(gate.configured_ruleset())


class CredentialIdentityTests(GateTestCase):
    """Group offline tests for credential identity."""
    def setUp(self):
        """Prepare isolated mocks and fixtures for the next test."""
        super().setUp()
        self.original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(self.original)

    def request(self, identity, env):
        """Record a GitHub API request in an isolated test double."""
        with mock.patch.dict(self.original.os.environ, env, clear=True), \
             mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            response = mock.Mock(status=200)
            response.read.return_value = b"{}"
            conn.return_value.getresponse.return_value = response
            self.original.api("/repos/x", identity=identity)
            return conn.return_value.request.call_args.kwargs["headers"]["Authorization"]

    def test_each_identity_sends_only_its_own_credential(self):
        """Verify each identity sends only its own credential."""
        creds = env(actions="credential-one", app="credential-two")
        self.assertEqual(self.request("actions", creds), "Bearer credential-one")
        self.assertEqual(self.request("app", creds), "Bearer credential-two")

    def test_missing_credential_and_unknown_identity_fail_closed(self):
        """Verify missing credential and unknown identity fail closed."""
        with mock.patch.dict(self.original.os.environ, env(actions=True), clear=True):
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x", identity="app")
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x", identity="root")

    def test_ruleset_reads_prefer_the_dedicated_app_credential_when_present(self):
        """Verify ruleset reads prefer the dedicated app credential when present."""
        with mock.patch.dict(self.original.os.environ, env(actions=True, app=True), clear=True):
            self.assertEqual(self.original.ruleset_identity(), "app")
        with mock.patch.dict(self.original.os.environ, env(actions=True), clear=True):
            self.assertEqual(self.original.ruleset_identity(), "actions")

    def test_ruleset_requests_use_that_identity(self):
        """Verify ruleset requests use that identity."""
        seen = []
        def fake(path, **kw):
            """Return synthetic GitHub evidence for the current test."""
            seen.append(kw.get("identity"))
            return ok_status_rule() if str(gate.RULESET_ID) in path else ok_governance()
        with mock.patch.dict(gate.os.environ, env(actions=True, app=True), clear=True), \
             mock.patch.object(gate, "api", side_effect=fake):
            self.assertEqual(gate.ruleset_problems(), [])
        self.assertEqual(seen, ["app", "app"])


def environment_api(*, custom=True, branches=("main",), error=None):
    """Simulate the GitHub environment settings endpoint."""
    def fake(path, **kw):
        """Return synthetic GitHub evidence for the current test."""
        if error:
            raise gate.GateError(error)
        if path.endswith("/deployment-branch-policies"):
            return {"branch_policies": [{"name": b, "type": "branch"} for b in branches]}
        return {"deployment_branch_policy": {"protected_branches": False, "custom_branch_policies": custom}}
    return fake


NOW = datetime.datetime(2026, 11, 7, 12, 0, 0, tzinfo=datetime.timezone.utc)


def iso(moment):
    """Format the supplied test timestamp as a UTC ISO timestamp."""
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


class FakeGitHub:
    """In-memory GitHub for the publication tests: check-runs accumulate per SHA and the newest one wins, the
    environment endpoints answer from a policy, and POSTs can be made to fail. Nothing here touches the network."""

    def __init__(self, *, environment=None, now=NOW):
        """Initialize the in-memory GitHub simulation and its check history."""
        self.runs = []
        self.posts = []
        self.environment = environment or environment_api()
        self.now = now
        self.next_id = 1000
        self.listing_error = None
        self.post_error = None
        self.hide_new_runs = False  # simulate GitHub not showing a freshly posted run as the newest

    def add_run(self, *, name=None, app_id=None, conclusion="success", head=SHA, number=700, completed=None, summary=None):
        """Append a synthetic check run to the in-memory GitHub timeline."""
        self.next_id += 1
        run = {"id": self.next_id, "name": name or gate.CHECK_NAME, "head_sha": head, "status": "completed",
               "conclusion": conclusion, "app": {"id": app_id if app_id is not None else gate.GATE_APP_ID, "slug": "gate-app"},
               "external_id": f"appverse-pr-{number}-{head}", "started_at": iso(completed or self.now),
               "completed_at": iso(completed or self.now), "output": {"summary": summary or ""}}
        self.runs.append(run)
        return run

    def api(self, path, **kw):
        """Simulate read and check-publication GitHub API operations."""
        if kw.get("method") == "POST":
            if self.post_error:
                raise self.post_error
            self.posts.append((path, kw))
            run = self.add_run(name=kw["data"]["name"], conclusion=kw["data"]["conclusion"], head=kw["data"]["head_sha"],
                               app_id=gate.GATE_APP_ID if kw.get("identity") == "app" else gate.GITHUB_ACTIONS_APP_ID,
                               summary=kw["data"]["output"]["summary"], completed=self.now)
            if self.hide_new_runs:
                self.runs.remove(run)
            return {"id": run["id"], "app": run["app"]}
        return self.environment(path, **kw)

    def paginated(self, path, key=None):
        """Return synthetic paginated GitHub API collections."""
        if path.endswith("/check-runs"):
            if self.listing_error:
                raise gate.GateError(self.listing_error)
            return list(self.runs)
        raise AssertionError(f"unexpected list request {path}")

    def newest(self, name=None):
        """Select the latest check run for the requested identity."""
        runs = [r for r in self.runs if r["name"] == (name or gate.CHECK_NAME)]
        return max(runs, key=lambda r: r["id"]) if runs else None


APP_ENV = env(actions=True, app=True)


def run_update(fake, mode, *, errors=(), validate_error=None, env_vars=None, pr=None, number=700):
    """Evaluate and publish a gate check against the in-memory GitHub fixture."""
    validator = mock.Mock(side_effect=validate_error) if validate_error else mock.Mock(return_value=list(errors))
    with mock.patch.dict(gate.os.environ, env_vars if env_vars is not None else APP_ENV, clear=True), \
         mock.patch.object(gate, "current_pr", return_value=pr or base_pr()), \
         mock.patch.object(gate, "validate", validator), \
         mock.patch.object(gate, "utc_now", return_value=fake.now), \
         mock.patch.object(gate, "paginated", side_effect=fake.paginated), \
         mock.patch.object(gate, "api", side_effect=fake.api):
        gate.update_gate_check(number, mode)


class PublicationTests(GateTestCase):
    """Group offline tests for publication."""
    def test_advisory_mode_publishes_only_the_advisory_name_with_the_actions_identity(self):
        """Verify advisory mode publishes only the advisory name with the actions identity."""
        fake = FakeGitHub()
        run_update(fake, "advisory", env_vars=env(actions=True))
        (path, kw), = fake.posts
        self.assertEqual(kw["data"]["name"], gate.ADVISORY_CHECK_NAME)
        self.assertEqual(kw["identity"], "actions")
        self.assertIn("advisory", kw["data"]["output"]["title"])

    def test_advisory_mode_can_never_publish_the_authoritative_name(self):
        """Verify advisory mode can never publish the authoritative name."""
        for errors in ((), ("x",)):
            fake = FakeGitHub()
            run_update(fake, "advisory", errors=errors, env_vars=env(actions=True))
            self.assertTrue(all(kw["data"]["name"] != gate.CHECK_NAME for _, kw in fake.posts))

    def test_authoritative_publication_uses_the_dedicated_app_exact_head_and_a_freshness_stamp(self):
        """Verify authoritative publication uses the dedicated app exact head and a freshness stamp."""
        fake = FakeGitHub()
        run_update(fake, "authoritative")
        (path, kw), = fake.posts
        self.assertEqual((kw["data"]["name"], kw["identity"], kw["data"]["head_sha"], kw["data"]["conclusion"]),
                         (gate.CHECK_NAME, "app", SHA, "success"))
        summary = kw["data"]["output"]["summary"]
        self.assertIn("Evaluated at 2026-11-07T12:00:00Z", summary)
        self.assertIn(f"stale after {gate.FRESHNESS_SECONDS}s", summary)
        self.assertIn("native auto-merge stays disabled", summary)
        self.assertEqual(fake.newest()["conclusion"], "success")

    def test_unknown_mode_is_refused(self):
        """Verify unknown mode is refused."""
        with self.assertRaises(gate.GateError):
            gate.update_gate_check(700, "both")


class StaleAuthoritativeSuccessTests(GateTestCase):
    """A required check cannot be revoked by anyone except its publisher. These scenarios pin down exactly what the code
    can enforce (supersede with a FAILURE, or fail loudly) and what it cannot (anything when the publisher is gone)."""

    def prior_success(self, fake, age_seconds=60):
        """Create a previously successful gate check with adjustable age."""
        return fake.add_run(conclusion="success", completed=fake.now - datetime.timedelta(seconds=age_seconds))

    def test_every_revoking_change_supersedes_a_prior_success_with_a_failure(self):
        """Verify every revoking change supersedes a prior success with a failure."""
        scenarios = {
            "approval revoked": ["No valid current-head approval"],
            "review blocked": ["CodeRabbit review not clean: 2 actionable finding(s) reported on this head"],
            "required check failed": ["Required check Typecheck not PASS: completed/failure"],
            "unresolved thread": ["Unresolved independent review threads"],
            "sensitive path needs human": ["Sensitive paths changed (src/lib/auth/session.ts): an independent trusted human code-owner approval"],
        }
        for name, errors in scenarios.items():
            fake = FakeGitHub()
            old = self.prior_success(fake)
            run_update(fake, "authoritative", errors=errors)
            newest = fake.newest()
            self.assertEqual(newest["conclusion"], "failure", name)
            self.assertGreater(newest["id"], old["id"], name)

    def test_a_verification_error_also_supersedes_a_prior_success_with_a_failure(self):
        """Verify a verification error also supersedes a prior success with a failure."""
        fake = FakeGitHub()
        old = self.prior_success(fake)
        run_update(fake, "authoritative", validate_error=gate.GateError("rulesets unreadable"))
        newest = fake.newest()
        self.assertEqual(newest["conclusion"], "failure")
        self.assertIn("BLOCKED_GATE_VERIFICATION", newest["output"]["summary"])
        self.assertGreater(newest["id"], old["id"])

    def test_publisher_unavailable_fails_loudly_and_never_pretends_the_old_success_is_valid(self):
        """Verify publisher unavailable fails loudly and never pretends the old success is valid."""
        cases = {
            "missing App token": (env(actions=True), environment_api()),
            "environment not restricted": (APP_ENV, environment_api(custom=False)),
            "environment allows other branches": (APP_ENV, environment_api(branches=("main", "feature"))),
            "expired or rejected token (401)": (APP_ENV, environment_api(error="GitHub API GET /environments: HTTP 401")),
            "environment unreadable (403)": (APP_ENV, environment_api(error="HTTP 403")),
        }
        for name, (env_vars, environment) in cases.items():
            fake = FakeGitHub(environment=environment)
            self.prior_success(fake)
            with self.assertRaises(gate.GateError) as raised:
                run_update(fake, "authoritative", env_vars=env_vars)
            message = str(raised.exception)
            self.assertIn("AUTHORITATIVE_PUBLICATION_WITHHELD", message, name)
            self.assertIn("PRIOR authoritative SUCCESS exists on this head and is now STALE", message, name)
            self.assertEqual(fake.posts, [], name)

    def test_withheld_message_distinguishes_no_prior_success_and_unknown(self):
        """Verify withheld message distinguishes no prior success and unknown."""
        fake = FakeGitHub()
        with self.assertRaises(gate.GateError) as raised:
            run_update(fake, "authoritative", env_vars=env(actions=True))
        self.assertIn("no authoritative success exists on this head", str(raised.exception))
        fake = FakeGitHub()
        fake.listing_error = "listing down"
        with self.assertRaises(gate.GateError) as raised:
            run_update(fake, "authoritative", env_vars=env(actions=True))
        self.assertIn("could not be determined: assume it is STALE", str(raised.exception))

    def test_a_failing_idempotency_lookup_never_suppresses_publication(self):
        """Verify a failing idempotency lookup never suppresses publication."""
        fake = FakeGitHub()
        calls = {"n": 0}
        original = fake.paginated

        def flaky(path, key=None):
            """Simulate a transient GitHub lookup failure."""
            calls["n"] += 1
            if calls["n"] == 1:  # the optimisation lookup fails; the later read-back works
                raise gate.GateError("transient")
            return original(path, key)
        fake.paginated = flaky
        run_update(fake, "authoritative", errors=["blocked"])
        self.assertEqual(len(fake.posts), 1)
        self.assertEqual(fake.newest()["conclusion"], "failure")

    def test_a_rejected_post_is_not_swallowed(self):
        """Verify a rejected post is not swallowed."""
        fake = FakeGitHub()
        fake.post_error = gate.GateError("GitHub API POST /check-runs: HTTP 422")  # e.g. unknown or rejected source SHA
        self.prior_success(fake)
        with self.assertRaises(gate.GateError):
            run_update(fake, "authoritative", errors=["blocked"])

    def test_unconfirmed_supersession_is_reported_not_assumed(self):
        """Verify unconfirmed supersession is reported not assumed."""
        fake = FakeGitHub()
        self.prior_success(fake)
        fake.hide_new_runs = True
        with self.assertRaises(gate.GateError) as raised:
            run_update(fake, "authoritative", errors=["blocked"])
        self.assertIn("SUPERSESSION_NOT_CONFIRMED", str(raised.exception))

    def test_authoritative_check_from_the_wrong_app_is_reported(self):
        """Verify authoritative check from the wrong app is reported."""
        fake = FakeGitHub()
        real = fake.api

        def wrong_app(path, **kw):
            """Simulate a gate check published from an untrusted App identity."""
            result = real(path, **kw)
            if kw.get("method") == "POST":
                result = dict(result, app={"id": gate.GITHUB_ACTIONS_APP_ID})
            return result
        fake.api = wrong_app
        with self.assertRaises(gate.GateError):
            run_update(fake, "authoritative")

    def test_unchanged_verdict_is_skipped_only_while_the_earlier_result_is_fresh(self):
        """Verify unchanged verdict is skipped only while the earlier result is fresh."""
        fake = FakeGitHub()
        _, body = gate.verdict_and_summary(700, SHA, [])
        fresh = fake.add_run(completed=NOW - datetime.timedelta(seconds=60), summary=body + "\n\nEvaluated at x")
        run_update(fake, "authoritative")
        self.assertEqual(fake.posts, [], "fresh and identical: nothing to republish")
        fake.runs.remove(fresh)
        fake.add_run(completed=NOW - datetime.timedelta(seconds=gate.FRESHNESS_SECONDS), summary=body + "\n\nEvaluated at x")
        run_update(fake, "authoritative")
        self.assertEqual(len(fake.posts), 1, "identical but no longer fresh: must be re-stamped")

    def test_a_same_named_advisory_check_from_another_app_never_suppresses_the_advisory_publication(self):
        """Verify a same named advisory check from another app never suppresses the advisory publication."""
        fake = FakeGitHub()
        _, body = gate.verdict_and_summary(700, SHA, [])
        fake.add_run(name=gate.ADVISORY_CHECK_NAME, app_id=1234, completed=NOW, summary=body)  # some other app
        run_update(fake, "advisory", env_vars=env(actions=True))
        self.assertEqual(len(fake.posts), 1, "only the Actions app's own earlier advisory result may be reused")

    def test_the_actions_apps_own_fresh_identical_advisory_result_is_reused(self):
        """Verify the actions apps own fresh identical advisory result is reused."""
        fake = FakeGitHub()
        _, body = gate.verdict_and_summary(700, SHA, [])
        fake.add_run(name=gate.ADVISORY_CHECK_NAME, app_id=gate.GITHUB_ACTIONS_APP_ID, completed=NOW, summary=body)
        run_update(fake, "advisory", env_vars=env(actions=True))
        self.assertEqual(fake.posts, [])

    def test_a_spoofed_identical_check_never_suppresses_the_genuine_publication(self):
        """Verify a spoofed identical check never suppresses the genuine publication."""
        fake = FakeGitHub()
        _, body = gate.verdict_and_summary(700, SHA, [])
        fake.add_run(app_id=gate.GITHUB_ACTIONS_APP_ID, completed=NOW, summary=body)
        run_update(fake, "authoritative")
        self.assertEqual(len(fake.posts), 1)


class MergeActorFreshnessTests(GateTestCase):
    """What the merge actor must check, because a required check cannot expire on its own."""

    def good(self, **overrides):
        """Create a valid current-head authoritative success fixture."""
        check = {"name": gate.CHECK_NAME, "app": {"id": gate.GATE_APP_ID}, "status": "completed", "conclusion": "success",
                 "head_sha": SHA, "external_id": f"appverse-pr-700-{SHA}", "completed_at": iso(NOW - datetime.timedelta(seconds=30))}
        check.update(overrides)
        return check

    def test_a_fresh_exact_head_dedicated_app_success_has_no_problems(self):
        """Verify a fresh exact head dedicated app success has no problems."""
        self.assertEqual(gate.authoritative_success_problems(self.good(), SHA, NOW), [])

    def test_each_defect_is_reported(self):
        """Verify each defect is reported."""
        cases = {
            "wrong name": {"name": "Appverse Merge Gate (advisory)"},
            "wrong app": {"app": {"id": gate.GITHUB_ACTIONS_APP_ID}},
            "failure": {"conclusion": "failure"},
            "in progress": {"status": "in_progress", "conclusion": None},
            "other head": {"head_sha": "9" * 40},
            "external id for another head": {"external_id": "appverse-pr-700-" + "9" * 40},
            "stale": {"completed_at": iso(NOW - datetime.timedelta(seconds=gate.FRESHNESS_SECONDS + 1))},
            "no completion time": {"completed_at": None},
            "future completion time": {"completed_at": iso(NOW + datetime.timedelta(hours=1))},
        }
        for name, override in cases.items():
            self.assertTrue(gate.authoritative_success_problems(self.good(**override), SHA, NOW), name)

    def test_evaluate_is_read_only_and_reports_ineligibility(self):
        """Verify evaluate is read only and reports ineligibility."""
        def read_only_api(path, **kw):
            """Reject writes while returning simulated read-only API evidence."""
            self.assertNotEqual(kw.get("method"), "POST", "evaluate() must never write")
            raise AssertionError("evaluate must go through patched helpers only")
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", return_value=["No valid current-head approval"]), \
             mock.patch.object(gate, "api", side_effect=read_only_api):
            result = gate.evaluate(700)
        self.assertFalse(result["eligible"])
        self.assertEqual(result["head"], SHA)
        self.assertIn("DISABLED", result["native_automerge"])

    def test_evaluate_pins_the_expected_head(self):
        """Verify evaluate pins the expected head."""
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), mock.patch.object(gate, "validate", return_value=[]):
            self.assertTrue(gate.evaluate(700, SHA)["eligible"])
            moved = gate.evaluate(700, "9" * 40)
        self.assertFalse(moved["eligible"])
        self.assertTrue(moved["errors"][0].startswith("HEAD_MISMATCH"))

    def test_evaluate_turns_verification_errors_into_ineligible(self):
        """Verify evaluate turns verification errors into ineligible."""
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", side_effect=gate.GateError("rulesets unreadable")):
            result = gate.evaluate(700)
        self.assertFalse(result["eligible"])
        self.assertIn("BLOCKED_GATE_VERIFICATION", result["errors"][0])

    def test_evaluate_fails_closed_when_the_first_pr_read_fails(self):
        """Verify evaluate fails closed when the first pr read fails."""
        with mock.patch.object(gate, "current_pr", side_effect=gate.GateError("GitHub API GET /pulls/700: HTTP 502")):
            result = gate.evaluate(700, SHA)
        self.assertFalse(result["eligible"])
        self.assertIsNone(result["head"])
        self.assertIn("BLOCKED_GATE_VERIFICATION", result["errors"][0])
        self.assertIn("DISABLED", result["native_automerge"])

    def test_cli_prints_blocked_json_and_exits_3_when_the_first_pr_read_fails(self):
        """Verify cli prints blocked json and exits 3 when the first pr read fails."""
        import contextlib
        import io
        buffer = io.StringIO()
        with mock.patch.object(gate, "current_pr", side_effect=gate.GateError("HTTP 502")), contextlib.redirect_stdout(buffer):
            code = gate.run_evaluate(["--evaluate", "700"])
        self.assertEqual(code, 3)
        printed = json.loads(buffer.getvalue())
        self.assertFalse(printed["eligible"])

    def test_cli_turns_any_unexpected_evaluate_error_into_blocked_json_and_exit_3(self):
        """Verify cli turns any unexpected evaluate error into blocked json and exit 3."""
        import contextlib
        import io
        buffer = io.StringIO()
        with mock.patch.object(gate, "evaluate", side_effect=RuntimeError("boom")), contextlib.redirect_stdout(buffer):
            code = gate.run_evaluate(["--evaluate", "700"])
        self.assertEqual(code, 3)
        self.assertFalse(json.loads(buffer.getvalue())["eligible"])

    def test_cli_exit_codes(self):
        """Verify cli exit codes."""
        with mock.patch.object(gate, "evaluate", return_value={"eligible": True, "errors": []}):
            self.assertEqual(gate.run_evaluate(["--evaluate", "700"]), 0)
        with mock.patch.object(gate, "evaluate", return_value={"eligible": False, "errors": ["x"]}):
            self.assertEqual(gate.run_evaluate(["--evaluate", "700", "--expect-sha", SHA]), 3)
        for bad in (["--evaluate"], ["--evaluate", "7;rm"], ["--evaluate", "7", "--expect-sha", "nothex"],
                    ["--evaluate", "7", "--expect-sha"]):
            self.assertEqual(gate.run_evaluate(bad), 2, bad)

    def test_main_evaluate_mode_needs_the_right_repository(self):
        """Verify main evaluate mode needs the right repository."""
        with mock.patch.dict(gate.os.environ, {"GITHUB_REPOSITORY": "someone/else"}, clear=True):
            with self.assertRaises(SystemExit):
                gate.main(["--evaluate", "700"])


class GateAuthorityNameTests(GateTestCase):
    """Group offline tests for gate authority name."""
    def test_dedicated_app_check_under_a_different_name_is_reported_as_a_mismatch(self):
        """Verify dedicated app check under a different name is reported as a mismatch."""
        checks = {("Oasis Appverse Merge Gate", "gate-app"): check("Oasis Appverse Merge Gate", "gate-app", app_id=gate.GATE_APP_ID)}
        self.assertEqual(gate.unrecognised_gate_app_checks(checks), ["Oasis Appverse Merge Gate"])
        required = gate.relevant_checks({"docs/README.md"})
        errors = ValidateMatrixTests("run_validate").run_validate(checks=all_green(required) + list(
            [check("Oasis Appverse Merge Gate", "gate-app", app_id=gate.GATE_APP_ID, cid=901)]))
        self.assertTrue(any(e.startswith("NAME_MISMATCH") and "Oasis Appverse Merge Gate" in e for e in errors), errors)

    def test_the_authoritative_name_from_the_dedicated_app_and_other_apps_names_are_not_mismatches(self):
        """Verify the authoritative name from the dedicated app and other apps names are not mismatches."""
        checks = {(gate.CHECK_NAME, "gate-app"): check(gate.CHECK_NAME, "gate-app", app_id=gate.GATE_APP_ID),
                  ("CodeRabbit", "coderabbitai"): check("CodeRabbit", "coderabbitai", app_id=1),
                  (gate.ADVISORY_CHECK_NAME, "github-actions"): check(gate.ADVISORY_CHECK_NAME, "github-actions", app_id=15368)}
        self.assertEqual(gate.unrecognised_gate_app_checks(checks), [])

    def test_there_is_exactly_one_authoritative_name_and_one_authoritative_app(self):
        """Verify there is exactly one authoritative name and one authoritative app."""
        self.assertEqual(gate.CHECK_NAME, "Appverse Merge Gate")
        self.assertEqual(gate.GATE_APP_ID, 5645415)
        self.assertEqual(sum(1 for value in vars(gate).values() if value == gate.GATE_APP_ID), 1)


class UnreadableEvidenceTests(GateTestCase):
    """Group offline tests for unreadable evidence."""
    def test_unreadable_rulesets_become_a_published_failure_not_a_pass(self):
        """Verify unreadable rulesets become a published failure not a pass."""
        fake = FakeGitHub()
        real_environment = fake.environment

        def rulesets_down(path, **kw):
            """Simulate a ruleset API outage."""
            if "/rulesets/" in path:
                raise gate.GateError("GitHub API GET rulesets: HTTP 403")
            return real_environment(path, **kw)
        fake.environment = rulesets_down
        pr = base_pr()
        with mock.patch.dict(gate.os.environ, APP_ENV, clear=True), \
             mock.patch.object(gate, "current_pr", return_value=pr), \
             mock.patch.object(gate, "utc_now", return_value=fake.now), \
             mock.patch.object(gate, "paginated", side_effect=fake.paginated), \
             mock.patch.object(gate, "api", side_effect=fake.api):
            gate.update_gate_check(700, "authoritative")
        newest = fake.newest()
        self.assertEqual(newest["conclusion"], "failure")
        self.assertIn("BLOCKED_GATE_VERIFICATION", newest["output"]["summary"])


class CodeRabbitReviewSemanticsTests(GateTestCase):
    """Group offline tests for code rabbit review semantics."""
    FIXTURES = pathlib.Path(__file__).resolve().parent / "fixtures" / "coderabbit"

    def body(self, name):
        """Read a saved CodeRabbit review fixture."""
        return (self.FIXTURES / name).read_text()

    def problems(self, body, *, state="COMMENTED", inline=0, sha=SHA, review_sha=SHA):
        """Evaluate CodeRabbit review evidence through the gate parser."""
        review = {"id": 77, "user": {"login": "coderabbitai[bot]"}, "state": state, "commit_id": review_sha, "body": body}
        comments = [{"user": {"login": "coderabbitai[bot]"}, "pull_request_review_id": 77, "in_reply_to_id": None}] * inline

        def fake(path, key=None):
            """Return synthetic GitHub evidence for the current test."""
            return [review] if path.endswith("/reviews") else comments
        with mock.patch.object(gate, "paginated", side_effect=fake):
            return gate.coderabbit_review_problems(1, sha)

    def test_real_fixtures_parse_the_way_coderabbit_actually_writes_them(self):
        """Verify real fixtures parse the way coderabbit actually writes them."""
        no_marker = gate.parse_coderabbit_review(self.body("pr655-36f230b9-no-marker-failed-premerge.html"))
        self.assertEqual((no_marker["genuine"], no_marker["actionable"], no_marker["nitpicks"], no_marker["failed_premerge"]),
                         (True, None, 0, ["Docstring Coverage"]))
        nitpick = gate.parse_coderabbit_review(self.body("pr655-2d7560a6-nitpick-failed-premerge.html"))
        self.assertEqual((nitpick["actionable"], nitpick["nitpicks"], nitpick["failed_premerge"]), (None, 1, ["Docstring Coverage"]))
        two = gate.parse_coderabbit_review(self.body("pr656-c4848b81-two-actionable.html"))
        self.assertEqual((two["actionable"], two["failed_premerge"]), (2, ["Docstring Coverage"]))

    def test_actionable_findings_block(self):
        """Verify actionable findings block."""
        problems = self.problems(self.body("pr656-c4848b81-two-actionable.html"))
        self.assertTrue(any("2 actionable finding(s)" in p for p in problems), problems)

    def test_a_failed_premerge_check_blocks_even_without_actionable_findings(self):
        """Verify a failed premerge check blocks even without actionable findings."""
        problems = self.problems(self.body("pr655-36f230b9-no-marker-failed-premerge.html"))
        self.assertEqual(problems, ["failed pre-merge check(s): Docstring Coverage"])

    def test_an_explicit_zero_marker_next_to_a_failed_premerge_check_is_not_clean(self):
        """Verify an explicit zero marker next to a failed premerge check is not clean."""
        body = self.body("pr655-36f230b9-no-marker-failed-premerge.html") + "\n**Actionable comments posted: 0**"
        self.assertTrue(self.problems(body))

    def test_marker_absent_zero_inline_and_no_failed_premerge_is_clean(self):
        """Verify marker absent zero inline and no failed premerge is clean."""
        body = self.body("pr655-36f230b9-no-marker-failed-premerge.html")
        cleaned = body.replace("Failed pre-merge checks:", "Passed pre-merge checks:")
        self.assertEqual(self.problems(cleaned), [])

    def test_explicit_zero_marker_and_no_failures_is_clean(self):
        """Verify explicit zero marker and no failures is clean."""
        self.assertEqual(self.problems("<!-- coderabbit-ai-generated:v1 -->\n**Actionable comments posted: 0**"), [])

    def test_nitpicks_alone_do_not_block(self):
        """Verify nitpicks alone do not block."""
        body = "<!-- coderabbit-ai-generated:v1 -->\n Nitpick comments: 3\n"
        self.assertEqual(self.problems(body), [])

    def test_marker_absent_but_inline_findings_exist_is_not_clean(self):
        """Verify marker absent but inline findings exist is not clean."""
        body = "<!-- coderabbit-ai-generated:v1 -->\nreview"
        self.assertTrue(any("inline finding" in p for p in self.problems(body, inline=2)))

    def test_accepted_premerge_failures_are_an_explicit_reviewed_waiver_only(self):
        """Verify accepted premerge failures are an explicit reviewed waiver only."""
        self.assertEqual(gate.ACCEPTED_PREMERGE_FAILURES, frozenset())
        body = self.body("pr655-36f230b9-no-marker-failed-premerge.html")
        with mock.patch.object(gate, "ACCEPTED_PREMERGE_FAILURES", frozenset({"Docstring Coverage"})):
            self.assertEqual(self.problems(body), [])
        with mock.patch.object(gate, "ACCEPTED_PREMERGE_FAILURES", frozenset({"Something Else"})):
            self.assertTrue(self.problems(body))

    def test_unverifiable_reviews_fail_closed(self):
        """Verify unverifiable reviews fail closed."""
        self.assertTrue(self.problems(""))
        self.assertTrue(self.problems("looks good to me"))
        self.assertTrue(self.problems("<!-- coderabbit-ai-generated:v1 -->", state="CHANGES_REQUESTED"))

    def test_a_review_of_another_head_or_no_review_is_not_evidence(self):
        """Verify a review of another head or no review is not evidence."""
        self.assertTrue(any("exact head" in p for p in self.problems("<!-- coderabbit-ai-generated:v1 -->", review_sha="9" * 40)))
        with mock.patch.object(gate, "paginated", return_value=[]):
            self.assertTrue(any("exact head" in p for p in gate.coderabbit_review_problems(1, SHA)))

    def test_a_lookalike_account_is_ignored(self):
        """Verify a lookalike account is ignored."""
        review = {"id": 1, "user": {"login": "coderabbitai-fake"}, "state": "COMMENTED", "commit_id": SHA,
                  "body": "<!-- coderabbit-ai-generated:v1 -->\n**Actionable comments posted: 0**"}
        with mock.patch.object(gate, "paginated", return_value=[review]):
            self.assertTrue(gate.coderabbit_review_problems(1, SHA))
            self.assertFalse(gate.coderabbit_review_clean(1, SHA))

    def test_a_green_standalone_check_is_never_evidence(self):
        """Verify a green standalone check is never evidence."""
        # The standalone "CodeRabbit" check-run is not consulted at all by the review predicate.
        import inspect
        source = inspect.getsource(gate.coderabbit_review_problems)
        self.assertNotIn("check-runs", source)
        self.assertNotIn("latest_checks", source)


class ModeGuardTests(GateTestCase):
    """Group offline tests for mode guard."""
    def run_main(self, env):
        """Invoke the gate command with isolated API and environment fixtures."""
        with mock.patch.dict(gate.os.environ, {"GITHUB_REPOSITORY": gate.REPO, **env}, clear=True), \
             mock.patch.object(gate, "paginated", return_value=[{"number": 1, "base": {"ref": "main"}}]), \
             mock.patch.object(gate, "update_gate_check") as update:
            gate.main()
            return update

    def test_default_mode_is_advisory(self):
        """Verify default mode is advisory."""
        update = self.run_main(env(actions=True))
        update.assert_called_once_with(1, "advisory")

    def test_invalid_mode_is_refused(self):
        """Verify invalid mode is refused."""
        with self.assertRaises(SystemExit):
            self.run_main({"APPVERSE_PUBLISH_MODE": "root"})

    def test_advisory_mode_refuses_to_run_with_the_dedicated_credential_present(self):
        """Verify advisory mode refuses to run with the dedicated credential present."""
        with self.assertRaises(SystemExit):
            self.run_main(env(app=True, APPVERSE_PUBLISH_MODE="advisory"))

    def test_authoritative_mode_passes_through(self):
        """Verify authoritative mode passes through."""
        update = self.run_main(env(app=True, APPVERSE_PUBLISH_MODE="authoritative"))
        update.assert_called_once_with(1, "authoritative")


if __name__ == "__main__":
    unittest.main()
