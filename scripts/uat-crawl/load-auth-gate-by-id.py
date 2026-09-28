#!/usr/bin/env python3
"""Load current-run auth gate classifications from manifest JSONL sources."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "uat-crawl"
RUN_ID = os.environ.get("GITHUB_RUN_ID", "local")

AUTH_GATE_CLASSIFICATIONS = {
    "MISSING_SECRET",
    "AUTH_FLOW_FAILED",
    "AUTH_CONTRACT_MISMATCH",
    "PROVIDER_GATED",
    "OTP_EXTERNAL_GATE",
    "APPLICATION_FAIL",
    "NOT_EXECUTED",
    "DATA_FIXTURE_GATE",
    "TEST_CREDENTIAL_GATE",
}

FIXTURE_MISS_MARKERS = (
    "Could not open pending review sheet",
    "no pending apps",
    "selector miss",
)


def read_jsonl(path: Path) -> list[dict]:
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


def is_data_fixture_gate_row(row: dict) -> bool:
    if row.get("blockClassification") == "DATA_FIXTURE_GATE":
        return True
    if row.get("authenticated") is not True:
        return False
    ux = row.get("uxEvidence") or {}
    if not ux.get("s0"):
        return False
    if ux.get("s3"):
        return False
    notes = str(row.get("notes") or "")
    return any(marker in notes for marker in FIXTURE_MISS_MARKERS)


def infer_test_credential_gate(row: dict) -> str | None:
    if row.get("blockClassification") == "TEST_CREDENTIAL_GATE":
        return "TEST_CREDENTIAL_GATE"
    if row.get("authenticated"):
        return None
    missing = row.get("missingSecretNames") or []
    if missing:
        return None
    if not row.get("credentialPrefix"):
        return None
    haystack = " ".join((row.get("networkErrors") or []) + (row.get("consoleErrors") or []))
    if row.get("blockClassification") == "AUTH_FLOW_FAILED" and (
        ("400" in haystack and "auth/v1/token" in haystack) or "SESSION_CREATE_FAILED" in haystack
    ):
        return "TEST_CREDENTIAL_GATE"
    return None


def main() -> int:
    mapping: dict[str, str] = {}
    for path in [DOCS / "UAT_MANIFEST_POST_FIX_483.jsonl"]:
        for row in read_jsonl(path):
            if row.get("runId") != RUN_ID:
                continue
            uat_id = row.get("uatId")
            if not uat_id:
                continue
            if is_data_fixture_gate_row(row):
                mapping[uat_id] = "DATA_FIXTURE_GATE"

    sources = [
        DOCS / "UAT_MANIFEST_AUTH.jsonl",
        DOCS / "UAT_MANIFEST_BUYER_MOBILE.jsonl",
        DOCS / "UAT_MANIFEST_AI_UAT.jsonl",
    ]
    for path in sources:
        for row in read_jsonl(path):
            if row.get("runId") != RUN_ID:
                continue
            if row.get("authenticated"):
                continue
            uat_id = row.get("uatId")
            if not uat_id:
                continue
            test_cred = infer_test_credential_gate(row)
            if test_cred:
                mapping[uat_id] = test_cred
                continue
            classification = row.get("blockClassification")
            if classification in AUTH_GATE_CLASSIFICATIONS:
                mapping[uat_id] = classification
                continue
            notes = str(row.get("notes") or "")
            if row.get("visualStatus") == "NOT_EXECUTED":
                mapping[uat_id] = "NOT_EXECUTED"
            elif "OTP" in notes or "MSG91" in notes or "provider" in notes.lower():
                mapping[uat_id] = "OTP_EXTERNAL_GATE"
            elif "Welcome Back" in notes or "contract mismatch" in notes or "AUTH_CONTRACT" in notes:
                mapping[uat_id] = "AUTH_CONTRACT_MISMATCH"
            elif "LOGIN FAILED" in notes or "AUTH_FLOW" in notes or "still on login" in notes.lower():
                mapping[uat_id] = "AUTH_FLOW_FAILED"
    json.dump(mapping, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
