# GPT-governed Claude watchdog — phase 1 (read-only pilot)

Tracking issue: #657. Depends on protected merge-gate infrastructure #656 before unattended merges. This initial pilot **does not** watch live Claude sessions or run continuously. It provides only a deterministic, independently testable **advisory classification** from supplied checkpoint and observer evidence.

## Why this is separate from the existing Appverse merge gate

The existing Cursor/CI repair process should not be disrupted or replaced. The watchdog is a *monitoring* lane, not a deployment, repair, approval or merge authority. Its first step can be reviewed and tested without API credits, Grok access or a live Claude runner.

## Input contract

Checkpoint JSON: `repo`, `task_id`, `session_id`, `branch`, `head_sha` (full forty-character lowercase Git SHA), `last_progress_at` (offset-aware ISO date). Operational integration must additionally store task ownership lease, runner identity, worktree path, next action and current approval state securely; none of those fields are blindly executed.

Observer evidence JSON: `authenticated`, `repo`, `task_id`, `head_sha`, `observed_at`, `runner_active`, `ci_status`; optional `review_pending`, `permission_required`, `rate_limited`, `pr_state`, `task_completed`, `prior_observation`. A first observer sample never authorizes action.

**Authentication caveat:** `authenticated: true` is only an assertion in the current prototype JSON. It does **not** prove identity. A future trusted collector must verify provenance/signatures and exact task/runner/commit context **before** populating the classifier input. Do not expose this interface to arbitrary webhook or PR-supplied JSON. A source-file change cannot self-certify a GitHub status.

Example:
```bash
python3 scripts/appverse-control/claude_watchdog_readonly.py --checkpoint local-checkpoint.json --evidence trusted-observer.json
python3 -m unittest discover -s tests/appverse-control -p 'test_claude_watchdog_readonly.py' -v
```
Do not commit real checkpoint files: they can contain confidential metadata.

## Outputs and safe behavior

`RUNNING`, `WAITING_CI`, `WAITING_REVIEW`, `WAITING_FOR_USER`, `RATE_LIMITED`, `FINISHED`, `SUSPECT_STALL`, `UNKNOWN`. **SUSPECT_STALL is advisory only, not permission to restart.** Every result contains `can_resume=false`, `can_merge=false`, `requires_gpt_review=true`.

A rate limit or human approval wait is a hold. A changed head, stale observation, missing independent evidence, single inactive observation or CI still running cannot be treated as a genuine stall. Unexpected / invalid input returns UNKNOWN without causing an action.

## Required next phases (not implemented or claimed here)

1. Verified Claude Code runner lifecycle instrumentation and authenticated checkpoint collector, branch lease + two independent observations.
2. Dedicated OpenAI API review service: redacted minimum-necessary input; structured decision tied to exact repo/task/commit/lease with expiration; **HOLD** on outage, quota or uncertainty. This is a separately connected API service, **not a live ChatGPT conversation endpoint**.
3. Controlled resume by the one authorized writer, max attempts, terminate-and-handoff proof, isolated worktree; never restart against a usage/permission block.
4. Security review; adversarial and negative tests; only then consider enabling recovery under server-side policy. No autonomous production deployment. Enforce independent human approval where required.
5. Payment gate: initial **US$10 is a budget ceiling proposed by the owner**, not a recorded API payment. No key creation or charge is required for this phase. Require explicit credentials setup via trusted platform flow and disable automatic recharge initially.

Production integrity, exact-head CI, independent CodeRabbit/security review, code-owner requirements and GitHub branch protections remain mandatory. GPT review may not substitute for independent human approval on protected Core migration, finance, auth or authority changes.
