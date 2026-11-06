"""Offline fail-closed tests for the trusted Appverse merge gate.

No test may reach the network: setUp replaces ``gate.api`` with a function that fails the test if called unless a
test installs its own fake.
"""
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
    raise AssertionError(f"unexpected network call: {args} {kwargs}")


class GateTestCase(unittest.TestCase):
    def setUp(self):
        patcher = mock.patch.object(gate, "api", side_effect=no_network)
        patcher.start()
        self.addCleanup(patcher.stop)
        sleeper = mock.patch.object(gate.time, "sleep")
        sleeper.start()
        self.addCleanup(sleeper.stop)


def ok_status_rule(**overrides):
    rule = {"enforcement": "active", "target": "branch", "bypass_actors": [],
            "conditions": {"ref_name": {"include": ["refs/heads/main"]}},
            "rules": [{"type": "required_status_checks", "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [{"context": gate.CHECK_NAME, "integration_id": gate.GATE_APP_ID}]}}]}
    rule.update(overrides)
    return rule


def ok_governance(**params):
    base = {"required_approving_review_count": 1, "require_code_owner_review": True,
            "dismiss_stale_reviews_on_push": True, "required_review_thread_resolution": True}
    base.update(params)
    return {"enforcement": "active", "target": "branch", "bypass_actors": [],
            "conditions": {"ref_name": {"include": ["~DEFAULT_BRANCH"]}},
            "rules": [{"type": "pull_request", "parameters": base}]}


class RulesetTests(GateTestCase):
    def evaluate(self, status_rule, governance):
        with mock.patch.object(gate, "api", side_effect=[status_rule, governance]):
            return gate.ruleset_problems()

    def test_no_required_ruleset_rejects(self):
        with mock.patch.object(gate, "api", return_value={"enforcement": "active", "rules": []}):
            self.assertFalse(gate.configured_ruleset())

    def test_loose_required_rule_rejects(self):
        response = {"enforcement": "active", "rules": [{"type": "required_status_checks",
            "parameters": {"strict_required_status_checks_policy": False,
                           "required_status_checks": [{"context": gate.CHECK_NAME}]}}]}
        with mock.patch.object(gate, "api", return_value=response):
            self.assertFalse(gate.configured_ruleset())

    def test_strict_pinned_rules_accept(self):
        self.assertEqual(self.evaluate(ok_status_rule(), ok_governance()), [])

    def test_missing_integration_id_rejects(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"] = [{"context": gate.CHECK_NAME}]
        problems = self.evaluate(rule, ok_governance())
        self.assertTrue(any("not pinned exclusively to the dedicated gate App" in p for p in problems))

    def test_wrong_integration_id_rejects(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"][0]["integration_id"] = 999
        self.assertTrue(self.evaluate(rule, ok_governance()))

    def test_pin_to_the_shared_actions_identity_is_rejected_as_impersonable(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"][0]["integration_id"] = gate.GITHUB_ACTIONS_APP_ID
        problems = self.evaluate(rule, ok_governance())
        self.assertTrue(any("shared GitHub Actions identity" in p and "impersonate" in p for p in problems), problems)

    def test_actions_entry_alongside_the_dedicated_app_is_rejected(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"].append(
            {"context": gate.CHECK_NAME, "integration_id": gate.GITHUB_ACTIONS_APP_ID})
        self.assertTrue(self.evaluate(rule, ok_governance()))

    def test_gate_must_be_required_at_all(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"] = [{"context": "Something Else", "integration_id": gate.GATE_APP_ID}]
        self.assertTrue(any("not a required status check" in p for p in self.evaluate(rule, ok_governance())))

    def test_the_advisory_check_name_can_never_satisfy_the_requirement(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"] = [
            {"context": gate.ADVISORY_CHECK_NAME, "integration_id": gate.GITHUB_ACTIONS_APP_ID}]
        self.assertTrue(self.evaluate(rule, ok_governance()))
        self.assertNotEqual(gate.ADVISORY_CHECK_NAME, gate.CHECK_NAME)
        self.assertIn("(advisory)", gate.ADVISORY_CHECK_NAME)

    def test_dedicated_app_is_the_expected_identity(self):
        self.assertEqual(gate.GATE_APP_ID, 5645415)
        self.assertNotEqual(gate.GATE_APP_ID, gate.GITHUB_ACTIONS_APP_ID)

    def test_bypass_actor_rejects(self):
        problems = self.evaluate(ok_status_rule(bypass_actors=[{"actor_id": 5}]), ok_governance())
        self.assertTrue(any("bypass actors are configured" in p for p in problems))

    def test_hidden_bypass_actors_never_means_no_bypass(self):
        rule = ok_status_rule()
        del rule["bypass_actors"]
        problems = self.evaluate(rule, ok_governance())
        self.assertTrue(any("bypass_actors not visible" in p for p in problems))

    def test_hidden_bypass_actors_on_governance_ruleset_rejects(self):
        governance = ok_governance()
        del governance["bypass_actors"]
        self.assertTrue(self.evaluate(ok_status_rule(), governance))

    def test_code_owner_review_must_be_enforced(self):
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(require_code_owner_review=False)))

    def test_stale_review_dismissal_must_be_enforced(self):
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(dismiss_stale_reviews_on_push=False)))

    def test_thread_resolution_must_be_enforced(self):
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(required_review_thread_resolution=False)))

    def test_zero_required_approvals_rejects(self):
        self.assertTrue(self.evaluate(ok_status_rule(), ok_governance(required_approving_review_count=0)))

    def test_inactive_or_non_main_ruleset_rejects(self):
        self.assertTrue(self.evaluate(ok_status_rule(enforcement="evaluate"), ok_governance()))
        other = ok_status_rule(conditions={"ref_name": {"include": ["refs/heads/other"]}})
        self.assertTrue(self.evaluate(other, ok_governance()))

    def test_non_strict_policy_rejects(self):
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["strict_required_status_checks_policy"] = False
        self.assertTrue(self.evaluate(rule, ok_governance()))


class EvidenceProvenanceTests(GateTestCase):
    def test_pending_outranks_stale_success(self):
        checks = [
            {"name": "CodeRabbit", "app": {"slug": "coderabbitai"}, "status": "completed",
             "conclusion": "success", "id": 1, "started_at": "2026-11-06T00:00:00Z"},
            {"name": "CodeRabbit", "app": {"slug": "coderabbitai"}, "status": "in_progress",
             "conclusion": None, "id": 2, "started_at": "2026-11-06T01:00:00Z"},
        ]
        with mock.patch.object(gate, "paginated", return_value=checks):
            self.assertEqual(gate.latest_checks("0" * 40)[("CodeRabbit", "coderabbitai")]["status"], "in_progress")

    def test_same_name_from_different_app_is_a_different_identity(self):
        checks = [{"name": "CodeRabbit", "app": {"slug": "github-actions"}, "status": "completed",
                   "conclusion": "success", "id": 1, "started_at": "2026-11-06T00:00:00Z"}]
        with mock.patch.object(gate, "paginated", return_value=checks):
            found = gate.latest_checks(SHA)
        self.assertNotIn(("CodeRabbit", "coderabbitai"), found)

    def test_newest_status_wins_regardless_of_list_order(self):
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
        payload = {"repository": {"pullRequest": {"reviewThreads": {
            "nodes": [{"isResolved": False}], "pageInfo": {"hasNextPage": False}}}}}
        with mock.patch.object(gate, "graphql", return_value=payload):
            self.assertEqual(gate.unresolved_threads(5), 1)

    def test_more_than_one_thread_page_fails_closed(self):
        payload = {"repository": {"pullRequest": {"reviewThreads": {
            "nodes": [], "pageInfo": {"hasNextPage": True}}}}}
        with mock.patch.object(gate, "graphql", return_value=payload):
            with self.assertRaises(gate.GateError):
                gate.unresolved_threads(5)

    def test_coderabbit_actionable_review_fails_closed(self):
        v = [{"user": {"login": "coderabbitai[bot]"}, "state": "COMMENTED", "commit_id": SHA,
              "body": "Actionable comments posted: 3"}]
        with mock.patch.object(gate, "paginated", return_value=v):
            self.assertFalse(gate.coderabbit_review_clean(1, SHA))

    def test_coderabbit_zero_actionable_accepts(self):
        v = [{"user": {"login": "coderabbitai[bot]"}, "state": "COMMENTED", "commit_id": SHA,
              "body": "Actionable comments posted: 0"}]
        with mock.patch.object(gate, "paginated", return_value=v):
            self.assertTrue(gate.coderabbit_review_clean(1, SHA))

    def test_coderabbit_review_on_other_head_or_unparseable_fails_closed(self):
        old = [{"user": {"login": "coderabbitai[bot]"}, "state": "COMMENTED", "commit_id": "2" * 40,
                "body": "Actionable comments posted: 0"}]
        junk = [{"user": {"login": "coderabbitai[bot]"}, "state": "COMMENTED", "commit_id": SHA, "body": "ok"}]
        for reviews in (old, junk, []):
            with mock.patch.object(gate, "paginated", return_value=reviews):
                self.assertFalse(gate.coderabbit_review_clean(1, SHA))

    def test_lookalike_coderabbit_account_is_ignored(self):
        v = [{"user": {"login": "coderabbitai-fake"}, "state": "COMMENTED", "commit_id": SHA,
              "body": "Actionable comments posted: 0"}]
        with mock.patch.object(gate, "paginated", return_value=v):
            self.assertFalse(gate.coderabbit_review_clean(1, SHA))


def review(user, state="APPROVED", sha=SHA, association="NONE"):
    return {"user": {"login": user}, "state": state, "commit_id": sha, "author_association": association}


class ReviewTrustTests(GateTestCase):
    def approve(self, reviews, *, human=False, author=AUTHOR, sha=SHA):
        with mock.patch.object(gate, "paginated", return_value=reviews):
            return gate.review_approval(1, sha, author, require_human=human)

    def test_old_head_approval_rejects(self):
        self.assertFalse(self.approve([review("cursor[bot]", sha="9" * 40)]))

    def test_author_self_approval_rejects(self):
        self.assertFalse(self.approve([review(AUTHOR, association="OWNER")], human=True))

    def test_untrusted_account_cannot_approve(self):
        self.assertFalse(self.approve([review("random-user", association="COLLABORATOR")]))

    def test_trusted_login_without_trusted_association_cannot_approve(self):
        self.assertFalse(self.approve([review(OWNER2, association="NONE")], human=True))

    def test_untrusted_changes_requested_neither_blocks_nor_approves(self):
        reviews = [review("cursor[bot]"), review("drive-by", "CHANGES_REQUESTED", association="NONE")]
        self.assertTrue(self.approve(reviews))

    def test_trusted_changes_requested_rejects_bot_approval(self):
        reviews = [review("cursor[bot]"), review(OWNER2, "CHANGES_REQUESTED", association="COLLABORATOR")]
        self.assertFalse(self.approve(reviews))

    def test_dismissed_approval_rejects(self):
        reviews = [review(OWNER2, "APPROVED", association="COLLABORATOR"),
                   review(OWNER2, "DISMISSED", association="COLLABORATOR")]
        self.assertFalse(self.approve(reviews, human=True))

    def test_empty_author_fails_closed(self):
        with mock.patch.object(gate, "paginated", return_value=[review(OWNER2, association="COLLABORATOR")]):
            with self.assertRaises(gate.GateError):
                gate.review_approval(1, SHA, "", require_human=True)

    def test_bot_only_approval_rejects_when_human_required(self):
        self.assertFalse(self.approve([review("cursor[bot]")], human=True))

    def test_trusted_bot_may_approve_non_sensitive(self):
        self.assertTrue(self.approve([review("cursor[bot]")], human=False))

    def test_trusted_human_codeowner_can_approve_sensitive(self):
        self.assertTrue(self.approve([review(OWNER2, association="COLLABORATOR")], human=True))

    def test_human_approval_plus_bot_changes_requested_rejects(self):
        reviews = [review(OWNER2, association="COLLABORATOR"), review("cursor[bot]", "CHANGES_REQUESTED")]
        self.assertFalse(self.approve(reviews, human=True))


class SensitivePathTests(GateTestCase):
    def test_sensitive_areas_are_classified(self):
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
        ordinary = ["docs/README.md", "src/components/Button.tsx", "src/pages/PublicLanding.tsx",
                    "src/lib/navigateHelpers.ts", "src/lib/aggregateTotals.ts", "src/lib/authorList.ts",
                    "src/styles/theme.css", "public/robots.txt"]
        for path in ordinary:
            self.assertEqual(gate.sensitive_paths({path}), [], path)

    def test_result_is_deterministic_and_complete(self):
        paths = {"src/components/Button.tsx", "src/lib/finance-authority/a.ts", ".github/CODEOWNERS"}
        self.assertEqual(gate.sensitive_paths(paths), [".github/CODEOWNERS", "src/lib/finance-authority/a.ts"])


class ScopeTests(GateTestCase):
    def test_ordinary_change_requires_only_baseline_checks(self):
        required = gate.relevant_checks({"docs/README.md"})
        self.assertEqual(set(required), set(gate.REQUIRED_CHECKS))

    def test_each_lane_requires_only_what_its_workflow_triggers_on(self):
        factory = gate.relevant_checks({"scripts/factory-certification/seed.mjs"})
        self.assertIn("Disposable Factory certification", factory)
        self.assertNotIn("Point100 production-bound software rehearsal", factory)  # that workflow cannot trigger
        buyer = gate.relevant_checks({"src/pages/customer/BuyerApp.tsx"})
        self.assertIn("Disposable Buyer golden path certification", buyer)
        self.assertNotIn("Disposable Factory certification", buyer)
        point = gate.relevant_checks({"scripts/point100-certification/x.mjs"})
        self.assertIn("Point100 production-bound software rehearsal", point)

    def test_lane_config_files_trigger_their_lane(self):
        self.assertIn("Disposable Factory certification", gate.relevant_checks({"playwright.factory-cert.config.ts"}))
        self.assertIn("Disposable Buyer golden path certification", gate.relevant_checks({"playwright.buyer-cert.config.ts"}))
        self.assertIn("Point100 production-bound software rehearsal", gate.relevant_checks({"playwright.point100.config.ts"}))

    def test_unrelated_appverse_file_does_not_require_point100(self):
        # Requiring a lane that can never trigger would deadlock the PR.
        self.assertNotIn("Point100 production-bound software rehearsal", gate.relevant_checks({".appverse/OTHER.md"}))

    def test_glob_semantics(self):
        self.assertTrue(gate.path_matches("scripts/a/**", "scripts/a/b/c.mjs"))
        self.assertTrue(gate.path_matches("src/lib/factoryOperations*.ts", "src/lib/factoryOperationsX.ts"))
        self.assertFalse(gate.path_matches("src/lib/factoryOperations*.ts", "src/lib/sub/factoryOperationsX.ts"))
        self.assertFalse(gate.path_matches("tests/point100/**", "tests/point1000/x.ts"))
        self.assertTrue(gate.path_matches("**/x.ts", "x.ts"))

    def test_codeql_languages_follow_changed_files(self):
        required = gate.relevant_checks({"a.py", ".github/workflows/x.yml", "src/a.tsx"})
        for name in ("Analyze (python)", "Analyze (actions)", "Analyze (javascript-typescript)"):
            self.assertIn(name, required)
        self.assertNotIn("Analyze (python)", gate.relevant_checks({"docs/a.md"}))

    def test_extra_failing_or_pending_checks_block_but_gate_itself_and_advisory_do_not(self):
        def run(name, slug, status, conclusion):
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
    return {"name": name, "app": {"slug": slug, **({"id": app_id} if app_id else {})}, "status": status,
            "conclusion": conclusion, "id": cid, "started_at": "2026-11-06T00:00:00Z"}


def all_green(required):
    return [check(name, slug, cid=i) for i, (name, slug) in enumerate(required.items(), 1)]


def base_pr(**overrides):
    pr = {"number": 700, "head": {"sha": SHA}, "base": {"ref": "main", "sha": BASE}, "state": "open",
          "draft": False, "title": "Ordinary change", "mergeable": True, "mergeable_state": "clean",
          "user": {"login": AUTHOR}}
    pr.update(overrides)
    return pr


class ValidateMatrixTests(GateTestCase):
    """Full required-check matrix for an ordinary PR, and each way it must fail closed."""

    def run_validate(self, *, files=("docs/README.md",), checks=None, statuses=None, threads=0, approved=True,
                     coderabbit=True, ruleset=(), pr=None, now_pr=None, renames=None):
        pr = pr or base_pr()
        changed = [{"filename": f, **({"previous_filename": renames[f]} if renames and f in renames else {})} for f in files]
        required = gate.relevant_checks(set(files) | set((renames or {}).values()))
        runs = all_green(required) if checks is None else checks
        statuses = statuses if statuses is not None else {
            "security/snyk (oasisbaklawa2006)": {"state": "success", "creator": {"login": "snyk-io[bot]"}},
            "Vercel": {"state": "success", "creator": {"login": "vercel[bot]"}}}
        approvals = []
        def fake_review_approval(number, sha, author, require_human=False):
            approvals.append(require_human)
            return approved
        with mock.patch.multiple(
            gate, ruleset_problems=lambda: list(ruleset),
            paginated=lambda path, key=None: changed, latest_checks=lambda sha: {
                (c["name"], c["app"]["slug"]): c for c in runs},
            latest_statuses=lambda sha: statuses, unresolved_threads=lambda n: threads,
            review_approval=fake_review_approval, coderabbit_review_clean=lambda n, s: coderabbit,
            current_pr=lambda n: now_pr or pr,
        ):
            self.approvals = approvals
            return gate.validate(pr)

    def test_ordinary_eligible_pr_passes_every_gate(self):
        self.assertEqual(self.run_validate(), [])
        self.assertEqual(self.approvals, [False])  # bot approval acceptable for non-sensitive

    def test_every_required_check_missing_skipped_cancelled_or_failed_blocks(self):
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
        required = gate.relevant_checks({"docs/README.md"})
        runs = [check(n, "github-actions" if s == "coderabbitai" else s, cid=i)
                for i, (n, s) in enumerate(required.items(), 1)]
        errors = self.run_validate(checks=runs)
        self.assertTrue(any("Required check CodeRabbit" in e for e in errors))

    def test_additional_failing_lane_blocks(self):
        required = gate.relevant_checks({"docs/README.md"})
        runs = all_green(required) + [check("Unlisted Lane", "github-actions", "failure", cid=77)]
        self.assertTrue(any("Unlisted Lane" in e for e in self.run_validate(checks=runs)))

    def test_forged_or_failed_external_status_blocks(self):
        forged = {"security/snyk (oasisbaklawa2006)": {"state": "success", "creator": {"login": "attacker"}},
                  "Vercel": {"state": "success", "creator": {"login": "vercel[bot]"}}}
        self.assertTrue(any("snyk" in e for e in self.run_validate(statuses=forged)))
        failed = {"security/snyk (oasisbaklawa2006)": {"state": "failure", "creator": {"login": "snyk-io[bot]"}},
                  "Vercel": {"state": "success", "creator": {"login": "vercel[bot]"}}}
        self.assertTrue(self.run_validate(statuses=failed))
        self.assertTrue(self.run_validate(statuses={}))

    def test_unresolved_threads_block(self):
        self.assertTrue(any("Unresolved" in e for e in self.run_validate(threads=2)))

    def test_missing_approval_blocks(self):
        self.assertTrue(any("No valid current-head approval" in e for e in self.run_validate(approved=False)))

    def test_coderabbit_actionable_blocks(self):
        self.assertTrue(any("CodeRabbit has not completed" in e for e in self.run_validate(coderabbit=False)))

    def test_ruleset_problem_blocks_with_reason(self):
        errors = self.run_validate(ruleset=["governance ruleset: code-owner review is not enforced"])
        self.assertTrue(any(e.startswith("BLOCKED_RULESET") and "code-owner" in e for e in errors))

    def test_sensitive_change_requires_human_and_reports_paths(self):
        files = ("src/lib/finance-authority/reverse.ts",)
        errors = self.run_validate(files=files, approved=False)
        self.assertTrue(any("Sensitive paths changed" in e and "finance-authority" in e for e in errors))
        self.assertEqual(self.approvals, [True])
        # With the required independent human approval the sensitive PR is not deadlocked by the gate itself.
        self.assertEqual(self.run_validate(files=files, approved=True), [])
        self.assertEqual(self.approvals, [True])

    def test_every_sensitive_class_forces_human_approval_requirement(self):
        for path in ("src/lib/auth/session.ts", "supabase/config.toml", ".github/workflows/new.yml",
                     "src/lib/dispatch-authority/gate.ts", "package.json", "scripts/point100-certification/a.mjs"):
            self.run_validate(files=(path,))
            self.assertEqual(self.approvals, [True], path)

    def test_rename_away_from_sensitive_path_is_still_sensitive(self):
        errors = self.run_validate(files=("docs/moved.md",), renames={"docs/moved.md": "src/lib/finance-authority/old.ts"},
                                   approved=False)
        self.assertTrue(any("Sensitive paths changed" in e for e in errors))
        self.assertEqual(self.approvals, [True])

    def test_core_migration_in_central_blocks(self):
        errors = self.run_validate(files=("supabase/migrations/20261106_x.sql",))
        self.assertTrue(any("Core-owned migration" in e for e in errors))

    def test_draft_closed_stacked_and_conflicting_pr_block(self):
        for override in ({"draft": True}, {"state": "closed"}, {"base": {"ref": "feature", "sha": BASE}},
                         {"mergeable": None}, {"mergeable": False}, {"mergeable_state": "dirty"},
                         {"mergeable_state": "unknown"}):
            self.assertTrue(self.run_validate(pr=base_pr(**override)), override)

    def test_evidence_only_candidate_never_eligible(self):
        self.assertTrue(any("Evidence-only" in e for e in self.run_validate(pr=base_pr(number=651))))
        self.assertTrue(any("Evidence-only" in e for e in self.run_validate(pr=base_pr(title="X NOT FOR MERGE"))))

    def test_head_or_base_change_during_verification_blocks(self):
        moved_head = base_pr(head={"sha": "3" * 40})
        moved_base = base_pr(base={"ref": "main", "sha": "4" * 40})
        for now in (moved_head, moved_base):
            self.assertTrue(any("HEAD_OR_BASE_CHANGED" in e for e in self.run_validate(now_pr=now)))


class UpdateAndSweepTests(GateTestCase):
    def test_exception_during_validation_publishes_failure_on_exact_head(self):
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
        posted = []
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", return_value=[]), \
             mock.patch.object(gate, "latest_checks", return_value={}), \
             mock.patch.object(gate, "api", side_effect=lambda path, **kw: posted.append(kw)):
            gate.update_gate_check(700)
        self.assertEqual(posted[0]["data"]["conclusion"], "success")

    def test_identical_verdict_is_not_republished(self):
        summary = f"PR #700; exact head {SHA}; FAILURE.\n- x"
        previous = {"status": "completed", "conclusion": "failure", "output": {"summary": summary}}
        with mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", return_value=["x"]), \
             mock.patch.object(gate, "latest_checks", return_value={(gate.ADVISORY_CHECK_NAME, "github-actions"): previous}), \
             mock.patch.object(gate, "api", side_effect=no_network):
            gate.update_gate_check(700)  # no POST => no network call

    def test_sweep_isolates_per_pr_failures_and_exits_non_zero(self):
        calls = []
        def fake_update(number, mode="advisory"):
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
        original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(original)
        for query in ("mutation { enablePullRequestAutoMerge(input:{}) { clientMutationId } }",
                      "  MUTATION x { mergePullRequest(input:{}) { clientMutationId } }"):
            with self.assertRaises(original.GateError):
                original.graphql(query, {})

    def test_invalid_paths_are_refused(self):
        original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(original)
        with mock.patch.dict(original.os.environ, {ENV_API: DUMMY_CREDENTIAL}):
            for path in ("https://evil.example/x", "repos/x", "/repos/x\r\nHost: evil", "/repos/x y"):
                with self.assertRaises(original.GateError, msg=path):
                    original.api(path)

    def test_source_contains_no_merge_or_auto_merge_endpoints(self):
        source = (ROOT / "scripts/appverse-control/appverse_merge_gate.py").read_text()
        for forbidden in ("/merge", "auto_merge", "enablePullRequestAutoMerge", "mergePullRequest",
                          "pull_request_target", "subprocess", "os.system", "eval(", "exec("):
            self.assertNotIn(forbidden, source, forbidden)


class TransportTests(GateTestCase):
    def setUp(self):
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
        r = mock.Mock()
        r.status = status
        r.read.return_value = json.dumps(payload if payload is not None else {}).encode()
        return r

    def test_get_retries_transient_failures_then_succeeds(self):
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.side_effect = [self.response(503), self.response(502),
                                                          self.response(200, {"ok": True})]
            self.assertEqual(self.original.api("/repos/x"), {"ok": True})
            self.assertEqual(conn.return_value.getresponse.call_count, 3)

    def test_get_gives_up_and_fails_closed(self):
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.return_value = self.response(503)
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")

    def test_client_errors_are_not_retried(self):
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.return_value = self.response(404)
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")
            self.assertEqual(conn.return_value.getresponse.call_count, 1)

    def test_post_is_never_retried(self):
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.getresponse.return_value = self.response(503)
            with self.assertRaises(self.original.GateError):
                self.original.api(f"/repos/{self.original.REPO}/check-runs", method="POST", data={})
            self.assertEqual(conn.return_value.getresponse.call_count, 1)

    def test_network_errors_become_gate_errors_and_token_goes_only_to_api_host(self):
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            conn.return_value.request.side_effect = OSError("down")
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")
            host_args = {call.args[0] for call in conn.call_args_list}
            self.assertEqual(host_args, {"api.github.com"})

    def test_invalid_json_fails_closed(self):
        with mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            bad = mock.Mock(status=200)
            bad.read.return_value = b"<html>"
            conn.return_value.getresponse.return_value = bad
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x")

    def test_pagination_over_limit_fails_closed(self):
        with mock.patch.object(self.original, "api", return_value=[{}] * 100):
            with self.assertRaises(self.original.GateError):
                self.original.paginated("/repos/x/list")

    def test_non_list_pagination_response_fails_closed(self):
        with mock.patch.object(self.original, "api", return_value={"message": "oops"}):
            with self.assertRaises(self.original.GateError):
                self.original.paginated("/repos/x/list")


class SpoofDetectionTests(GateTestCase):
    """The gate's authoritative name carries authority only when published by the dedicated App."""

    def test_check_with_the_gate_name_from_actions_is_a_spoof(self):
        checks = {(gate.CHECK_NAME, "github-actions"): check(gate.CHECK_NAME, "github-actions", app_id=gate.GITHUB_ACTIONS_APP_ID)}
        self.assertEqual(gate.foreign_gate_checks(checks), ["github-actions"])

    def test_check_with_the_gate_name_from_any_other_app_or_unknown_app_is_a_spoof(self):
        for app_id in (1, 999999, None):
            checks = {(gate.CHECK_NAME, "evil-app"): check(gate.CHECK_NAME, "evil-app", app_id=app_id)}
            self.assertEqual(gate.foreign_gate_checks(checks), ["evil-app"], app_id)

    def test_check_from_the_dedicated_app_is_not_a_spoof(self):
        checks = {(gate.CHECK_NAME, "oasis-appverse-merge-gate"):
                  check(gate.CHECK_NAME, "oasis-appverse-merge-gate", app_id=gate.GATE_APP_ID)}
        self.assertEqual(gate.foreign_gate_checks(checks), [])

    def test_advisory_name_is_not_flagged_and_other_checks_are_ignored(self):
        checks = {(gate.ADVISORY_CHECK_NAME, "github-actions"): check(gate.ADVISORY_CHECK_NAME, "github-actions", app_id=15368),
                  ("CodeRabbit", "coderabbitai"): check("CodeRabbit", "coderabbitai", app_id=1)}
        self.assertEqual(gate.foreign_gate_checks(checks), [])

    def test_validate_reports_the_spoof_attempt(self):
        required = gate.relevant_checks({"docs/README.md"})
        runs = all_green(required) + [check(gate.CHECK_NAME, "github-actions", app_id=gate.GITHUB_ACTIONS_APP_ID, cid=900)]
        errors = ValidateMatrixTests("run_validate").run_validate(checks=runs)
        self.assertTrue(any(e.startswith("SPOOF_ATTEMPT") and "github-actions" in e for e in errors), errors)

    def test_a_branch_workflow_posting_the_gate_name_cannot_make_the_ruleset_pass(self):
        # The ruleset pin is the real control: an entry pinned to Actions is itself reported as unsafe.
        rule = ok_status_rule()
        rule["rules"][0]["parameters"]["required_status_checks"][0]["integration_id"] = gate.GITHUB_ACTIONS_APP_ID
        with mock.patch.object(gate, "api", side_effect=[rule, ok_governance()]):
            self.assertFalse(gate.configured_ruleset())


class CredentialIdentityTests(GateTestCase):
    def setUp(self):
        super().setUp()
        self.original = importlib.util.module_from_spec(SPEC)
        SPEC.loader.exec_module(self.original)

    def request(self, identity, env):
        with mock.patch.dict(self.original.os.environ, env, clear=True), \
             mock.patch.object(self.original.http.client, "HTTPSConnection") as conn:
            response = mock.Mock(status=200)
            response.read.return_value = b"{}"
            conn.return_value.getresponse.return_value = response
            self.original.api("/repos/x", identity=identity)
            return conn.return_value.request.call_args.kwargs["headers"]["Authorization"]

    def test_each_identity_sends_only_its_own_credential(self):
        creds = env(actions="credential-one", app="credential-two")
        self.assertEqual(self.request("actions", creds), "Bearer credential-one")
        self.assertEqual(self.request("app", creds), "Bearer credential-two")

    def test_missing_credential_and_unknown_identity_fail_closed(self):
        with mock.patch.dict(self.original.os.environ, env(actions=True), clear=True):
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x", identity="app")
            with self.assertRaises(self.original.GateError):
                self.original.api("/repos/x", identity="root")

    def test_ruleset_reads_prefer_the_dedicated_app_credential_when_present(self):
        with mock.patch.dict(self.original.os.environ, env(actions=True, app=True), clear=True):
            self.assertEqual(self.original.ruleset_identity(), "app")
        with mock.patch.dict(self.original.os.environ, env(actions=True), clear=True):
            self.assertEqual(self.original.ruleset_identity(), "actions")

    def test_ruleset_requests_use_that_identity(self):
        seen = []
        def fake(path, **kw):
            seen.append(kw.get("identity"))
            return ok_status_rule() if str(gate.RULESET_ID) in path else ok_governance()
        with mock.patch.dict(gate.os.environ, env(actions=True, app=True), clear=True), \
             mock.patch.object(gate, "api", side_effect=fake):
            self.assertEqual(gate.ruleset_problems(), [])
        self.assertEqual(seen, ["app", "app"])


def environment_api(*, custom=True, branches=("main",), error=None):
    def fake(path, **kw):
        if error:
            raise gate.GateError(error)
        if path.endswith("/deployment-branch-policies"):
            return {"branch_policies": [{"name": b, "type": "branch"} for b in branches]}
        return {"deployment_branch_policy": {"protected_branches": False, "custom_branch_policies": custom}}
    return fake


class PublicationTests(GateTestCase):
    def publish(self, mode, *, env, api_fn, errors=(), previous=None):
        posted = []
        def fake_api(path, **kw):
            if kw.get("method") == "POST":
                posted.append((path, kw))
                return {"app": {"id": gate.GATE_APP_ID}} if kw.get("identity") == "app" else {"app": {"id": 15368}}
            return api_fn(path, **kw)
        with mock.patch.dict(gate.os.environ, env, clear=True), \
             mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", return_value=list(errors)), \
             mock.patch.object(gate, "latest_checks", return_value=previous or {}), \
             mock.patch.object(gate, "api", side_effect=fake_api):
            gate.update_gate_check(700, mode)
        return posted

    def test_advisory_mode_publishes_only_the_advisory_name_with_the_actions_identity(self):
        posted = self.publish("advisory", env=env(actions=True), api_fn=no_network)
        (path, kw), = posted
        self.assertEqual(kw["data"]["name"], gate.ADVISORY_CHECK_NAME)
        self.assertEqual(kw["identity"], "actions")
        self.assertIn("advisory", kw["data"]["output"]["title"])

    def test_advisory_mode_can_never_publish_the_authoritative_name(self):
        for errors in ((), ("x",)):
            posted = self.publish("advisory", env=env(actions=True), api_fn=no_network, errors=errors)
            self.assertTrue(all(kw["data"]["name"] != gate.CHECK_NAME for _, kw in posted))

    def test_authoritative_mode_publishes_the_gate_name_with_the_dedicated_app_when_environment_is_restricted(self):
        posted = self.publish("authoritative", env=env(actions=True, app=True), api_fn=environment_api())
        (path, kw), = posted
        self.assertEqual(kw["data"]["name"], gate.CHECK_NAME)
        self.assertEqual(kw["identity"], "app")
        self.assertEqual(kw["data"]["head_sha"], SHA)
        self.assertEqual(kw["data"]["conclusion"], "success")

    def test_authoritative_failure_verdict_is_published_too(self):
        posted = self.publish("authoritative", env=env(actions=True, app=True),
                              api_fn=environment_api(), errors=["blocked"])
        self.assertEqual(posted[0][1]["data"]["conclusion"], "failure")

    def test_authoritative_publication_is_withheld_without_the_app_credential(self):
        self.assertEqual(self.publish("authoritative", env=env(actions=True), api_fn=no_network), [])

    def test_authoritative_publication_is_withheld_when_the_environment_is_not_restricted(self):
        self.assertEqual(self.publish("authoritative", env=env(actions=True, app=True),
                                      api_fn=environment_api(custom=False)), [])

    def test_authoritative_publication_is_withheld_when_other_branches_are_allowed(self):
        for branches in (("main", "release/x"), ("feature",), ()):
            self.assertEqual(self.publish("authoritative", env=env(actions=True, app=True),
                                          api_fn=environment_api(branches=branches)), [], branches)

    def test_authoritative_publication_is_withheld_when_the_policy_cannot_be_verified(self):
        self.assertEqual(self.publish("authoritative", env=env(actions=True, app=True),
                                      api_fn=environment_api(error="HTTP 403")), [])

    def test_authoritative_check_published_by_the_wrong_app_raises(self):
        def fake_api(path, **kw):
            if kw.get("method") == "POST":
                return {"app": {"id": 15368}}
            return environment_api()(path, **kw)
        with mock.patch.dict(gate.os.environ, env(actions=True, app=True), clear=True), \
             mock.patch.object(gate, "current_pr", return_value=base_pr()), \
             mock.patch.object(gate, "validate", return_value=[]), \
             mock.patch.object(gate, "latest_checks", return_value={}), \
             mock.patch.object(gate, "api", side_effect=fake_api):
            with self.assertRaises(gate.GateError):
                gate.update_gate_check(700, "authoritative")

    def test_unknown_mode_is_refused(self):
        with self.assertRaises(gate.GateError):
            gate.update_gate_check(700, "both")

    def test_idempotency_is_per_identity_and_ignores_spoofed_history(self):
        _, summary = gate.verdict_and_summary(700, SHA, [])
        spoof = {(gate.CHECK_NAME, "github-actions"): {"status": "completed", "conclusion": "success",
                                                         "output": {"summary": summary}, "app": {"id": 15368}}}
        posted = self.publish("authoritative", env=env(actions=True, app=True),
                              api_fn=environment_api(), previous=spoof)
        self.assertEqual(len(posted), 1, "a spoofed identical check must not suppress the genuine publication")
        genuine = {(gate.CHECK_NAME, "dedicated"): {"status": "completed", "conclusion": "success",
                                                      "output": {"summary": summary}, "app": {"id": gate.GATE_APP_ID}}}
        self.assertEqual(self.publish("authoritative", env=env(actions=True, app=True),
                                      api_fn=environment_api(), previous=genuine), [])


class ModeGuardTests(GateTestCase):
    def run_main(self, env):
        with mock.patch.dict(gate.os.environ, {"GITHUB_REPOSITORY": gate.REPO, **env}, clear=True), \
             mock.patch.object(gate, "paginated", return_value=[{"number": 1, "base": {"ref": "main"}}]), \
             mock.patch.object(gate, "update_gate_check") as update:
            gate.main()
            return update

    def test_default_mode_is_advisory(self):
        update = self.run_main(env(actions=True))
        update.assert_called_once_with(1, "advisory")

    def test_invalid_mode_is_refused(self):
        with self.assertRaises(SystemExit):
            self.run_main({"APPVERSE_PUBLISH_MODE": "root"})

    def test_advisory_mode_refuses_to_run_with_the_dedicated_credential_present(self):
        with self.assertRaises(SystemExit):
            self.run_main(env(app=True, APPVERSE_PUBLISH_MODE="advisory"))

    def test_authoritative_mode_passes_through(self):
        update = self.run_main(env(app=True, APPVERSE_PUBLISH_MODE="authoritative"))
        update.assert_called_once_with(1, "authoritative")


if __name__ == "__main__":
    unittest.main()
