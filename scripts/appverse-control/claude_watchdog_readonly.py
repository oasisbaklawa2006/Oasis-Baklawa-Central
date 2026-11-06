#!/usr/bin/env python3
"""Read-only Claude task-observer prototype.

This module NEVER invokes a coding agent, writes to GitHub, requests payment,
or approves a merge.  It only evaluates a checkpoint and independently
collected evidence, producing an advisory decision.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import pathlib
import re
import sys
from typing import Any

SHA_RE = re.compile(r"^[0-9a-f]{40}$")
STATES = {
    "RUNNING", "WAITING_CI", "WAITING_REVIEW", "WAITING_FOR_USER",
    "RATE_LIMITED", "FINISHED", "SUSPECT_STALL", "UNKNOWN"
}
WAIT_STATES = {
    "waiting_ci": "WAITING_CI",
    "waiting_review": "WAITING_REVIEW",
    "waiting_for_user": "WAITING_FOR_USER",
    "rate_limited": "RATE_LIMITED",
    "finished": "FINISHED",
}


def parse_time(value: Any) -> dt.datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else None
    except ValueError:
        return None


def result(state: str, reason: str, checkpoint: dict[str, Any] | None = None) -> dict[str, Any]:
    cp = checkpoint or {}
    return {
        "state": state,
        "reason": reason,
        "task_id": cp.get("task_id") if isinstance(cp.get("task_id"), str) else None,
        "head_sha": cp.get("head_sha") if isinstance(cp.get("head_sha"), str) else None,
        "advisory_only": True,
        "can_resume": False,
        "can_merge": False,
        "requires_gpt_review": True,
    }


def evaluate(
    checkpoint: dict[str, Any] | None,
    evidence: dict[str, Any] | None,
    *,
    now: dt.datetime,
    stall_seconds: int = 900,
) -> dict[str, Any]:
    """Return a fail-closed classification, never operational authorization.

    The caller is responsible for independently authenticating provenance of
    checkpoint and CI/runner evidence. Unverified evidence is UNKNOWN.
    """
    if not isinstance(checkpoint, dict) or not isinstance(evidence, dict):
        return result("UNKNOWN", "missing_checkpoint_or_evidence")
    required = ("repo", "task_id", "session_id", "branch", "head_sha", "last_progress_at")
    if any(not isinstance(checkpoint.get(k), str) or not checkpoint.get(k) for k in required):
        return result("UNKNOWN", "incomplete_checkpoint", checkpoint)
    if not SHA_RE.fullmatch(checkpoint["head_sha"]):
        return result("UNKNOWN", "invalid_head_sha", checkpoint)
    last = parse_time(checkpoint["last_progress_at"])
    if last is None or now.tzinfo is None or last > now:
        return result("UNKNOWN", "invalid_checkpoint_time", checkpoint)
    if evidence.get("authenticated") is not True:
        return result("UNKNOWN", "untrusted_evidence", checkpoint)
    if evidence.get("repo") != checkpoint["repo"] or evidence.get("task_id") != checkpoint["task_id"]:
        return result("UNKNOWN", "evidence_task_mismatch", checkpoint)
    if evidence.get("head_sha") != checkpoint["head_sha"]:
        return result("UNKNOWN", "changed_or_stale_head", checkpoint)
    observed = parse_time(evidence.get("observed_at"))
    if observed is None or observed > now or (now - observed).total_seconds() > 300:
        return result("UNKNOWN", "stale_or_invalid_observation", checkpoint)

    # Independently observed closed PR / completing jobs override inactivity.
    if evidence.get("pr_state") in ("merged", "closed") or evidence.get("task_completed") is True:
        return result("FINISHED", "completion_confirmed", checkpoint)
    if evidence.get("permission_required") is True:
        return result("WAITING_FOR_USER", "permission_or_approval_required", checkpoint)
    if evidence.get("rate_limited") is True:
        return result("RATE_LIMITED", "quota_or_rate_limit", checkpoint)
    if evidence.get("ci_status") in ("queued", "in_progress", "waiting"):
        return result("WAITING_CI", "ci_still_running", checkpoint)
    if evidence.get("review_pending") is True:
        return result("WAITING_REVIEW", "independent_review_pending", checkpoint)
    if evidence.get("runner_active") is True:
        return result("RUNNING", "runner_alive", checkpoint)

    # Never interpret ordinary missing information as a stalled session.
    if evidence.get("runner_active") is not False or evidence.get("ci_status") not in ("success", "failure", "none"):
        return result("UNKNOWN", "insufficient_runner_or_ci_evidence", checkpoint)
    if (now - last).total_seconds() < stall_seconds:
        return result("RUNNING", "recent_progress", checkpoint)

    # Two independent, recent observations, bound to the same exact head,
    # separated by at least two minutes. This remains advisory, not permission.
    prior = evidence.get("prior_observation")
    if not isinstance(prior, dict):
        return result("UNKNOWN", "first_stale_observation_only", checkpoint)
    prior_at = parse_time(prior.get("observed_at"))
    if (
        prior_at is None
        or prior_at > observed
        or (observed - prior_at).total_seconds() < 120
        or (now - prior_at).total_seconds() > stall_seconds
        or prior.get("task_id") != checkpoint["task_id"]
        or prior.get("head_sha") != checkpoint["head_sha"]
        or prior.get("runner_active") is not False
        or prior.get("authenticated") is not True
    ):
        return result("UNKNOWN", "unconfirmed_consecutive_stall", checkpoint)
    return result("SUSPECT_STALL", "two_authenticated_stale_observations", checkpoint)


def main() -> int:
    parser = argparse.ArgumentParser(description="Read-only Appverse Claude watchdog")
    parser.add_argument("--checkpoint", type=pathlib.Path, required=True)
    parser.add_argument("--evidence", type=pathlib.Path, required=True)
    parser.add_argument("--stall-seconds", type=int, default=900)
    args = parser.parse_args()
    if args.stall_seconds < 300:
        parser.error("stall-seconds must be >= 300")
    try:
        cp = json.loads(args.checkpoint.read_text(encoding="utf-8"))
        ev = json.loads(args.evidence.read_text(encoding="utf-8"))
    except (OSError, ValueError) as exc:
        print(json.dumps(result("UNKNOWN", "unavailable_or_invalid_input")))
        return 0
    output = evaluate(cp, ev, now=dt.datetime.now(dt.timezone.utc), stall_seconds=args.stall_seconds)
    print(json.dumps(output, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
