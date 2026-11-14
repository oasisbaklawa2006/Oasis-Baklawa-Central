# #657 Stage 2: GPT governance reviewer (dry-run, review-only, default OFF)

**Status: Stage 2 software and offline evidence only. NOT commissioned.** Nothing here calls an API, holds a key, spends money,
resumes or restarts an agent, approves, merges or deploys. Every decision is a recommendation:
`dry_run: true`, `can_resume: false`, `can_merge: false`, `can_deploy: false`, always. This document is not an authorisation to
enable anything; each activation step below is a separate owner gate.

## What Stage 2 is, and is not

| Implemented in this change (mock-only evidence) | Intentionally NOT built |
|---|---|
| Strict versioned schemas: reviewer input, reviewer output, signed decision | A live OpenAI transport (the only live transport refuses every call) |
| Trusted controller that recomputes Stage 1 from signed artifacts, gates deterministically, signs outside the model | Any API key, payment, funding or automatic recharge |
| Offline fake transport, scripted failures, validation of the reply against a pinned closed schema | A verified live lease epoch authority (no verified live lease epoch exists) |
| Simulated USD 10 pilot budget meter with worst-case reservation, caps, idempotency and retry cap | A heartbeat collector, persistent authenticated history, the recovery runner (Stage 3) |
| Independent decision verifier and read-only CLI (`policy`, `schema`, `verify`) | Any change to #656, #655, rulesets, Cloudflare, Supabase, deployments or billing |

## Trust model

* **Trust root = Stage 1.** The signed heartbeat record, signed collector evidence and signed observer history (`hb-`, `ev-`, `obs-`
  keys). The controller RECOMPUTES the Stage 1 classification from those artifacts. An unsigned Stage 1 report, GitHub issue or
  comment text, or any claim about provenance is never evidence; `review()` has no parameter that could carry one.
* **The model is untrusted.** It sees only a closed, id/enum/boolean/timestamp input and must answer with a closed schema. Its text,
  signatures, approvals and tool instructions have no authority. The controller (a `ctl-` key the model never sees; Stage 1 never
  receives it) validates, binds, signs and records the decision.
* **A decision authorises nothing.** `executable_authority(decision)` is the empty set for every verdict. An `ALLOW_RESUME` is a
  recommendation that a later, separately authorised stage may consult; it is never an instruction.
* **Only the owner-mandated GPT reviewer.** The policy rejects any other provider. Grok, Cursor or another provider cannot substitute
  for the review or trigger recovery without a validated decision from this controller.

## Contracts

* Reviewer input `appverse.review-input/1`: task id, repo, branch, PR, head SHA, lease owner, claimed epoch, lease expiry, fence
  status, Stage 1 state and reason, CI state, review flags, sensitive-scope and code-owner flags, proposed action, policy revision,
  heartbeat and evidence ids, evidence time. No prompt, chat, customer or employee data, secret, token or free text is representable.
* Proposed actions (bounded enum): `RESUME_SAME_SESSION`, `CONTINUE_IN_NEW_SESSION`, `TRANSFER_LEASE_TO_CURSOR`, `NO_ACTION`.
* Reviewer output `appverse.reviewer-output/1`: `verdict` (`ALLOW_RESUME`, `HOLD`, `HUMAN_REQUIRED`), `reason` (`TASK_STALLED_NO_PROGRESS`, `EVIDENCE_INSUFFICIENT`, `RISK_TOO_HIGH`, `HUMAN_JUDGMENT_NEEDED`, `POLICY_CONCERN`, `SCOPE_MISMATCH`), and the echoed
  `input_fingerprint` and `nonce`. Closed schema; extra fields, refusals, wrong model, duplicate keys, nesting bombs and oversize
  replies are rejected.
* Decision `appverse.review-decision/1`: binds repository, task, branch, PR, head SHA, lease owner, claimed epoch, lease expiry,
  proposed action, verdict, controller reason, policy revision and fingerprint, pinned model, input fingerprint, issue and expiry
  times (never beyond the lease for an `ALLOW_RESUME`), a unique nonce, the budget ledger reference and the controller signature.

## Controller pipeline (first match wins; the model is consulted only if every gate passes)

1. Policy disabled (the shipped default): `REVIEW_DISABLED`.
2. Proposed action outside the enum: `BAD_ACTION`.
3. Signed Stage 1 inputs do not verify: `PROVENANCE_UNVERIFIED`.
4. Expected head SHA differs from the signed record: `HEAD_MISMATCH`.
5. Stage 1 state: waiting for a person or a required human approval is `HUMAN_REQUIRED`; quota is `STAGE1_RATE_LIMITED`; finished
   is `TASK_FINISHED`; UNKNOWN is `STAGE1_UNKNOWN`; anything but STALLED is `STAGE1_NOT_STALLED`.
6. `NO_ACTION` is held. CI must be conclusive and no review pending. A sensitive scope needs independent code-owner approval first.
7. Fencing: the shipped authority never verifies, so the result is `FENCE_UNVERIFIED`; a future authority must match the claimed
   lease owner and epoch exactly (`FENCE_MISMATCH` otherwise, which also catches a same-owner newer lease).
8. Budget reservation, then at most `max_attempts` bounded reviewer calls; every failure is a signed hold.

## Decision reasons

| Reason | Meaning |
|---|---|
| `REVIEW_DISABLED` | Stage 2 is disabled by policy (default OFF). |
| `PROVENANCE_UNVERIFIED` | The signed Stage 1 inputs did not verify, so nothing can be bound. |
| `BAD_ACTION` | The proposed recovery action is not in the bounded enum. |
| `HEAD_MISMATCH` | The expected head SHA does not match the signed record. |
| `STAGE1_NOT_STALLED` | Stage 1 does not report a stall, so no recovery review is needed. |
| `STAGE1_UNKNOWN` | Stage 1 could not conclude (UNKNOWN); that is always a hold. |
| `STAGE1_RATE_LIMITED` | The agent quota is exhausted; no restart after quota or permission blocks. |
| `TASK_FINISHED` | The task is finished; there is nothing to resume. |
| `HUMAN_INPUT_NEEDED` | The task is waiting for a person. |
| `NO_ACTION_PROPOSED` | No recovery action was proposed. |
| `CI_NOT_CONCLUSIVE` | CI evidence is not conclusive. |
| `SENSITIVE_SCOPE_NEEDS_CODEOWNER` | A sensitive scope needs independent code-owner approval first. |
| `FENCE_UNVERIFIED` | No independently verified live lease epoch exists; fencing cannot be relied on. |
| `FENCE_MISMATCH` | The verified live lease owner or epoch differs from the claimed one. |
| `BUDGET_NOT_FUNDED` | The pilot budget is not funded or activated. |
| `BUDGET_PRICING_UNVERIFIED` | Model pricing is not verified, so spend cannot be conclusively capped. |
| `BUDGET_PER_CALL_CAP` | Worst-case cost of one call exceeds the per-call cap. |
| `BUDGET_PER_TASK_CAP` | Worst-case cost would exceed the per-task cap. |
| `BUDGET_EXHAUSTED` | The pilot ceiling would be exceeded. |
| `BUDGET_TRIPPED` | The meter saw an overrun and refuses further reservations. |
| `BUDGET_DUPLICATE_RESERVATION` | This reservation key was already used. |
| `RETRY_EXHAUSTED` | The retry cap was reached. |
| `LIVE_TRANSPORT_DISABLED` | The live reviewer transport is disabled in this stage. |
| `REVIEWER_REFUSAL` | The reviewer refused. |
| `REVIEWER_TIMEOUT` | The reviewer timed out. |
| `REVIEWER_RATE_LIMITED` | The reviewer API is rate limited. |
| `REVIEWER_UNAVAILABLE` | The reviewer API is unavailable. |
| `REVIEWER_NO_CREDITS` | The reviewer API reports no credits. |
| `REVIEWER_MALFORMED` | The reviewer response was not parseable. |
| `REVIEWER_SCHEMA_VIOLATION` | The reviewer response violated the pinned schema. |
| `REVIEWER_BINDING_MISMATCH` | The reviewer response did not echo this input fingerprint and nonce. |
| `REVIEWER_MODEL_MISMATCH` | The responding model is not the pinned model. |
| `NONCE_REPLAY` | A nonce was reused. |
| `REVIEWER_ALLOW_RESUME` | The pinned reviewer recommends resuming (non-operative). |
| `REVIEWER_HOLD` | The pinned reviewer recommends a hold. |
| `REVIEWER_HUMAN_REQUIRED` | The pinned reviewer requires a human. |

## Budget meter (simulated)

Integer micro-USD ledger. Before each call it reserves the WORST case (maximum input tokens at the input price plus maximum output
tokens at the output price), refuses on any cap, settles at reported usage, and charges the full reservation when usage is missing
or invalid. An overrun trips the meter. A reservation key is idempotent. The accepted future pilot ceiling is USD 10
(10,000,000 micro-USD); the policy validator rejects anything higher and rejects automatic recharge. The meter moves no money: it
is a ledger only, and the shipped policy cannot reserve at all because it is unfunded and unpriced.

Pinned limits (policy revision `appverse-gpt-review-policy/2026-11-07.1`):

* `max_input_tokens` = 3000
* `max_output_tokens` = 300
* `timeout_seconds` = 30
* `max_attempts` = 2
* `decision_ttl_seconds` = 900
* `decision_ttl_max_seconds` = 3600
* `audit_max_entries` = 500

Pinned budget (micro-USD):

* `ceiling_micro_usd` = 10000000
* `per_call_cap_micro_usd` = 250000
* `per_task_cap_micro_usd` = 1000000

Policy fingerprint (SHA-256 of the canonical policy, bound into every decision): `33cbeb5836e37bcf13238965f9e4fa937ab5ed7b1bde4c6ec1117b9963e9620c`

## Owner gates that are still OPEN (all must be closed deliberately, in order, by the owner)

* policy disabled
* model not pinned (owner must read the current official API documentation)
* endpoint not pinned
* pricing not verified
* budget not funded

Specifically:

* **`model` and `endpoint_pin` are `UNPINNED`.** They were not pinned in this change because the current official API
  documentation could not be read from the build environment (`platform.openai.com` is outside its allowed network). The owner (or
  a session with that access) must read the current Structured Outputs documentation, choose and pin the exact endpoint, model and
  schema shape, and update the policy and fixtures. Search snippets suggest the Responses API carries the schema in `text.format`
  with `type: json_schema` and `strict: true` and reports refusals as a separate content item; that is unverified here and must be
  confirmed before anything is pinned.
* **`pricing_verified` is false and `price_schedule` is empty.** If fees cannot be conclusively capped, the meter fails closed.
  Synthetic prices exist only in test fixtures and are labelled as such.
* **Funding and a key are separate owner actions** (payment, key creation, secret management, auto-recharge off). None happens in
  this stage.
* **No verified live lease epoch exists.** Stage 1 records `lease.epoch` but cannot enforce live fencing, and Stage 2 does not
  invent an authority. An independently verified live epoch, a heartbeat collector and persistent authenticated history are
  prerequisites for any later active runner.

## Limitations

* All evidence is mock-only: scripted fake reviewer replies and a simulated ledger. It shows the controller fails closed and never
  grants authority; it does not show how a real model behaves.
* Stage 1 limits carry over: symmetric HMAC (key distribution and rotation are unsolved), history persisted by the caller, no
  collector.
* The decision verifier checks structure, signature, freshness, flags and expected bindings. It cannot tell whether the verdict is wise.

## Relationship to other work

Stage 3 (guarded single-writer recovery) is a separate workstream that additionally needs independently certified #656 enforcement
and a trustworthy live epoch. This change does not modify #656, #655 or the repository rulesets and adds no authority bypass.
