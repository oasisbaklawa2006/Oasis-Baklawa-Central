# APPVERSE Release Controller

The `APPVERSE Release Controller` is the event-driven release state machine for the governed Dispatch/UAT chain.

## Human gates retained

The controller never substitutes for:

1. Independent exact-head collaborator approval by `dineshmutrejabackup-cmd`.
2. Final physical Dispatch UAT on the actual device/workstation.

## Automated chain

`#471 exact-head green + review-clean -> request human approval -> merge #471 -> dispatch production RLS certification -> require current #458 pin + PASS -> request #458 human approval -> merge #458 -> discover approved Vercel preview -> dispatch APPVERSE AI UAT -> publish physical-UAT-required or AI-UAT-failed handoff to issue #437.`

## Fail-closed rules

- Only PR #471 and PR #458 are merge targets in this controller version.
- Merge requires exact-head success for Release Quality, repo ownership, Codacy, CodeQL, GitHub Advanced Security, and Cursor Security.
- Merge requires zero unresolved review threads.
- Merge requires an `APPROVED` review by `dineshmutrejabackup-cmd` whose `commit_id` equals the current PR head.
- RLS certification is accepted only if the workflow pin equals current #458 head and a post-#471-merge workflow run concludes `success`.
- Stale pins block certification and produce a durable PR comment.
- Failed RLS certification never auto-retries into a merge; it produces a durable blocker comment.
- AI-UAT is dispatched only after #458 is merged and an Oasis-team Vercel preview URL can be recovered from the PR's Vercel bot evidence.
- AI-UAT success does not equal physical certification. It produces the physical-UAT-required handoff in issue #437.

## Trigger model

The controller reconciles on:

- pushes to `main`,
- submitted pull-request reviews,
- completion of Dispatch RLS certification,
- completion of APPVERSE AI UAT,
- manual workflow dispatch for recovery/reconciliation.

All actions are idempotent where practical. Durable comments use controller markers to prevent duplicate handoffs.
