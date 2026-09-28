#!/usr/bin/env python3
"""Regression coverage for tranche-aware UAT verdict evidence requirements."""
from __future__ import annotations

import importlib.util
import json
import os
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("evaluate-crawl-verdict.py")
spec = importlib.util.spec_from_file_location("uat_verdict", SCRIPT)
if spec is None or spec.loader is None:
    raise RuntimeError("unable to load evaluate-crawl-verdict.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)


def write_json(root: Path, name: str, payload: dict) -> None:
    (root / name).write_text(json.dumps(payload) + "\n", encoding="utf-8")


def run_case(tranche: str, expect: int) -> None:
    with tempfile.TemporaryDirectory() as tmp:
        docs = Path(tmp)
        mod.DOCS = docs
        mod.RUN_ID = "regression-run"
        mod.RUN_TRANCHE = tranche
        os.environ["UAT_DEPLOY_BLOCKED"] = "false"

        outcomes = {
            "ai_uat": "success",
            "credential_prefix_unblock": "skipped",
            "post_fix_483": "skipped",
            "auth_rerun": "skipped",
            "tranche_03": "skipped",
            "tranche_04_auth": "skipped",
            "tranche_05_auth": "skipped",
            "tranche_06_auth": "skipped",
            "tranche_07_auth": "skipped",
            "tranche_08_auth": "skipped",
            "buyer_mobile": "skipped",
            "public_continuation": "skipped",
            "s2_gap_deepening": "skipped",
            "post_merge_497_005": "skipped",
            "record_verified_blockers": "skipped",
            "record_rebaseline": "skipped",
            "reconciliation": "skipped",
            "screenshot_wall": "skipped",
        }
        write_json(docs, "UAT_CRAWL_STEP_OUTCOMES.json", outcomes)
        write_json(
            docs,
            "UAT_GHA_RUN.json",
            {
                "runId": "regression-run",
                "runTranche": tranche,
                "deployBlocked": False,
                "crawlTargetType": "PUBLIC_PRODUCTION_ALIAS",
            },
        )

        result = mod.main()
        if result != expect:
            raise AssertionError(f"{tranche}: expected exit {expect}, got {result}")

        verdict = json.loads((docs / "UAT_CRAWL_CERTIFICATION_VERDICT.json").read_text(encoding="utf-8"))
        if tranche == "auth-contract-smoke":
            assert verdict["scope"] == "TARGETED_CRAWL_EVIDENCE"
            assert verdict["passed"] is True
            assert verdict["externalProviderGates"] == 0
            assert not any("MISSING_OR_STALE" in item for item in verdict["failures"])
        else:
            assert verdict["scope"] == "AUTOMATED_CRAWL_EVIDENCE"
            assert verdict["passed"] is False
            assert any("REQUIRED_STEP_SKIPPED" in item for item in verdict["failures"])


run_case("auth-contract-smoke", 0)
run_case("all", 1)
print("tranche-aware UAT verdict regression passed")
