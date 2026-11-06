"""Offline fail-closed tests for the trusted Appverse merge gate."""
import importlib.util
import pathlib
import unittest
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location(
    "appverse_merge_gate", ROOT / "scripts/appverse-control/appverse_merge_gate.py"
)
gate = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(gate)


class GatePolicyTests(unittest.TestCase):
    def test_no_required_ruleset_rejects(self):
        with mock.patch.object(gate, "api", return_value={"enforcement": "active", "rules": []}):
            self.assertFalse(gate.configured_ruleset())

    def test_loose_required_rule_rejects(self):
        response = {"enforcement": "active", "rules": [{"type": "required_status_checks",
            "parameters": {"strict_required_status_checks_policy": False,
                           "required_status_checks": [{"context": gate.CHECK_NAME}]}}]}
        with mock.patch.object(gate, "api", return_value=response):
            self.assertFalse(gate.configured_ruleset())

    def test_strict_required_rule_accepts(self):
        status_rule = {"enforcement": "active", "bypass_actors": [], "rules": [{
            "type": "required_status_checks", "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [{"context": gate.CHECK_NAME, "integration_id": 15368}],
            },
        }]}
        governance = {"enforcement": "active", "bypass_actors": [], "rules": [{
            "type": "pull_request", "parameters": {
                "required_approving_review_count": 1,
                "require_code_owner_review": True,
                "dismiss_stale_reviews_on_push": True,
                "required_review_thread_resolution": True,
            },
        }]}
        with mock.patch.object(gate, "api", side_effect=[status_rule, governance]):
            self.assertTrue(gate.configured_ruleset())

    def test_bypass_actor_rejects(self):
        status_rule = {"enforcement": "active", "bypass_actors": [{"actor_id": 5}], "rules": [{
            "type": "required_status_checks", "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [{"context": gate.CHECK_NAME, "integration_id": 15368}],
            },
        }]}
        with mock.patch.object(gate, "api", return_value=status_rule):
            self.assertFalse(gate.configured_ruleset())

    def test_code_owner_review_must_be_enforced(self):
        status_rule = {"enforcement": "active", "bypass_actors": [], "rules": [{
            "type": "required_status_checks", "parameters": {
                "strict_required_status_checks_policy": True,
                "required_status_checks": [{"context": gate.CHECK_NAME, "integration_id": 15368}],
            },
        }]}
        governance = {"enforcement": "active", "bypass_actors": [], "rules": [{
            "type": "pull_request", "parameters": {
                "required_approving_review_count": 1, "require_code_owner_review": False,
                "dismiss_stale_reviews_on_push": True, "required_review_thread_resolution": True,
            },
        }]}
        with mock.patch.object(gate, "api", side_effect=[status_rule, governance]):
            self.assertFalse(gate.configured_ruleset())

    def test_pending_outranks_stale_success(self):
        checks = [
            {"name": "CodeRabbit", "app": {"slug": "coderabbitai"}, "status": "completed",
             "conclusion": "success", "id": 1, "started_at": "2026-11-06T00:00:00Z"},
            {"name": "CodeRabbit", "app": {"slug": "coderabbitai"}, "status": "in_progress",
             "conclusion": None, "id": 2, "started_at": "2026-11-06T01:00:00Z"},
        ]
        with mock.patch.object(gate, "paginated", return_value=checks):
            self.assertEqual(
                gate.latest_checks("0" * 40)[("CodeRabbit", "coderabbitai")]["status"],
                "in_progress",
            )

    def test_unresolved_review_thread_rejects(self):
        payload = {"repository": {"pullRequest": {"reviewThreads": {
            "nodes": [{"isResolved": False}], "pageInfo": {"hasNextPage": False}
        }}}}
        with mock.patch.object(gate, "graphql", return_value=payload):
            self.assertEqual(gate.unresolved_threads(5), 1)

    def test_old_head_approval_rejects(self):
        reviews = [{"user": {"login": "cursor[bot]"}, "state": "APPROVED", "commit_id": "1" * 40}]
        with mock.patch.object(gate, "paginated", return_value=reviews):
            self.assertFalse(gate.review_approval(1, "2" * 40, "oasisbaklawa2006"))

    def test_author_self_approval_rejects(self):
        reviews = [{"user": {"login": "oasisbaklawa2006"},
                    "state": "APPROVED", "commit_id": "1" * 40}]
        with mock.patch.object(gate, "paginated", return_value=reviews):
            self.assertFalse(gate.review_approval(1, "1" * 40, "oasisbaklawa2006"))

    def test_changes_requested_rejects_bot_approval(self):
        reviews = [
            {"user": {"login": "cursor[bot]"}, "state": "APPROVED", "commit_id": "1" * 40},
            {"user": {"login": "another"}, "state": "CHANGES_REQUESTED", "commit_id": "1" * 40},
        ]
        with mock.patch.object(gate, "paginated", return_value=reviews):
            self.assertFalse(gate.review_approval(1, "1" * 40, "oasisbaklawa2006"))

    def test_evidence_only_candidate_never_eligible(self):
        pr = {
            "number": 651, "head": {"sha": "a" * 40},
            "base": {"ref": "main", "sha": "b" * 40},
            "state": "open", "draft": False, "title": "NOT FOR MERGE",
            "labels": [{"name": gate.LABEL}], "mergeable": True,
            "mergeable_state": "clean", "user": {"login": "oasisbaklawa2006"},
        }
        with mock.patch.multiple(
            gate, configured_ruleset=lambda: True,
            paginated=lambda _: [], latest_checks=lambda _: {},
            latest_statuses=lambda _: {}, unresolved_threads=lambda _: 0,
            review_approval=lambda *args: True, current_pr=lambda _: pr,
        ):
            self.assertTrue(any("Evidence-only" in error for error in gate.validate(pr)))


if __name__ == "__main__":
    unittest.main()
