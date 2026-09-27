#!/usr/bin/env python3
"""Final certification verdict — collect-all then fail closed on material defects."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "uat-crawl"
RUN_ID = os.environ.get("GITHUB_RUN_ID", "local")
RUN_TRANCHE = os.environ.get("RUN_TRANCHE", "unknown")


def read_json(name: str) -> dict | None:
    path = DOCS / name
    if not path.is_file():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def read_jsonl(name: str) -> list[dict]:
    path = DOCS / name
    if not path.is_file():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError:
            continue
    return rows


def main() -> int:
    failures: list[str] = []
    warnings: list[str] = []
    step_outcomes = read_json("UAT_CRAWL_STEP_OUTCOMES.json") or {}

    if os.environ.get("UAT_DEPLOY_BLOCKED") == "true":
        failures.append("DEPLOY_BLOCKED: no trusted crawl target for current-main tranche")

    for step, outcome in step_outcomes.items():
        if outcome in {"failure", "cancelled"}:
            failures.append(f"STEP_FAILED:{step}")

    if RUN_TRANCHE in {"watchdog-continue", "current-main-rebaseline", "all"}:
        required_steps = [
            "ai_uat",
            "credential_prefix_unblock",
            "post_fix_483",
            "auth_rerun",
            "tranche_03",
            "tranche_04_auth",
            "tranche_05_auth",
            "tranche_06_auth",
            "tranche_07_auth",
            "tranche_08_auth",
            "buyer_mobile",
            "public_continuation",
            "s2_gap_deepening",
            "record_verified_blockers",
            "record_rebaseline",
            "reconciliation",
            "screenshot_wall",
        ]
        for step in required_steps:
            outcome = step_outcomes.get(step)
            if outcome is None:
                failures.append(f"STEP_OUTCOME_MISSING:{step}")
            elif outcome == "skipped":
                failures.append(f"REQUIRED_STEP_SKIPPED:{step}")
    if step_outcomes.get("ai_uat") == "failure":
        failures.append("AI_UAT_SUITE_FAILED")
    if step_outcomes.get("post_fix_483") == "failure":
        failures.append("POST_FIX_483_SUITE_FAILED")

    blockers_summary = read_json("UAT_VERIFIED_BLOCKERS_SUMMARY.json")
    if not blockers_summary or blockers_summary.get("runId") != RUN_ID:
        failures.append("CURRENT_RUN_BLOCKER_SUMMARY_MISSING_OR_STALE")
    else:
        if blockers_summary.get("denominatorReconciled") is False:
            failures.append("CENSUS_RECONCILIATION_FAILED")
        if int(blockers_summary.get("notExecuted") or 0) > 0:
            failures.append(f"NOT_EXECUTED_ROWS:{blockers_summary.get('notExecuted')}")
        if int(blockers_summary.get("credentialsAvailableAwaitingEvidence") or 0) > 0:
            failures.append(
                f"CREDENTIALS_AVAILABLE_WITHOUT_EVIDENCE:{blockers_summary.get('credentialsAvailableAwaitingEvidence')}"
            )
        if int(blockers_summary.get("authFlowFailed") or 0) > 0:
            failures.append(f"AUTH_FLOW_FAILED_ROWS:{blockers_summary.get('authFlowFailed')}")
        if int(blockers_summary.get("authContractMismatch") or 0) > 0:
            failures.append(f"AUTH_CONTRACT_MISMATCH_ROWS:{blockers_summary.get('authContractMismatch')}")
        external_gates = int(blockers_summary.get("otpExternalGate") or 0) + int(
            blockers_summary.get("providerGated") or 0
        )
        if external_gates > 0:
            warnings.append(f"EXTERNAL_PROVIDER_GATES:{external_gates}")

    ai_summary = read_json("UAT_AI_UAT_SUMMARY.json")
    if ai_summary and ai_summary.get("runId") == RUN_ID:
        counts = ai_summary.get("counts") or {}
        if step_outcomes.get("ai_uat") == "failure" and counts.get("PASS", 0) > 0 and not ai_summary.get("priorRunArchived"):
            failures.append("AI_UAT_STALE_PASS: run failed but summary reports PASS from same run metadata conflict")
        if counts.get("NOT_EXECUTED", 0) > 0 and step_outcomes.get("ai_uat") == "failure":
            warnings.append("AI_UAT_NOT_EXECUTED_AFTER_FAILURE")
    elif step_outcomes.get("ai_uat") == "failure":
        failures.append("AI_UAT_FAILED_WITHOUT_CURRENT_RUN_SUMMARY")

    gha_run = read_json("UAT_GHA_RUN.json")
    if gha_run and gha_run.get("deployBlocked") is True:
        failures.append("GHA_RUN_DEPLOY_BLOCKED")
    if (
        gha_run
        and gha_run.get("crawlTargetType")
        and gha_run.get("crawlTargetType") != "PUBLIC_PRODUCTION_ALIAS"
        and "watchdog" in str(gha_run.get("runTranche", ""))
    ):
        warnings.append(f"CRAWL_TARGET_TYPE:{gha_run.get('crawlTargetType')}")

    protection_rows = [
        row
        for row in read_jsonl("UAT_MANIFEST.jsonl") + read_jsonl("UAT_MANIFEST_AUTH.jsonl")
        if row.get("runId") == RUN_ID
        and (
            row.get("blockClassification") == "DEPLOYMENT_PROTECTION"
            or row.get("wallClassification") == "DEPLOYMENT_PROTECTION"
        )
    ]
    if protection_rows:
        failures.append("DEPLOYMENT_PROTECTION:" + ",".join(row.get("uatId", "?") for row in protection_rows))

    rebaseline = read_json("UAT_REBASELINE_CURRENT_MAIN.json")
    if rebaseline and rebaseline.get("runId") == RUN_ID and "a619a7a2" in str(rebaseline.get("deployProvenance", "")):
        failures.append("STALE_PROVENANCE_LABEL_IN_REBASELINE")

    provenance = read_json("UAT_DEPLOY_PROVENANCE.json")
    if provenance and provenance.get("runId") == RUN_ID and "a619a7a2" in str(provenance.get("requiredShaStatus", "")):
        failures.append("STALE_PROVENANCE_LABEL_IN_DEPLOY_PROVENANCE")

    screenshot_audit = read_json("UAT_SCREENSHOT_WALL_AUDIT.json")
    if not screenshot_audit or screenshot_audit.get("runId") != RUN_ID:
        failures.append("SCREENSHOT_WALL_AUDIT_MISSING_OR_STALE")
    elif screenshot_audit.get("wallDetected") is True:
        failures.append("SCREENSHOT_HASH_WALL_SIGNAL")

    rebaseline = read_json("UAT_REBASELINE_CURRENT_MAIN.json")
    if not rebaseline or rebaseline.get("runId") != RUN_ID:
        failures.append("CURRENT_RUN_REBASELINE_MISSING_OR_STALE")

    current_summary = read_json("UAT_CURRENT_RUN_SUMMARY.json")
    if not current_summary or current_summary.get("runId") != RUN_ID:
        failures.append("CURRENT_RUN_SUMMARY_MISSING_OR_STALE")
    elif int((current_summary.get("counts") or {}).get("notExecuted") or 0) > 0:
        failures.append(
            f"CURRENT_RUN_SUMMARY_NOT_EXECUTED:{(current_summary.get('counts') or {}).get('notExecuted')}"
        )

    verdict = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "runId": RUN_ID,
        "runTranche": RUN_TRANCHE,
        "scope": "AUTOMATED_CRAWL_EVIDENCE",
        "passed": len(failures) == 0,
        "failures": failures,
        "warnings": warnings,
        "externalProviderGates": (
            int((blockers_summary or {}).get("otpExternalGate") or 0)
            + int((blockers_summary or {}).get("providerGated") or 0)
        ),
        "stepOutcomes": step_outcomes,
    }
    out_path = DOCS / "UAT_CRAWL_CERTIFICATION_VERDICT.json"
    out_path.write_text(json.dumps(verdict, indent=2) + "\n", encoding="utf-8")
    alias_path = DOCS / "UAT_CRAWL_VERDICT.json"
    alias_path.write_text(json.dumps(verdict, indent=2) + "\n", encoding="utf-8")

    if failures:
        for failure in failures:
            print(f"::error::UAT certification verdict FAILED — {failure}", file=sys.stderr)
        return 1

    print(f"UAT certification verdict PASSED (warnings={len(warnings)}).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
