#!/usr/bin/env python3
"""Detect possible deployment/auth walls via duplicate screenshot hashes across routes."""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "uat-crawl"
RUN_ID = os.environ.get("GITHUB_RUN_ID", "local")
MIN_ROUTES = int(os.environ.get("UAT_SCREENSHOT_WALL_MIN_ROUTES", "5"))


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
    rows = [
        row
        for row in read_jsonl("UAT_MANIFEST.jsonl")
        + read_jsonl("UAT_MANIFEST_AUTH.jsonl")
        + read_jsonl("UAT_MANIFEST_PUBLIC_CONTINUATION.jsonl")
        if not row.get("runId") or row.get("runId") == RUN_ID
    ]

    by_hash: dict[str, dict[str, set[str] | list[str]]] = {}
    for row in rows:
        digest = row.get("screenshotSha256")
        if not digest or row.get("visualStatus") == "BLOCKED":
            continue
        bucket = by_hash.setdefault(digest, {"uatIds": [], "routes": set()})
        bucket["uatIds"].append(row.get("uatId", "?"))
        route = row.get("route")
        if route:
            bucket["routes"].add(route)

    walls = []
    for digest, bucket in by_hash.items():
        uat_ids = bucket["uatIds"]
        routes = bucket["routes"]
        if len(uat_ids) >= MIN_ROUTES and len(routes) >= MIN_ROUTES:
            walls.append({"hash": digest, "uatIds": uat_ids, "routes": sorted(routes)})

    wall_detected = len(walls) > 0
    payload = {
        "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "runId": RUN_ID,
        "wallDetected": wall_detected,
        "minRoutes": MIN_ROUTES,
        "walls": walls,
        "policy": "Duplicate hashes across many routes may indicate Vercel auth wall — combined with title/URL/origin guards, not standalone defect classification.",
    }
    out_path = DOCS / "UAT_SCREENSHOT_WALL_AUDIT.json"
    out_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")

    if wall_detected:
        print(
            f"::warning::Possible screenshot wall detected — {len(walls)} hash group(s) shared across >={MIN_ROUTES} routes.",
            file=sys.stderr,
        )
    else:
        print("Screenshot wall audit: no dominant duplicate-hash wall detected.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
