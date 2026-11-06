# Appverse autonomous release governance — implementation

This work adds a **trusted, exact-head merge eligibility check**. It does not merge PRs or deploy migrations. Main programme ledger: Central issue #437. A merged PR is never equivalent to Appverse launch certification.

## Two-phase activation — mandatory

**Phase 1 — Review and merge this infrastructure PR.** `.github/workflows/appverse-merge-gate-ci.yml` runs offline tests on the candidate branch. The new `Appverse Trusted Merge Controller` workflow does not run on `main` until this PR itself is approved and merged under existing protections. Do not add the new required check to GitHub rulesets until the workflow is live on `main`. Enabling it earlier can deadlock the infrastructure PR.

**Phase 2 — GitHub administrator must enforce Central rule #19200597.** Open GitHub Settings → Rules → Rulesets → **Require CI checks on main** (ID `19200597`), add `Require status checks to pass`, require exact `Appverse Merge Gate` from the GitHub Actions app, and select `Require branches to be up to date before merging` (strict). Retain existing Central main release governance rule #19820724, including required review, dismiss-stale and thread-resolution rules. **Also enable `Require review from Code Owners` on #19820724**: `.github/CODEOWNERS` covers only privileged merge-controller files so normal application PRs can still use autonomous independent review. Verify there are no bypass actors. GitHub App connector has no admin write action, so these settings changes are not performed by this PR. Remove any applicable merge-bypass actors from the CI ruleset; an unchecked bypass defeats unattended protection.

**Fail-closed handshake:** the gate returns FAIL until ruleset #19200597 strictly requires its own check. It cannot declare merge eligibility based solely on voluntary/informational green CI.

## What is automated

- Event sources: completion of relevant CI workflows, ten-minute reconciliation and manual dispatch. These events execute the trusted workflow from default main; PR-review changes are picked up by the scheduled reconciliation. No privileged `pull_request_target` code is executed.
- The controller executes **trusted main**, with no checkout or execution of candidate branch code under write credentials. It has only `checks:write`, not `contents:write`, `issues:write` or `pull-requests:write`.
- It publishes a uniquely named `Appverse Merge Gate` check-run on the PR's exact current head, rejecting missing, skipped, stale or failing checks. For each checked GitHub App it checks the actual app slug, not merely the display name; it also validates the verified Snyk and Vercel status creators. It checks CodeRabbit (zero actionable current-head comments), Cursor Security and Approval, Codacy, relevant CodeQL languages, scope-relevant Factory/Buyer/Point100 suites, release quality, secret/ownership, current-head independent approval and all resolved review threads.
- The **required Appverse Merge Gate check is published for every open PR targeting `main`**, including unlabelled PRs; relevant runtime suites are chosen from changed paths (factory changes also require Point100). The separate `appverse-gated` label only opts an eligible PR into **native automatic merge**. Neither a label nor a bot review bypasses required checks.
- It refuses drafts, stacked PRs, evidence-only #651, Core-owned SQL migrations in Central and changed SHA/base during validation. Changes to the gate's own source, policy, test or CODEOWNERS files require a distinct trusted human code-owner approval on the current head; normal application PRs may use the trusted Cursor automatic approver.
- Failed evidence is shown in the PR check summary. The controller itself **never merges**, cannot turn GitHub protection off, and cannot deploy production.
- Native GitHub auto-merge can be enabled **per PR only after phase 2**. GitHub itself enforces check and approval; the existing hourly autonomous controller may select fully authorized PRs for auto-merge.

## Copilot / Cursor repair integration

- Cursor remains the primary writer for bounded code changes.
- Optional GitHub Copilot **Agent Merge** can watch failed Actions or merge conflicts. It requires paid Copilot Cloud and GitHub's Enable Automations policy, does not support stacked PRs/forks, and may incur credit usage. Enable under GitHub personal Settings → Copilot → Cloud, or via a PR's **Watch and fix** control. Do not allow Cursor and Copilot to write to the same PR branch concurrently.
- CodeRabbit, Copilot Code Review (if separately enabled), CodeQL, Codacy, Snyk and GitHub Actions provide review evidence; no bot may counterfeit an independent required Core code-owner approval.

## Protected Core and other systems

Do **not** weaken Core's ruleset #20838928 (independent code owner, last-push approval, squash-only and strict pgTAP/migration/security checks). Core production migrations remain separately authorized by its protected release workflow and environment gate. After Central pilot passes, install an equivalent authority gate appropriate to Expo, AI Studio and Trace, preserving their own path scopes and permissions.

**Blocking conditions:** gate not installed on main; missing mandatory ruleset; unapproved/changed head; tests pending/failing/skipped; unresolved reviews; mismatched Core authority; real physical/provider evidence absent. Such PRs must not auto-merge. No final live certification is claimed solely from CI.
