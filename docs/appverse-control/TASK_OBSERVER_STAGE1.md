# Appverse task observer — Stage 1 (read-only, dry-run)

Part of the #657 staged plan (GPT-governed recovery of stalled Claude/Cursor tasks). **Stage 1 only observes and proposes.** It is code, tests and a report format; nothing here runs unattended.

## What Stage 1 is, and is not

| Built in Stage 1 | Explicitly NOT built (later stages, owner-gated) |
|---|---|
| Durable task record model, authenticated heartbeats | GPT reviewer / any OpenAI or other paid API call |
| Eight observer states with stable reason codes | Recovery runner (restarting or resuming any agent) |
| Two-observation stall rule, lease, exact-SHA and skew checks | Budget meter; purchase of credits; API key creation |
| Redaction and bounded retention policy | Protected merge actor; any merge, approval or deploy |
| Dry-run CLI that proposes `OBSERVE`, `HOLD` or `POTENTIAL_STALL` | A collector that reads GitHub, a writer that persists history, a runner that emits heartbeats |

The module imports only standard offline modules and can open files only for reading; tests prove it has no network, process, write or environment access. A report always says `dry_run: true`, `side_effects: none`, `can_resume: false`, `can_merge: false`. A `POTENTIAL_STALL` proposal is **advice for a human or for the later GPT-review stage, never an action and never permission to act.**

## Record model (`appverse.task-record/1`)

Written by the task's runner, signed with a heartbeat key. Strict whitelist: any unknown field, free text, oversized value, wrong type (a boolean is not a sequence number, an integer is not an identifier) or off-GitHub URL makes the record `RECORD_INVALID`, even when its signature is valid. No prompts, chat, secrets, PII or credentials are representable.

| Field | Content |
|---|---|
| `task_id`, `session_id`, `worktree` | opaque identifiers (letters, digits, `._-`, 6 to 64 characters). `worktree` is a label, never a filesystem path |
| `repo`, `pr`, `branch`, `head_sha` | repository, pull request number or null, branch name, exact 40-hex head |
| `lease` | `owner`, monotonically increasing `epoch` (fencing token), `expires_at` |
| `stage`, `action_type` | short stage label; one of `edit test push wait_ci wait_review wait_user idle done other` |
| `seq`, `issued_at`, `last_progress_at` | per-task monotonic counter; UTC timestamps (`...Z`) |
| `waiting_reason`, `ci_url`, `review_url` | optional enum; optional GitHub run or pull request URLs for the same repository only |
| `key_id`, `mac` | authentication (below) |

## Evidence model (`appverse.task-evidence/1`)

What a trusted **collector** independently observed on GitHub, also signed: `repo`, `branch`, live `head_sha`, `pr_state`, `observed_at`, `api_ok`, CI state and URL, review flags (`pending`, `tool_rate_limited`, `human_required`), `user_input_required`, `agent_rate_limited`, `other_writers`, `lease_holder`. The collector is **not built in Stage 1**; evidence is supplied to the CLI as a file, so Stage 1 performs no network access at all. A collector must read API metadata, never parse comment text.

## Authentication and why GitHub text cannot forge a heartbeat

* Records, evidence and history entries carry `key_id` and an HMAC-SHA256 `mac` over their canonical JSON (sorted keys, no whitespace) and are checked in constant time.
* Key ids are **purpose-separated**: heartbeats `hb-*`, evidence `ev-*`, observer history `obs-*`. A key minted for one purpose is rejected for another, so a compromised collector cannot manufacture a heartbeat.
* The keys file is read only by the observer, must not be readable by group or others (mode 0600), is size-limited, holds keys of at least 32 bytes, and is never printed or logged.
* Anything that arrives as text in an issue, comment, PR body or commit message has no key. A perfectly formatted record in a comment fails with `HEARTBEAT_UNAUTHENTICATED` (or `HEARTBEAT_KEY_UNKNOWN`) and nothing from it is echoed.
* A record is classified only after its **body** is valid and its **signature** verifies; the report echoes fields only from a record that passed both.

Residual limit: HMAC is symmetric, so anyone holding a heartbeat key can mint heartbeats. Key distribution and rotation are not solved here; asymmetric signatures are a candidate for a later stage.

## States and stable reason codes

`UNKNOWN` always proposes `HOLD`. Only `STALLED` proposes `POTENTIAL_STALL`; every other state proposes `OBSERVE`. Reason codes are stable identifiers (a test pins the list): renaming one is a breaking change.

| State | Reason codes |
|---|---|
| `RUNNING` | `HEARTBEAT_FRESH` |
| `WAITING_CI` | `CI_RUNNING` |
| `WAITING_REVIEW` | `REVIEW_PENDING`, `REVIEW_TOOL_RATE_LIMITED` (CodeRabbit rate-limited or neutral is a review wait, not a stall) |
| `WAITING_FOR_USER` | `HUMAN_APPROVAL_REQUIRED`, `USER_INPUT_REQUIRED` |
| `RATE_LIMITED` | `AGENT_QUOTA_EXHAUSTED` (the agent's own quota; restarting would not help) |
| `FINISHED` | `PR_CLOSED_OR_MERGED`, `TASK_REPORTED_DONE` |
| `STALLED` | `NO_PROGRESS_TWO_OBSERVATIONS` |
| `UNKNOWN` (HOLD) | `NO_TELEMETRY`, `RECORD_INVALID`, `KEYS_UNAVAILABLE`, `HEARTBEAT_KEY_UNKNOWN`, `HEARTBEAT_UNAUTHENTICATED`, `HEARTBEAT_REPLAY`, `CLOCK_SKEW`, `STATUS_API_UNAVAILABLE`, `EVIDENCE_INVALID`, `EVIDENCE_UNAUTHENTICATED`, `EVIDENCE_STALE`, `EVIDENCE_TASK_MISMATCH`, `HEAD_SHA_CHANGED`, `CONCURRENT_WRITER`, `LEASE_HOLDER_MISMATCH`, `LEASE_EXPIRED`, `HEARTBEAT_AGING`, `CI_STATE_UNKNOWN`, `FIRST_STALE_OBSERVATION`, `DUPLICATE_OBSERVATION`, `OBSERVATIONS_TOO_CLOSE`, `UNCONFIRMED_STALL` |

### Decision order (first match wins)

1. No keys, no record, invalid body, unknown key, bad signature: `UNKNOWN`.
2. Evidence missing, invalid, unsigned, API not OK, older than 300 s, or from the future beyond the skew allowance: `UNKNOWN`.
3. Heartbeat or evidence time beyond the skew allowance (120 s), or progress after issue beyond it: `CLOCK_SKEW`.
4. Replay: a lower sequence than one already verified for this task, or the same sequence with a different heartbeat: `HEARTBEAT_REPLAY`. The identical heartbeat seen again is allowed (it is simply unchanged).
5. Evidence for another repository or branch, or a live head different from the recorded head: `UNKNOWN`.
6. Pull request closed or merged, or an authenticated `DONE` record: `FINISHED`.
7. Another active writer, a lease holder different from the record, or an expired lease: `UNKNOWN`.
8. **Independent evidence** of a wait: agent quota, human approval, user input, CI queued or running, review tool rate-limited, review pending. A task's own claim that it is waiting is never an excuse.
9. Heartbeat younger than 300 s: `RUNNING`. CI state unknown: `UNKNOWN`. Younger than 900 s: `HEARTBEAT_AGING` (not yet judged).
10. Heartbeat 900 s or older with no wait: a **second verified observation** of the *same unchanged heartbeat on the same head*, at least 120 s earlier, is required for `STALLED`. One observation, a duplicate, observations too close together, or any progress in between stay `UNKNOWN`.

Thresholds are configurable but bounded: a stall window under 300 s, or any non-integer value, is rejected.

## Retention and redaction

* Persisted history is the observer-signed `appverse.observation/1` entry only: task id, head SHA, observation time, a 32-hex heartbeat fingerprint, the record's sequence and progress time, and the resulting enum state and reason. No free text.
* `prune_history` bounds it deterministically: entries older than 14 days are dropped, at most 20 per task, 200 tasks and 256 KiB overall (oldest first); invalid or tampered entries are discarded; pruning is idempotent and order-independent.
* `redact()` scrubs GitHub and OpenAI-style keys, AWS keys, bearer values, JWTs, private-key blocks, e-mail addresses, phone numbers and `password=` style assignments, and bounds length. Stage 1 stores no free text, so this is defence in depth for any text a later stage might add.
* In Stage 1 **the caller persists history**; the observer never writes. If history is lost, replay cannot be detected, which is why a lost history can only make results more conservative, never produce `STALLED`.

## Command line (dry run)

```
python3 scripts/appverse-control/appverse_task_observer.py --keys KEYS.json --record RECORD.json --evidence EVIDENCE.json [--history HISTORY.json] [--now ISO] [--format json|text]
```

Exit status: `0` OBSERVE, `10` HOLD, `11` POTENTIAL_STALL, `2` usage or configuration error. Missing, unreadable, oversized or malformed input is "no data" and yields `HOLD`, never an error that could look like success.

## Relationship to #658

#658 is an earlier read-only classification prototype on its own branch. Stage 1 is independent and does not modify it. The differences that matter: authentication here is verified (a MAC), not asserted by a boolean in the JSON; there is a lease, fencing epoch, replay and equivocation detection; the stall verdict is named `STALLED` and needs two verified, unchanged, sufficiently separated observations; history is signed, retained under a bound and redacted. If both land, #658 should be retired or reduced to a thin wrapper around this module.

## Dependencies for the next stages

Stage 2 (reviewer, dry-run) needs this report format as its input and must bind any decision to the exact repository, task, branch, head SHA, lease and expiry. Stage 3 (guarded recovery) additionally needs the heartbeat writer, the collector, durable history storage, and the protected merge gate (#656) installed and enforced. None of those exist yet, and none is enabled by this change.
