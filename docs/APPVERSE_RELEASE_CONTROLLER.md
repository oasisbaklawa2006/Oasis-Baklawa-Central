# APPVERSE Release Controller

The `APPVERSE Release Controller` is the trusted-default-branch release state machine for the governed Dispatch/UAT chain.

## Human gates retained

The controller never substitutes for:

1. Independent exact-head collaborator approval by `dineshmutrejabackup-cmd`.
2. Final physical Dispatch UAT on the actual device/workstation.

## Automated chain

`#471 exact-head green + review-clean -> request human approval -> merge #471 -> dispatch production RLS certification -> require current #458 pin + PASS -> request #458 human approval -> merge #458 -> resolve a successful Vercel deployment bound to the exact #458 head -> dispatch APPVERSE AI UAT -> publish physical-UAT-required or AI-UAT-failed handoff to issue #437.`

## Fail-closed rules

- Only PR #471 and PR #458 are merge targets in this controller version.
- Governed target-PR merge requires exact-head success for the stable contexts emitted on the Dispatch lane: Release Quality, repo ownership, Codacy, CodeQL, and Cursor Security.
- GitHub Advanced Security agentic review remains an additional repository signal when GitHub emits it, but it is not a controller hard dependency because that check is not emitted for every governed Dispatch head.
- Merge requires zero unresolved review threads; if review-thread pagination exceeds the bounded check, merge fails closed.
- Merge requires an `APPROVED` review by `dineshmutrejabackup-cmd` whose `commit_id` equals the current PR head, and a later non-comment review on that same head supersedes an earlier decision.
- RLS certification is accepted only if the workflow pin equals current #458 head and a post-#471-merge `main` workflow run concludes `success` with `head_sha` equal to current `main`.
- Stale pins block certification and produce a durable PR comment.
- Failed RLS certification never auto-retries into a merge; it produces a durable blocker comment.
- AI-UAT is dispatched only after #458 is merged and GitHub deployment/status evidence identifies a successful Vercel deployment whose deployment SHA equals the exact #458 head and whose environment URL belongs to the Oasis Vercel team domain.
- Before dispatch, the controller persists a durable correlation marker on issue #437 that binds the exact #458 head SHA, Vercel deployment id, and target URL.
- AI-UAT acceptance and physical-UAT handoff require a correlated `workflow_dispatch` run whose `target_url` input matches that exact deployment URL and whose deployment evidence still matches the current #458 head; unrelated main-branch dispatches are ignored fail-closed.
- A correlated AI-UAT failure does not suppress retry; only correlated queued, in-progress, or successful runs suppress duplicate dispatch.
- Historical PR comments are not accepted as AI-UAT deployment authority.
- AI-UAT success does not equal physical certification. It produces the physical-UAT-required handoff in issue #437.
- The controller never runs from a pull-request-authored workflow definition. Its write-capable triggers are restricted to trusted `main` execution.

## Trusted trigger model

The controller reconciles from the default-branch workflow on:

- pushes to `main`,
- a five-minute schedule, which detects newly submitted human approvals without using `pull_request_review`,
- completion of Dispatch RLS certification on `main`,
- completion of APPVERSE AI UAT on `main`.

There is intentionally no `pull_request_review` or branch-selectable `workflow_dispatch` trigger. This prevents a pull-request-authored controller workflow from receiving a write-capable token.

The controller checks out `main` explicitly with `persist-credentials: false`, and the checkout action is pinned to a verified full commit SHA, before executing the state-machine script.

All state transitions are idempotent where practical. Durable comments use controller markers and scan paginated issue comments to prevent duplicate handoffs.
