#!/usr/bin/env python3
"""Appverse task observer, Stage 1: read-only, offline, dry-run.

Decides what a Claude/Cursor task is doing from (a) an authenticated heartbeat record the task's runner writes and
(b) authenticated evidence a trusted collector gathered independently from GitHub. It proposes OBSERVE, HOLD or
POTENTIAL_STALL and nothing else.

What this module deliberately CANNOT do (enforced by tests):
* touch the network, start processes, or write any file;
* restart an agent, send a prompt, push, comment, or approve/merge anything;
* treat missing, unverifiable, stale, replayed, mismatched or ambiguous input as a stall. Those are UNKNOWN, which
  always proposes HOLD.

Not built in Stage 1 (later stages, owner-gated): the GPT reviewer, any paid API, the recovery runner, the budget meter,
the protected merge actor.
"""
from __future__ import annotations

import argparse
import datetime
import hashlib
import hmac
import json
import os
import re
import sys

RECORD_SCHEMA = "appverse.task-record/1"
EVIDENCE_SCHEMA = "appverse.task-evidence/1"
OBSERVATION_SCHEMA = "appverse.observation/1"

STATES = ("RUNNING", "WAITING_CI", "WAITING_REVIEW", "WAITING_FOR_USER", "RATE_LIMITED", "FINISHED", "STALLED", "UNKNOWN")
PROPOSALS = ("OBSERVE", "HOLD", "POTENTIAL_STALL")

# Stable reason codes -> operator-readable text. Renaming a code is a breaking change (see the golden test).
REASONS = {
    # RUNNING
    "HEARTBEAT_FRESH": "An authenticated heartbeat is recent and the lease is valid.",
    # WAITING_*
    "CI_RUNNING": "CI is observably queued or running on this exact head.",
    "REVIEW_PENDING": "An independent review of this exact head is pending.",
    "REVIEW_TOOL_RATE_LIMITED": "The review tool (e.g. CodeRabbit) is rate limited or neutral; a review wait, not a stall.",
    "HUMAN_APPROVAL_REQUIRED": "A human or code-owner approval is required before work can continue.",
    "USER_INPUT_REQUIRED": "The task is waiting for user input.",
    # RATE_LIMITED
    "AGENT_QUOTA_EXHAUSTED": "The agent's own quota or rate limit is exhausted; restarting would not help.",
    # FINISHED
    "PR_CLOSED_OR_MERGED": "The pull request is independently observed closed or merged.",
    "TASK_REPORTED_DONE": "The task authenticated a completed state.",
    # STALLED
    "NO_PROGRESS_TWO_OBSERVATIONS": "Two verified observations, far enough apart, show the same heartbeat and nothing the task could be waiting on.",
    # UNKNOWN / HOLD
    "NO_TELEMETRY": "No heartbeat record is available.",
    "RECORD_INVALID": "The heartbeat record does not match the strict schema.",
    "KEYS_UNAVAILABLE": "Verification keys are missing or unsafe, so nothing can be authenticated.",
    "HEARTBEAT_KEY_UNKNOWN": "The heartbeat names a key that is not trusted for heartbeats.",
    "HEARTBEAT_UNAUTHENTICATED": "The heartbeat authentication code does not verify; treated as forged.",
    "HEARTBEAT_REPLAY": "The heartbeat is older than, or conflicts with, one already seen.",
    "CLOCK_SKEW": "A timestamp is in the future beyond the allowed skew.",
    "STATUS_API_UNAVAILABLE": "Independent evidence is missing or the status API was unavailable.",
    "EVIDENCE_INVALID": "The collector evidence does not match the strict schema.",
    "EVIDENCE_UNAUTHENTICATED": "The collector evidence does not verify.",
    "EVIDENCE_STALE": "The collector evidence is too old to rely on.",
    "EVIDENCE_TASK_MISMATCH": "The evidence is about a different repository or branch.",
    "HEAD_SHA_CHANGED": "The live head SHA differs from the SHA the task recorded.",
    "CONCURRENT_WRITER": "Another writer is active on this branch.",
    "LEASE_HOLDER_MISMATCH": "The observed lease holder is not the holder named in the record.",
    "LEASE_EXPIRED": "The lease has expired; the holder is no longer authoritative.",
    "HEARTBEAT_AGING": "The heartbeat is ageing but not old enough to judge.",
    "CI_STATE_UNKNOWN": "CI state could not be determined.",
    "FIRST_STALE_OBSERVATION": "Only one stale observation exists; a second is required.",
    "DUPLICATE_OBSERVATION": "The earlier observation is the same observation, not an independent second one.",
    "OBSERVATIONS_TOO_CLOSE": "The two observations are closer together than the minimum gap.",
    "UNCONFIRMED_STALL": "The earlier observation does not confirm the stall (progress, other head, or wrong task).",
}
STATE_FOR_REASON = {
    "HEARTBEAT_FRESH": "RUNNING", "CI_RUNNING": "WAITING_CI", "REVIEW_PENDING": "WAITING_REVIEW",
    "REVIEW_TOOL_RATE_LIMITED": "WAITING_REVIEW", "HUMAN_APPROVAL_REQUIRED": "WAITING_FOR_USER",
    "USER_INPUT_REQUIRED": "WAITING_FOR_USER", "AGENT_QUOTA_EXHAUSTED": "RATE_LIMITED",
    "PR_CLOSED_OR_MERGED": "FINISHED", "TASK_REPORTED_DONE": "FINISHED", "NO_PROGRESS_TWO_OBSERVATIONS": "STALLED",
}

ID = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{5,63}")
REPO = re.compile(r"[A-Za-z0-9._-]{1,39}/[A-Za-z0-9._-]{1,100}")
BRANCH = re.compile(r"[A-Za-z0-9][A-Za-z0-9._/-]{0,199}")
SHA = re.compile(r"[0-9a-f]{40}")
STAGE = re.compile(r"[A-Za-z0-9_.-]{1,32}")
STAMP = re.compile(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", re.ASCII)
URL = re.compile(r"https://github\.com/([A-Za-z0-9._-]{1,39}/[A-Za-z0-9._-]{1,100})/"
                 r"(?:actions/runs/\d{1,20}(?:/job/\d{1,20})?|pull/\d{1,10}|runs/\d{1,20})")
HEX64 = re.compile(r"[0-9a-f]{64}")
ACTION_TYPES = frozenset({"edit", "test", "push", "wait_ci", "wait_review", "wait_user", "idle", "done", "other"})
WAITING_REASONS = frozenset({"ci_running", "review_pending", "review_tool_rate_limited", "human_approval", "user_input", "agent_quota"})
CI_STATES = frozenset({"none", "queued", "in_progress", "success", "failure", "cancelled", "unknown"})
PR_STATES = frozenset({"open", "closed", "merged", "unknown"})
KEY_PREFIX = {"record": "hb-", "evidence": "ev-", "history": "obs-"}  # purpose separation: one key cannot mint another's input
MAX_INPUT_BYTES = 65536

DEFAULTS = {"fresh_seconds": 300, "stall_seconds": 900, "min_gap_seconds": 120, "skew_seconds": 120, "evidence_max_age_seconds": 300}
# Bounded retention for the persisted observation history (no prompts, chat, PII or credentials are ever stored).
RETENTION = {"max_age_days": 14, "max_entries_per_task": 20, "max_tasks": 200, "max_total_bytes": 262144}


class ObserverError(Exception):
    """Raised for caller mistakes (bad config); classification itself never raises."""


# ------------------------------------------------------------------------------------------------ time and config
def parse_ts(value) -> datetime.datetime | None:
    if not isinstance(value, str) or not STAMP.fullmatch(value):
        return None
    try:
        return datetime.datetime.strptime(value, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=datetime.timezone.utc)
    except ValueError:
        return None


def fmt_ts(moment: datetime.datetime) -> str:
    return moment.astimezone(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def make_config(**overrides) -> dict:
    """Validated thresholds. Hostile or careless values (a stall window of 5 seconds) are rejected, not clamped."""
    cfg = dict(DEFAULTS)
    unknown = set(overrides) - set(DEFAULTS)
    if unknown:
        raise ObserverError(f"unknown config keys: {sorted(unknown)}")
    cfg.update(overrides)
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in cfg.values()):
        raise ObserverError("config values must be integers")
    if not (60 <= cfg["fresh_seconds"] <= 3600):
        raise ObserverError("fresh_seconds must be 60..3600")
    if not (300 <= cfg["stall_seconds"] <= 86400) or cfg["stall_seconds"] <= cfg["fresh_seconds"]:
        raise ObserverError("stall_seconds must be 300..86400 and greater than fresh_seconds")
    if not (60 <= cfg["min_gap_seconds"] <= cfg["stall_seconds"]):
        raise ObserverError("min_gap_seconds must be 60..stall_seconds")
    if not (0 <= cfg["skew_seconds"] <= 300):
        raise ObserverError("skew_seconds must be 0..300")
    if not (60 <= cfg["evidence_max_age_seconds"] <= 600):
        raise ObserverError("evidence_max_age_seconds must be 60..600")
    return cfg


# ------------------------------------------------------------------------------------------------ authentication
def canonical(obj: dict) -> bytes:
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("ascii")


def compute_mac(obj: dict, key: bytes) -> str:
    return hmac.new(key, canonical({k: v for k, v in obj.items() if k != "mac"}), hashlib.sha256).hexdigest()


def sign(obj: dict, key: bytes, key_id: str) -> dict:
    """For the writer side (runner, collector, observer). Returns a copy carrying key_id and mac."""
    body = {k: v for k, v in obj.items() if k not in ("mac", "key_id")}
    body["key_id"] = key_id
    body["mac"] = compute_mac(body, key)
    return body


def verify(obj: dict, keys: dict, purpose: str) -> str | None:
    """None when authentic; otherwise 'KEY_UNKNOWN' or 'UNAUTHENTICATED'."""
    key_id = obj.get("key_id")
    if not isinstance(key_id, str) or not key_id.startswith(KEY_PREFIX[purpose]) or key_id not in keys:
        return "KEY_UNKNOWN"
    mac = obj.get("mac")
    if not isinstance(mac, str) or not HEX64.fullmatch(mac) or not hmac.compare_digest(mac, compute_mac(obj, keys[key_id])):
        return "UNAUTHENTICATED"
    return None


def load_keys(path: str) -> dict:
    """Keys file: JSON {key_id: hex}. Must not be readable by group/other. Never printed or logged."""
    mode = os.stat(path).st_mode
    if mode & 0o077:
        raise ObserverError("keys file permissions are too open")
    if os.stat(path).st_size > MAX_INPUT_BYTES:
        raise ObserverError("keys file too large")
    with open(path, "rb") as handle:
        raw = json.loads(handle.read())
    keys = {}
    for key_id, hex_value in raw.items():
        if not (isinstance(key_id, str) and any(key_id.startswith(p) for p in KEY_PREFIX.values())):
            raise ObserverError("key ids must start with hb-, ev- or obs-")
        if not isinstance(hex_value, str):
            raise ObserverError("key values must be hex strings")
        key = bytes.fromhex(hex_value)
        if len(key) < 32:
            raise ObserverError("keys must be at least 32 bytes")
        keys[key_id] = key
    return keys


# ------------------------------------------------------------------------------------------------ schemas
def _exact(obj, allowed: set) -> bool:
    return isinstance(obj, dict) and set(obj) == allowed


def _body_exact(obj, body_fields: set) -> bool:
    """The body must match exactly; key_id and mac may be absent here because verify() judges authentication separately,
    so an unsigned object is reported as unauthenticated rather than as a schema error."""
    return isinstance(obj, dict) and set(obj) - {"key_id", "mac"} == body_fields


def _match(value, pattern) -> bool:
    """A real string that fully matches; str() coercion would let an integer pass as an identifier."""
    return isinstance(value, str) and bool(pattern.fullmatch(value))


def _int(value, low=0, high=2 ** 53) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def _url_ok(value, repo) -> bool:
    if value is None:
        return True
    match = isinstance(value, str) and URL.fullmatch(value)
    return bool(match) and match.group(1) == repo


def validate_record(rec) -> bool:
    """Strict whitelist: unknown keys, free text and oversized values are rejected, so task content (including prompt
    injection) cannot ride along in a record."""
    fields = {"schema", "task_id", "session_id", "repo", "pr", "branch", "head_sha", "worktree", "lease", "stage",
              "action_type", "seq", "issued_at", "last_progress_at", "waiting_reason", "ci_url", "review_url"}
    if not _body_exact(rec, fields) or rec["schema"] != RECORD_SCHEMA:
        return False
    lease = rec["lease"]
    checks = (
        _match(rec["task_id"], ID), _match(rec["session_id"], ID), _match(rec["worktree"], ID), _match(rec["repo"], REPO),
        _match(rec["branch"], BRANCH) and ".." not in rec["branch"] and not rec["branch"].endswith("/"),
        _match(rec["head_sha"], SHA),
        rec["pr"] is None or _int(rec["pr"], 1, 10 ** 9),
        _match(rec["stage"], STAGE),
        isinstance(rec["action_type"], str) and rec["action_type"] in ACTION_TYPES, _int(rec["seq"]),
        parse_ts(rec["issued_at"]) and parse_ts(rec["last_progress_at"]),
        rec["waiting_reason"] is None or (isinstance(rec["waiting_reason"], str) and rec["waiting_reason"] in WAITING_REASONS),
        _exact(lease, {"owner", "epoch", "expires_at"}) and _match(lease["owner"], ID) and _int(lease["epoch"], 1) and parse_ts(lease["expires_at"]),
    )
    if not all(checks):
        return False
    return _url_ok(rec["ci_url"], rec["repo"]) and _url_ok(rec["review_url"], rec["repo"])


def validate_evidence(ev) -> bool:
    fields = {"schema", "repo", "branch", "head_sha", "pr_state", "observed_at", "api_ok", "ci", "review", "user_input_required",
              "agent_rate_limited", "other_writers", "lease_holder"}
    if not _body_exact(ev, fields) or ev["schema"] != EVIDENCE_SCHEMA:
        return False
    ci, review, writers = ev["ci"], ev["review"], ev["other_writers"]
    if not (_exact(ci, {"state", "url"}) and isinstance(ci["state"], str) and ci["state"] in CI_STATES):
        return False
    if not _exact(review, {"pending", "tool_rate_limited", "human_required", "url"}):
        return False
    flags = (review["pending"], review["tool_rate_limited"], review["human_required"], ev["api_ok"],
             ev["user_input_required"], ev["agent_rate_limited"])
    return bool(
        _match(ev["repo"], REPO) and all(isinstance(flag, bool) for flag in flags)
        and _match(ev["branch"], BRANCH) and ".." not in ev["branch"] and _match(ev["head_sha"], SHA)
        and isinstance(ev["pr_state"], str) and ev["pr_state"] in PR_STATES and parse_ts(ev["observed_at"])
        and isinstance(writers, list) and len(writers) <= 10 and all(_match(w, ID) for w in writers)
        and (ev["lease_holder"] is None or _match(ev["lease_holder"], ID))
        and _url_ok(ci["url"], ev["repo"]) and _url_ok(review["url"], ev["repo"])
    )


def validate_entry(entry) -> bool:
    fields = {"schema", "task_id", "head_sha", "observed_at", "heartbeat_id", "record_seq", "last_progress_at", "state", "reason"}
    return bool(
        _body_exact(entry, fields) and entry["schema"] == OBSERVATION_SCHEMA and _match(entry["task_id"], ID)
        and _match(entry["head_sha"], SHA) and parse_ts(entry["observed_at"]) and parse_ts(entry["last_progress_at"])
        and _int(entry["record_seq"]) and _match(entry["heartbeat_id"], re.compile(r"[0-9a-f]{32}"))
        and isinstance(entry["state"], str) and entry["state"] in STATES and isinstance(entry["reason"], str) and entry["reason"] in REASONS
    )


# ------------------------------------------------------------------------------------------------ classification
def _result(state: str, reason: str, rec: dict | None = None, **extra) -> dict:
    proposal = {"STALLED": "POTENTIAL_STALL", "UNKNOWN": "HOLD"}.get(state, "OBSERVE")
    out = {
        "state": state, "reason": reason, "proposal": proposal, "message": f"{state}: {REASONS[reason]}",
        "dry_run": True, "side_effects": "none", "can_resume": False, "can_merge": False,
        "task_id": None, "repo": None, "pr": None, "branch": None, "head_sha": None,
        "heartbeat_age_seconds": None, "lease_expires_at": None, "observations_used": 1,
        "stage_boundary": "Stage 1 observer only: no GPT reviewer, paid API, recovery runner, budget meter or merge actor",
    }
    if rec is not None:  # only fields already validated against strict patterns are ever echoed
        out.update(task_id=rec["task_id"], repo=rec["repo"], pr=rec["pr"], branch=rec["branch"], head_sha=rec["head_sha"],
                   lease_expires_at=rec["lease"]["expires_at"])
    out.update(extra)
    return out


def _verified_history(history, keys: dict, task_id: str) -> list:
    """Only history entries this observer signed and that belong to this task; everything else is ignored."""
    good = []
    for entry in history if isinstance(history, list) else []:
        if validate_entry(entry) and entry["task_id"] == task_id and verify(entry, keys, "history") is None:
            good.append(entry)
    return sorted(good, key=lambda e: e["observed_at"])


# A prior observation can confirm a stall only if it too found no independent reason to wait and no ambiguity.
_NO_WAIT_REASONS = frozenset({"FIRST_STALE_OBSERVATION", "DUPLICATE_OBSERVATION", "OBSERVATIONS_TOO_CLOSE",
                              "UNCONFIRMED_STALL", "NO_PROGRESS_TWO_OBSERVATIONS"})


def classify(record, evidence, history, keys: dict, now: datetime.datetime, config: dict | None = None) -> dict:
    cfg = config or make_config()
    skew = datetime.timedelta(seconds=cfg["skew_seconds"])
    if not isinstance(keys, dict) or not keys:
        return _result("UNKNOWN", "KEYS_UNAVAILABLE")
    if record is None:
        return _result("UNKNOWN", "NO_TELEMETRY")
    if not validate_record(record):
        return _result("UNKNOWN", "RECORD_INVALID")
    failure = verify(record, keys, "record")
    if failure:
        return _result("UNKNOWN", "HEARTBEAT_KEY_UNKNOWN" if failure == "KEY_UNKNOWN" else "HEARTBEAT_UNAUTHENTICATED")
    # From here the record is authentic and well-formed, so its (validated) fields may be reported.
    if evidence is None:
        return _result("UNKNOWN", "STATUS_API_UNAVAILABLE", record)
    if not validate_evidence(evidence):
        return _result("UNKNOWN", "EVIDENCE_INVALID", record)
    failure = verify(evidence, keys, "evidence")
    if failure:
        return _result("UNKNOWN", "EVIDENCE_UNAUTHENTICATED", record)
    if evidence["api_ok"] is not True:
        return _result("UNKNOWN", "STATUS_API_UNAVAILABLE", record)
    observed = parse_ts(evidence["observed_at"])
    issued, progress = parse_ts(record["issued_at"]), parse_ts(record["last_progress_at"])
    if observed > now + skew or issued > now + skew or progress > now + skew or progress > issued + skew:
        return _result("UNKNOWN", "CLOCK_SKEW", record)
    if (now - observed).total_seconds() > cfg["evidence_max_age_seconds"]:
        return _result("UNKNOWN", "EVIDENCE_STALE", record)

    prior = _verified_history(history, keys, record["task_id"])
    heartbeat_id = record["mac"][:32]
    seen = prior  # sequence numbers are monotonic per task, regardless of head
    newest_seq = max((e["record_seq"] for e in seen), default=-1)
    same_seq = [e for e in seen if e["record_seq"] == record["seq"]]
    if record["seq"] < newest_seq or any(e["heartbeat_id"] != heartbeat_id for e in same_seq):
        return _result("UNKNOWN", "HEARTBEAT_REPLAY", record)

    if evidence["repo"] != record["repo"] or evidence["branch"] != record["branch"]:
        return _result("UNKNOWN", "EVIDENCE_TASK_MISMATCH", record)
    if evidence["head_sha"] != record["head_sha"]:
        return _result("UNKNOWN", "HEAD_SHA_CHANGED", record)

    age = max(0, int((now - progress).total_seconds()))
    extra = {"heartbeat_age_seconds": age}
    if evidence["pr_state"] in ("closed", "merged"):
        return _result("FINISHED", "PR_CLOSED_OR_MERGED", record, **extra)
    if record["action_type"] == "done" and record["stage"] == "DONE":
        return _result("FINISHED", "TASK_REPORTED_DONE", record, **extra)

    if evidence["other_writers"]:
        return _result("UNKNOWN", "CONCURRENT_WRITER", record, **extra)
    holder = evidence["lease_holder"]
    if holder is not None and holder != record["lease"]["owner"]:
        return _result("UNKNOWN", "LEASE_HOLDER_MISMATCH", record, **extra)
    if parse_ts(record["lease"]["expires_at"]) <= now:
        return _result("UNKNOWN", "LEASE_EXPIRED", record, **extra)

    # Waits come from INDEPENDENT evidence. A task's own claim that it is waiting is never an excuse on its own.
    review = evidence["review"]
    if evidence["agent_rate_limited"]:
        return _result("RATE_LIMITED", "AGENT_QUOTA_EXHAUSTED", record, **extra)
    if review["human_required"]:
        return _result("WAITING_FOR_USER", "HUMAN_APPROVAL_REQUIRED", record, **extra)
    if evidence["user_input_required"]:
        return _result("WAITING_FOR_USER", "USER_INPUT_REQUIRED", record, **extra)
    if evidence["ci"]["state"] in ("queued", "in_progress"):
        return _result("WAITING_CI", "CI_RUNNING", record, **extra)
    if review["tool_rate_limited"]:
        return _result("WAITING_REVIEW", "REVIEW_TOOL_RATE_LIMITED", record, **extra)
    if review["pending"]:
        return _result("WAITING_REVIEW", "REVIEW_PENDING", record, **extra)

    if age < cfg["fresh_seconds"]:
        return _result("RUNNING", "HEARTBEAT_FRESH", record, **extra)
    if evidence["ci"]["state"] == "unknown":
        return _result("UNKNOWN", "CI_STATE_UNKNOWN", record, **extra)
    if age < cfg["stall_seconds"]:
        return _result("UNKNOWN", "HEARTBEAT_AGING", record, **extra)

    # Old heartbeat, no independent reason to wait: a stall needs a SECOND verified observation of the same heartbeat.
    earlier = [e for e in prior if e["observed_at"] < evidence["observed_at"]]
    same = [e for e in prior if e["observed_at"] == evidence["observed_at"]]
    if not earlier:
        return _result("UNKNOWN", "DUPLICATE_OBSERVATION" if same else "FIRST_STALE_OBSERVATION", record, **extra)
    gap_ok = [e for e in earlier if (observed - parse_ts(e["observed_at"])).total_seconds() >= cfg["min_gap_seconds"]]
    if not gap_ok:
        return _result("UNKNOWN", "OBSERVATIONS_TOO_CLOSE", record, **extra)
    confirming = [e for e in gap_ok if e["heartbeat_id"] == heartbeat_id and e["head_sha"] == record["head_sha"]
                  and e["last_progress_at"] == record["last_progress_at"] and e["reason"] in _NO_WAIT_REASONS]
    if not confirming:
        return _result("UNKNOWN", "UNCONFIRMED_STALL", record, **extra)
    return _result("STALLED", "NO_PROGRESS_TWO_OBSERVATIONS", record, observations_used=2, **extra)


# ------------------------------------------------------------------------------------------------ history, retention, redaction
def observation_entry(report: dict, record: dict, evidence: dict, key: bytes, key_id: str) -> dict:
    """The only thing a runner may persist about an observation. Contains ids, a heartbeat fingerprint and an enum state."""
    return sign({
        "schema": OBSERVATION_SCHEMA, "task_id": record["task_id"], "head_sha": record["head_sha"],
        "observed_at": evidence["observed_at"], "heartbeat_id": record["mac"][:32], "record_seq": record["seq"],
        "last_progress_at": record["last_progress_at"], "state": report["state"], "reason": report["reason"],
    }, key, key_id)


def prune_history(entries: list, now: datetime.datetime, policy: dict | None = None, keys: dict | None = None,
                  skew_seconds: int = DEFAULTS["skew_seconds"]) -> list:
    """Deterministic bounded retention: drop invalid, unauthenticated or expired entries, then cap per task, tasks and size.

    Authentication happens BEFORE the caps so forged or future-dated entries can never displace genuine history.
    Without keys nothing can be authenticated, so nothing is retained.

    Pass the same ``skew_seconds`` as the classification config, or an entry ``classify`` accepts may be pruned away."""
    policy = policy or RETENTION
    cutoff = now - datetime.timedelta(days=policy["max_age_days"])
    keys = keys if isinstance(keys, dict) else {}
    kept = [e for e in entries if validate_entry(e) and verify(e, keys, "history") is None
            and cutoff <= parse_ts(e["observed_at"]) <= now + datetime.timedelta(seconds=skew_seconds)]
    by_task: dict = {}
    for entry in sorted(kept, key=lambda e: (e["observed_at"], e["record_seq"])):
        by_task.setdefault(entry["task_id"], []).append(entry)
    ranked = sorted(by_task.items(), key=lambda item: item[1][-1]["observed_at"], reverse=True)[:policy["max_tasks"]]
    result = [e for _, items in ranked for e in items[-policy["max_entries_per_task"]:]]
    result.sort(key=lambda e: (e["observed_at"], e["task_id"], e["record_seq"]))
    while result and len(json.dumps(result, separators=(",", ":"))) > policy["max_total_bytes"]:
        result.pop(0)  # oldest first
    return result


_REDACTIONS = (
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"), "[REDACTED:github-token]"),
    (re.compile(r"github_pat_[A-Za-z0-9_]{20,}"), "[REDACTED:github-token]"),
    (re.compile(r"sk-[A-Za-z0-9_-]{16,}"), "[REDACTED:api-key]"),
    (re.compile(r"AKIA[0-9A-Z]{16}"), "[REDACTED:aws-key]"),
    (re.compile(r"(?i)bearer\s+[A-Za-z0-9._~+/=-]{12,}"), "[REDACTED:bearer]"),
    (re.compile(r"eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}"), "[REDACTED:jwt]"),
    (re.compile(r"-{5}BEGIN [A-Z ]*PRIVATE KEY-{5}[\s\S]*?(?:-{5}END [A-Z ]*PRIVATE KEY-{5}|\Z)"), "[REDACTED:private-key]"),
    (re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}"), "[REDACTED:email]"),
    (re.compile(r"(?<!\d)\+?\d[\d\s().-]{8,}\d(?!\d)"), "[REDACTED:phone]"),
    (re.compile(r"(?i)((?:token|secret|password|passwd|api[_-]?key)\s*[=:]\s*)\S+"), r"\1[REDACTED]"),
)


def redact(text: str, limit: int = 500) -> str:
    """Defence in depth for any free text that might ever reach a report. Stage 1 stores no free text at all."""
    text = text if isinstance(text, str) else str(type(text).__name__)
    for pattern, replacement in _REDACTIONS:
        text = pattern.sub(replacement, text)
    return text[:limit]


# ------------------------------------------------------------------------------------------------ CLI (read-only)
def _read_json(path: str | None):
    """Missing, unreadable, oversized or malformed input is 'no data', never an error that could pass as success."""
    if not path:
        return None
    try:
        with open(path, "rb") as handle:
            raw = handle.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            return {"_oversized": True}
        return json.loads(raw)
    except (OSError, ValueError, RecursionError):
        return None


def run(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Appverse task observer (Stage 1, read-only, dry-run)")
    parser.add_argument("--record", help="signed heartbeat record (JSON)")
    parser.add_argument("--evidence", help="signed collector evidence (JSON)")
    parser.add_argument("--history", help="signed observation history (JSON list), optional")
    parser.add_argument("--keys", required=True, help="keys file (JSON), mode 0600")
    parser.add_argument("--now", help="ISO UTC time for deterministic runs; default is the real clock")
    parser.add_argument("--fresh-seconds", type=int, default=DEFAULTS["fresh_seconds"])
    parser.add_argument("--stall-seconds", type=int, default=DEFAULTS["stall_seconds"])
    parser.add_argument("--min-gap-seconds", type=int, default=DEFAULTS["min_gap_seconds"])
    parser.add_argument("--format", choices=("json", "text"), default="json")
    args = parser.parse_args(argv)
    try:
        cfg = make_config(fresh_seconds=args.fresh_seconds, stall_seconds=args.stall_seconds, min_gap_seconds=args.min_gap_seconds)
    except ObserverError as exc:
        print(f"invalid configuration: {exc}", file=sys.stderr)
        return 2
    now = parse_ts(args.now) if args.now else datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    if now is None:
        print("invalid --now", file=sys.stderr)
        return 2
    try:
        keys = load_keys(args.keys)
    except (ObserverError, OSError, ValueError, AttributeError, RecursionError):
        keys = {}
    record, evidence, history = _read_json(args.record), _read_json(args.evidence), _read_json(args.history)
    if isinstance(record, dict) and record.get("_oversized"):
        record = {}
    if isinstance(evidence, dict) and evidence.get("_oversized"):
        evidence = {}
    report = classify(record, evidence, history, keys, now, cfg)
    if args.format == "text":
        print(f"{report['proposal']}  {report['message']}  [{report['reason']}]")
    else:
        print(json.dumps(report, indent=2, sort_keys=True))
    return {"OBSERVE": 0, "HOLD": 10, "POTENTIAL_STALL": 11}[report["proposal"]]


def main() -> None:
    raise SystemExit(run(sys.argv[1:]))


if __name__ == "__main__":
    main()
