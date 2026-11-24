"""Tests for scripts/appverse-control/update_github_state.sh and its workflow wiring.

The script is executed for real (bash + jq) against a fake `gh` that returns canned GraphQL success payloads and
failures. The failure fixtures are modelled on GitHub's GraphQL error shape and on the exact stderr line seen in the
failed scheduled run 45061741055 (`gh: Could not resolve to a Repository with the name '<owner>/<name>'.`). They are
fixtures, not live captures: GitHub GraphQL was not reachable from the authoring sandbox.

Behaviour under test:
  * an access answer (GraphQL NOT_FOUND/FORBIDDEN, HTTP 403/404) for ONE repository is recorded honestly as
    unreadable (null counts, never zero/empty) while readable repositories still produce the snapshot;
  * everything else (rate limits, bad credentials, 5xx, mid-pagination failures, incomplete pagination, no readable
    repository at all) still fails closed and writes no file.
"""

import json
import os
import re
import shutil
import stat
import subprocess  # nosec B404 - the test must execute the snapshot script; argv is fixed, no shell
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT = REPO_ROOT / "scripts" / "appverse-control" / "update_github_state.sh"
WORKFLOW = REPO_ROOT / ".github" / "workflows" / "appverse-mission-control.yml"

FAKE_GH = """#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
def arg(key):
    for i, a in enumerate(args):
        if a == "-F" and args[i + 1].startswith(key + "="):
            return args[i + 1].split("=", 1)[1]
    return None
repo = arg("owner") + "/" + arg("name")
after = arg("after")
cfg = json.load(open(os.environ["FAKE_GH_CONFIG"]))
entry = cfg[repo]
if isinstance(entry, dict) and "pages" in entry:
    entry = entry["pages"][1 if after else 0]
if entry.get("fail"):
    sys.stdout.write(entry.get("stdout", ""))
    sys.stderr.write(entry["stderr"] + "\\n")
    sys.exit(1)
sys.stdout.write(json.dumps(entry["payload"]))
"""


def payload(prs=2, default_branch="main", archived=False, total=None, has_next=False, cursor=None):
    nodes = []
    for number in range(1, prs + 1):
        nodes.append({
            "number": number,
            "title": f"PR {number}",
            "url": f"https://example.test/pr/{number}",
            "isDraft": number % 2 == 0,
            "updatedAt": "2026-11-20T00:00:00Z",
            "baseRefName": default_branch,
            "headRefOid": f"{number:040x}",
            "mergeable": "MERGEABLE",
            "commits": {"nodes": [{"commit": {"statusCheckRollup": {
                "state": "SUCCESS",
                "contexts": {"pageInfo": {"hasNextPage": False}, "nodes": [
                    {"__typename": "CheckRun", "name": "ci", "status": "COMPLETED",
                     "conclusion": "SUCCESS", "detailsUrl": "https://example.test/run"},
                ]},
            }}}]},
        })
    return {"data": {"repository": {
        "isArchived": archived,
        "defaultBranchRef": {"name": default_branch},
        "pullRequests": {
            "totalCount": len(nodes) if total is None else total,
            "pageInfo": {"hasNextPage": has_next, "endCursor": cursor},
            "nodes": nodes,
        },
    }}}


def ok(**kwargs):
    return {"payload": payload(**kwargs)}


def failure(stderr, stdout=""):
    return {"fail": True, "stderr": stderr, "stdout": stdout}


def not_found(repo):
    message = f"Could not resolve to a Repository with the name '{repo}'."
    body = {"data": {"repository": None}, "errors": [
        {"type": "NOT_FOUND", "path": ["repository"], "locations": [{"line": 2, "column": 3}], "message": message}]}
    return failure(f"gh: {message}", json.dumps(body))


def graphql_forbidden():
    message = "Resource not accessible by integration"
    body = {"data": {"repository": None}, "errors": [{"type": "FORBIDDEN", "path": ["repository"], "message": message}]}
    return failure(f"gh: {message}", json.dumps(body))


class SnapshotScriptTests(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.tmp, ignore_errors=True)
        (self.tmp / "scripts" / "appverse-control").mkdir(parents=True)
        (self.tmp / "appverse-control").mkdir()
        (self.tmp / "bin").mkdir()
        shutil.copy(SCRIPT, self.tmp / "scripts" / "appverse-control" / "update_github_state.sh")
        gh = self.tmp / "bin" / "gh"
        gh.write_text(FAKE_GH)
        gh.chmod(gh.stat().st_mode | stat.S_IEXEC)
        self.default_out = self.tmp / "appverse-control" / "generated" / "github-state.json"

    def run_script(self, repos, config, out_override=None):
        (self.tmp / "appverse-control" / "state.json").write_text(json.dumps({"repositories": repos}))
        (self.tmp / "config.json").write_text(json.dumps(config))
        env = dict(os.environ, PATH=f"{self.tmp / 'bin'}:{os.environ['PATH']}",
                   FAKE_GH_CONFIG=str(self.tmp / "config.json"))
        env.pop("APPVERSE_GITHUB_STATE_OUT", None)
        if out_override:
            env["APPVERSE_GITHUB_STATE_OUT"] = str(out_override)
        # Fully literal argv (absolute bash + relative script) run inside this test's own temp tree: no shell, no input.
        return subprocess.run(["/bin/bash", "scripts/appverse-control/update_github_state.sh"],  # nosec B603
                              cwd=self.tmp, capture_output=True, text=True, env=env, check=False)

    def read(self, path=None):
        return json.loads((path or self.default_out).read_text())

    # (b) readable repositories populate accurately; (a) one unreadable repository is recorded honestly
    def test_not_found_on_one_repo_is_recorded_unreadable_and_readable_repos_still_populate(self):
        repos = ["o/central", "o/buyer"]
        result = self.run_script(repos, {"o/central": ok(prs=3, default_branch="main"), "o/buyer": not_found("o/buyer")})
        self.assertEqual(result.returncode, 0, result.stderr)
        data = self.read()
        central = data["repositories"]["o/central"]
        self.assertTrue(central["readable"])
        self.assertEqual(central["access_status"], "readable")
        self.assertEqual(central["default_branch"], "main")
        self.assertFalse(central["archived"])
        self.assertEqual(central["open_pr_count"], 3)
        self.assertEqual([pr["number"] for pr in central["open_prs"]], [1, 2, 3])
        self.assertEqual(central["open_prs"][0]["combined_status"], "SUCCESS")
        buyer = data["repositories"]["o/buyer"]
        self.assertFalse(buyer["readable"])
        self.assertEqual(buyer["access_status"], "unreadable_with_configured_token")
        self.assertEqual(buyer["error_class"], "NOT_FOUND")
        # Honest: counts are unknown (null), never a fabricated zero/empty list.
        for key in ("default_branch", "archived", "open_pr_count", "open_prs"):
            self.assertIsNone(buyer[key], key)
        self.assertEqual(data["unreadable_repositories"], ["o/buyer"])
        self.assertIn("::warning", result.stdout)
        self.assertIn("o/buyer", result.stdout)

    def test_forbidden_variants_are_recorded_as_forbidden(self):
        variants = {
            "graphql FORBIDDEN": graphql_forbidden(),
            "HTTP 403 resource not accessible": failure("gh: Resource not accessible by integration (HTTP 403)",
                                                         '{"message":"Resource not accessible by integration","status":"403"}'),
        }
        for label, fixture in variants.items():
            with self.subTest(label):
                result = self.run_script(["o/central", "o/buyer"], {"o/central": ok(prs=1), "o/buyer": fixture})
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(self.read()["repositories"]["o/buyer"]["error_class"], "FORBIDDEN")
                self.default_out.unlink()

    def test_http_404_is_recorded_as_not_found(self):
        result = self.run_script(["o/central", "o/buyer"],
                                 {"o/central": ok(prs=1), "o/buyer": failure("gh: Not Found (HTTP 404)")})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.read()["repositories"]["o/buyer"]["error_class"], "NOT_FOUND")

    # (c) non-auth fatal errors still fail closed and publish nothing
    def test_non_access_failures_fail_closed_and_write_no_file(self):
        fatal = {
            "http 502": failure("gh: Server Error (HTTP 502)"),
            "primary rate limit (403)": failure("gh: API rate limit exceeded for user ID 1. (HTTP 403)"),
            "secondary rate limit (403)": failure("gh: You have exceeded a secondary rate limit. (HTTP 403)"),
            "bad credentials": failure("gh: Bad credentials (HTTP 401)"),
            "network error": failure("gh: error connecting to api.github.com"),
        }
        for label, fixture in fatal.items():
            with self.subTest(label):
                result = self.run_script(["o/central", "o/buyer"], {"o/central": ok(prs=1), "o/buyer": fixture})
                self.assertNotEqual(result.returncode, 0, "must fail closed")
                self.assertFalse(self.default_out.exists(), "no partial snapshot may be written")
                self.assertIn("o/buyer", result.stderr)

    def test_mixed_access_and_unrecognised_errors_fail_closed(self):
        def body(errors):
            return failure("gh: mixed errors", json.dumps({"data": {"repository": None}, "errors": errors}))
        mixed = {
            "forbidden + internal": body([{"type": "FORBIDDEN", "message": "no"}, {"type": "INTERNAL", "message": "boom"}]),
            "not_found + untyped": body([{"type": "NOT_FOUND", "message": "gone"}, {"message": "untyped"}]),
            "only unknown type": body([{"type": "INTERNAL", "message": "boom"}]),
        }
        for label, fixture in mixed.items():
            with self.subTest(label):
                result = self.run_script(["o/central", "o/buyer"], {"o/central": ok(prs=1), "o/buyer": fixture})
                self.assertNotEqual(result.returncode, 0, "must fail closed")
                self.assertFalse(self.default_out.exists())

    def test_multiple_access_errors_of_supported_types_are_still_degraded(self):
        both = failure("gh: access", json.dumps({"data": {"repository": None}, "errors": [
            {"type": "NOT_FOUND", "message": "a"}, {"type": "NOT_FOUND", "message": "b"}]}))
        result = self.run_script(["o/central", "o/buyer"], {"o/central": ok(prs=1), "o/buyer": both})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.read()["repositories"]["o/buyer"]["readable"])

    def test_all_repositories_unreadable_fails_closed(self):
        result = self.run_script(["o/a", "o/b"], {"o/a": not_found("o/a"), "o/b": not_found("o/b")})
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.default_out.exists())
        self.assertIn("No repository was readable", result.stderr)

    def test_access_failure_mid_pagination_is_fatal_not_degraded(self):
        paged = {"pages": [ok(prs=1, total=2, has_next=True, cursor="c1"), not_found("o/buyer")]}
        result = self.run_script(["o/central", "o/buyer"], {"o/central": ok(prs=1), "o/buyer": paged})
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.default_out.exists())

    def test_incomplete_pagination_still_fails_closed(self):
        result = self.run_script(["o/central"], {"o/central": ok(prs=2, total=3)})
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.default_out.exists())
        self.assertIn("Incomplete PR pagination", result.stderr)

    def test_unchanged_snapshot_is_a_noop_even_with_an_unreadable_repo(self):
        config = {"o/central": ok(prs=2), "o/buyer": not_found("o/buyer")}
        first = self.run_script(["o/central", "o/buyer"], config)
        self.assertEqual(first.returncode, 0, first.stderr)
        before = self.default_out.read_bytes()
        second = self.run_script(["o/central", "o/buyer"], config)
        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertIn("already current", second.stdout)
        self.assertEqual(self.default_out.read_bytes(), before, "file must be byte-identical (no churn, no empty commit)")

    def test_repo_becomes_readable_when_a_token_is_later_provided_with_no_code_change(self):
        repos = ["o/central", "o/buyer"]
        self.assertEqual(self.run_script(repos, {"o/central": ok(prs=1), "o/buyer": not_found("o/buyer")}).returncode, 0)
        self.assertFalse(self.read()["repositories"]["o/buyer"]["readable"])
        again = self.run_script(repos, {"o/central": ok(prs=1), "o/buyer": ok(prs=4, default_branch="trunk")})
        self.assertEqual(again.returncode, 0, again.stderr)
        buyer = self.read()["repositories"]["o/buyer"]
        self.assertTrue(buyer["readable"])
        self.assertEqual(buyer["open_pr_count"], 4)
        self.assertEqual(buyer["default_branch"], "trunk")
        self.assertEqual(self.read()["unreadable_repositories"], [])

    def test_output_path_override_is_honoured(self):
        custom = self.tmp / "elsewhere" / "state.json"
        result = self.run_script(["o/central"], {"o/central": ok(prs=1)}, out_override=custom)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(custom.exists())
        self.assertFalse(self.default_out.exists())


def step_blocks(text):
    parts = re.split(r"(?m)^(?=      - (?:name|uses):)", text)
    return {re.match(r"      - (?:name|uses): (.+)", part).group(1).strip(): part
            for part in parts if re.match(r"      - (?:name|uses): ", part)}


class WorkflowWiringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = WORKFLOW.read_text()
        cls.steps = step_blocks(cls.text)
        cls.refresh = cls.steps["Refresh objective GitHub evidence"]
        cls.commit = cls.steps["Commit live evidence only when changed"]

    def test_read_token_is_optional_and_confined_to_the_refresh_step(self):
        self.assertEqual(self.text.count("secrets.APPVERSE_READ_TOKEN"), 2, "one expression + one comment reference")
        self.assertIn("GH_TOKEN: ${{ secrets.APPVERSE_READ_TOKEN || github.token }}", self.refresh)
        self.assertNotIn("APPVERSE_READ_TOKEN", self.commit)
        self.assertRegex(self.commit, r"GH_TOKEN: \$\{\{ github\.token \}\}")

    def test_refresh_runs_the_workflow_commit_copy_and_writes_into_the_live_state_checkout(self):
        self.assertIn("run: bash _mc_src/scripts/appverse-control/update_github_state.sh", self.refresh)
        self.assertIn("APPVERSE_GITHUB_STATE_OUT: ${{ github.workspace }}/appverse-control/generated/github-state.json",
                      self.refresh)

    def test_source_checkout_is_pinned_credential_free_and_of_the_workflow_commit(self):
        block = self.steps["Checkout snapshot script from the workflow commit"]
        self.assertRegex(block, r"uses: actions/checkout@[0-9a-f]{40}")
        self.assertIn("ref: ${{ github.sha }}", block)
        self.assertIn("path: _mc_src", block)
        self.assertIn("persist-credentials: false", block)

    def test_live_state_checkout_precedes_source_checkout_and_refresh(self):
        order = [m.start() for m in (re.search(re.escape(k), self.text) for k in (
            "Checkout dedicated live-state branch", "Checkout snapshot script from the workflow commit",
            "Refresh objective GitHub evidence", "Commit live evidence only when changed"))]
        self.assertEqual(order, sorted(order))

    def test_commit_step_still_stages_before_comparing(self):
        self.assertLess(self.commit.index("git add -- appverse-control/generated/github-state.json"),
                        self.commit.index("git diff --cached --quiet"))


if __name__ == "__main__":
    unittest.main()
