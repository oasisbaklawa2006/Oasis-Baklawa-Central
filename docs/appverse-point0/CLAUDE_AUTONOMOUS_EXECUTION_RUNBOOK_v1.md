# OASIS BAKLAWA APPVERSE
## Claude Code Autonomous Execution: Setup, Sessions, Environments, Automation and Handoffs
Version: **1.0 — 5 November 2026**  
Control: [Original 1–100 Mission #437](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/437)  
Preparation: [Point 0 draft PR #642](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/642)  
Evidence refresher fix: [draft PR #643](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/643)  
Activation intent: [Issue #629](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/629)

**Authority:** This document is a **configuration and execution handover**. It is not evidence that a Claude Code runner has authenticated, started, resumed, or deployed. It does not override existing protected GitHub, Supabase, business, security, finance, and physical release controls. Preserve the original 1–100 point numbering. E0–E8 is a sequencing overlay.

---

# 1. The exact decision: new thread or existing thread?

**Create ONE NEW Claude Code master session. Do not convert an existing AI Studio, Buyer, Supabase, WhatsApp or Point100 thread into enterprise control.**

- Exact new master session name: **OASIS-APPVERSE-MASTER-E0-TO-LAUNCH**
- GitHub authority: **Central Issue #437**. No new competing master issue.
- Master session starts in **Central repository**, because it contains Mission Control; it can *read* sibling repositories.
- Master role: principal engineer / orchestrator, and primary backend architect when a Core task is assigned. Its decisions survive in GitHub documents and issues, **not** exclusively in conversation history.
- Existing Claude conversations/threads: **do not delete, rename as master, or restart**. Leave them as evidence and historical lane sessions; extract only links/SHAs/test proof as necessary.
- Existing ChatGPT Appverse project thread: keep it for independent programme supervision, owner questions and the scheduled Point-0 watch. **Do not** make it a second engineering source of truth.

## Session counts and naming

| Stage | Main Claude sessions | Active workers | Session names | Hard rule |
|---|---:|---:|---|---|
| **E0 Point 0 inventory** | 1 | 0 | `OASIS-APPVERSE-MASTER-E0-TO-LAUNCH` | Strictly read-only production/application work |
| **E1–E6 controlled implementation** | 1 | 0–2 | Master + `OASIS-APP-WORKER-<TASK-ID>` + `OASIS-QA-WORKER-<TASK-ID>` | Maximum **3 total simultaneously**, subject to account quota |
| **E7 enterprise QA** | 1 | 0–2 | Same master; QA workers isolated | QA must not approve its own code |
| **E8 protected launch** | 1 | 0–1 read-only QA | Same master | Formal owner/department approvals; never autonomous GO |

The master itself is allowed to **implement Core/backend code in an isolated Core worktree** after E0, while the App worker changes **one distinct frontend repository** and QA worker reads/tests independently. No simultaneous writers on the same repository files or backend contract. A worker is a **Claude Code session or subagent**, not a GitHub branch. New worker names are per bounded task; close/retire sessions when finished rather than accumulating stale context.

If Claude account capacity is insufficient, run the **master alone**. More parallel sessions do **not** remove usage limits.

# 2. Choose the environment

**Recommended default:** a persistent macOS/Linux development machine or a trusted persistent Linux VM, with Claude Code CLI started from Central. This can be a local terminal inside Cursor, a standalone terminal, or Claude Desktop **Code** mode connected to the same working copies. A temporary `/workspace/scratch/...` workspace is **not** durable and should not be used as the sole source of evidence.

**What is not an execution environment:** a regular Claude.ai consumer chat, a ChatGPT conversation, Lovable's chat, or a GitHub issue by itself. GitHub issues store durable instructions and evidence but do not run an AI agent.

Prerequisites:
1. Claude Code installed and authenticated through the user's approved Anthropic account; use `claude --version`, `claude doctor`, `/status`, `/usage`.
2. GitHub CLI `gh` installed and `gh auth status` successful with access to Oasis repositories.
3. Git and relevant Node/package managers, Supabase CLI and tests installed or installed by Claude under approved non-production policy. Never send credentials through chat or commit them.
4. Workspace must retain files and `.git` between sessions, or load a fresh checkout at every scheduled run and restore state from GitHub.
5. Protected branch rules and repository-specific `CLAUDE.md` instructions remain active.

## One-time shell setup (run on the chosen machine, not in ChatGPT)

```bash
# Needs GitHub CLI and Claude Code already installed/authenticated.
gh auth status
claude --version
mkdir -p "$HOME/oasis-appverse"
cd "$HOME/oasis-appverse"

# One checkout per independently owned repository. Never overwrite existing checkouts.
for repo in Oasis-Baklawa-Central oasis-supabase-core oasis-ai-studio oasis-baklawa oasis-trace; do
  if [ -d "$repo/.git" ]; then
    echo "PRESERVE existing checkout: $repo"
    git -C "$repo" status --short
  else
    gh repo clone "oasisbaklawa2006/$repo"
  fi
done

# Do NOT clone oasis-baklawa as a website: it is the Buyer Expo repository.
# Website remote must first be verified from the existing Lovable Website project.

cd "$HOME/oasis-appverse/Oasis-Baklawa-Central"
git status --short
claude --name "OASIS-APPVERSE-MASTER-E0-TO-LAUNCH"
```

**Important: Point-0 runbook files are presently in unmerged DRAFT PR #642, not Central `main`.** Before asking the agent to read them, fetch the draft ref without merging or changing the current working tree:

```bash
cd "$HOME/oasis-appverse/Oasis-Baklawa-Central"
git fetch origin pull/642/head:refs/remotes/origin/point0-draft
# Inspect the instructions directly from the fetched draft tree:
git show origin/point0-draft:docs/appverse-point0/CLAUDE_AUTONOMOUS_EXECUTION_RUNBOOK_v1.md
git show origin/point0-draft:docs/appverse-point0/CLAUDE_AUTONOMOUS_WORK_ORDER.md
git show origin/point0-draft:docs/appverse-point0/progress.json
```

If Claude prefers a full read-only local file path, it may create a separate non-writing Git worktree checked out at this exact draft ref, with **no push or merge**. After PR #642 is reviewed and merged, read the then-current `main` version and reconcile any updated evidence; never rely on stale instructions.

Inside Claude Code, add permitted *read-only context* directories if needed using `/add-dir` for each sibling checkout (or use `--add-dir` when launching, if supported by installed CLI version). Use `/rename OASIS-APPVERSE-MASTER-E0-TO-LAUNCH` if you started without a name. Check `/help` if a command is disabled by plan or policy. **Start E0 in planning/read-only mode**, then paste the single mission bootstrap prompt in §9.

**Do not use** `--dangerously-skip-permissions` or permanently grant unrestricted shell and production privileges. Sandbox, permission allowlists and protected approvals stay enabled.

# 3. Repository and ownership map

| Work lane | Actual repo / project | Ownership | Primary agent |
|---|---|---|---|
| Mission Control | `oasisbaklawa2006/Oasis-Baklawa-Central` | Original 1–100, cross-repo status, Central frontend and operations | Master |
| Core | `oasisbaklawa2006/oasis-supabase-core` | Canonical migrations, RLS, RPCs, Edge Functions and cross-app contract authority | Master when active Core writer |
| AI Studio | `oasisbaklawa2006/oasis-ai-studio` | Product enrichment/creation UX, governed media, catalogue publication | App worker, after Core contract proof |
| Buyer App | `oasisbaklawa2006/oasis-baklawa` | Expo/React Native B2B buyer/mobile/carton UX | App worker |
| Trace | `oasisbaklawa2006/oasis-trace` | Label, scan, printer and physical telemetry clients | App worker |
| WhatsApp | Core and Central (existing two-repo boundary) | Authorized provider ingress, accountability, zero-loss cases, Central SO review | Master/Core + Central task owner; never parallel uncontrolled webhook |
| Website | Existing Lovable **Oasis Baklawa Website**, ID `bf9348e9-021e-47e6-8272-ceee39c7cb0b`; Github remote **NOT YET VERIFIED** | Public retail, corporate and trade presentation as an approved downstream consumer | App worker after remote/provenance verified |
| QA | Any owning repo / evidence worktree | Exact-SHA independent regression/security/integration evidence | QA worker |

**Website transfer:** Lovable source is at `98a2750a42df57494b1cbf136b43d9f957617739`, database enabled but not published at prior inspection. Preserve its `AGENTS.md` history warning, `WEBSITE_REPOSITORY_MIGRATION.md`, `OASIS_CONNECT_WEBSITE_CONTRACT.md`; do **not** force-push or confuse with Buyer. Before implementation, retrieve/verify the actual GitHub remote, history and connection to the current Lovable project. No new website repo just because the remote is not in this GitHub connection.

# 4. Git worktrees and safe worker creation

E0 needs **no new code branch** and performs **read-only inspection**. Once approved task `<ASM-ID>` is READY, create a separate branch/worktree in the owning repo **only**:

```bash
cd "$HOME/oasis-appverse/oasis-supabase-core"  # example: Core-owned task
git fetch origin main
# Replace example ID; check for an existing PR/branch first.
git worktree add -b "work/ASM-CORE-EXAMPLE" \
  "$HOME/oasis-appverse/worktrees/ASM-CORE-EXAMPLE" origin/main
cd "$HOME/oasis-appverse/worktrees/ASM-CORE-EXAMPLE"
claude --name "OASIS-CORE-ASM-CORE-EXAMPLE"
```

Replace repo and task ID appropriately. Do not reuse a branch name that already exists. One task lease means one writer per code surface. Cross-repo dependencies must be versioned **Core producer → consumer**, not independently implemented in multiple PRs.

## Never do these
- Do not run multiple agents against the same live worktree or migration ledger.
- Do not start a sixth "AI Studio fix everything" agent while another agent holds the Studio files.
- Do not rebase/force-push branches whose history is synced with Lovable.
- Do not create new paid Supabase previews, alter production secrets, or run migrations because a test requests it.
- Do not automatically merge, deploy, message customers, collect money, change domains, or publish storefronts.
- Do not use another account, proxy or undocumented quota-reset technique to circumvent Anthropic usage restrictions.

# 5. Execution phases, concurrency and acceptance

## E0 — Immediately, one master session, read-only
1. Read `APPVERSE_MISSION_CONTROL.md`, `appverse-control/state.json`, `dependency-graph.json`, original #437, #629, and relevant `CLAUDE.md` files. Read Point-0 draft #642 and refresh repair #643. Preserve original 1–100 wording/closure conditions.
2. Reconcile main commit SHA, open/merged PR and exact-head CI for every repository, production Vercel/Expo/Supabase deploy SHA, migration ledger, RLS, trusted role and authorization evidence.
3. Resolve the dedicated website remote without modifying Lovable code. Map every app's screens, modules, source-of-truth, real operating dependencies and missing test evidence.
4. Build **approved denominator** for Build, Testing and Certification, with unique original P001–P100 control IDs and app associations; avoid counting Core/WhatsApp controls twice.
5. Diagnose verified refresh defect: #643 identifies untracked generated state skipped by `git diff --quiet`. Reverify current PR exact head, CI and independent review. **Never claim live dashboard until first successful real evidence write after approved merge**.
6. Post `E0.1` report, READY queue, blockers, dependencies, agent ownership and resume pointer to #437. No feature code, merges or production changes.

## E1 — Shared backend, while *independent* audits can run
Master Claude implements approved Core-local repairs through draft PRs and exact-SHA validation: migration/drift preview issues, backend security, permissions, versioned product/customer/price/order/carton API contracts, idempotency, authentication, protected release controls. Studio/Buyer/Central/Trace workers may investigate UI and compile read-only tests concurrently but **must not activate Core-dependent commands** until required Core releases are verified.

## E2/E3 — AI Studio product and publication
App worker performs a bounded Studio task after backend contract availability; Core master may separately implement only Core-owned support. Verify 163-control form, Fast Create/full editor permissions, variants, reliable save, photo truth, AI review, compliance, approved catalogue, PDFs, smart share and published snapshots. Exact-SHA Studio acceptance is distinct from real production UAT.

## E4 — Three downstream channels can be developed concurrently *when task leases do not overlap*
- Buyer App: Expo/mobile auth/MSG91, approved catalogue, carton builder initially 4/6/10 (extensible), Core pricing and SO, recovery, actual Android/mobile UAT.
- WhatsApp: immutable message ledger, original sender/customer/forwarding employee identity, stitching, dedupe, operator-review, safe customer confirmation and one canonical SO, external provider UAT.
- Existing Website: verify actual Git repository provenance; preserve source; remove mock pricing, bind Oasis Connect `website_retail_v1`, customer-safe catalogue and governed checkout, mobile/SEO/visual acceptance.
**Concurrency cap remains three Claude sessions total.** Cycle App worker across separate owning repos; do not create one long-lived writer per app if this would exceed quota/lease limits. Central work can proceed independently on a Central-owned task after recorded dependencies.

## E5 — Central commercial authority
Complete actual order/quotation, finance, PI/invoice, GST, advance/credit, approved pricing/MOQ, single SO, duplicate/idempotent intake, allowed customer status and accounting audit. Finance must independently validate its real controls.

## E6 — Factory + Trace
Department KOT/production, procurement, assembly/packing, inventory, RGS/3PGS, batch and FEFO/FIFO, quality hold, physical labels/printers/scans, Dispatch readiness, invoice/E-way bill where applicable, Gatekeeper blocking and TV/handheld routes. Factory operators and security witness actual device scenarios.

## E7 — Enterprise cross-app UAT
Positive and negative path from published Studio product → Buyer/WhatsApp/Website → Central quote/SO → Finance → factory → Trace → physical dispatch → customer notification. Test roles, concurrent requests, duplicates, provider timeout, offline, cancellation, charge/payment boundary, recovery, performance, accessibility and rollback. Check exact deployed SHA; do not substitute screenshots or green CI for physical/provider evidence.

## E8 — Protected staged launch
After explicit authorized production release approvals: backend first, semantic readback and monitoring, consumers next, limited pilot, rollback/incident observation, business acceptance and owner GO. Record final certificate with linked proof, genuine deferred items, and postlaunch support. Do not claim "Appverse complete" solely from numerical progress.

# 6. How one task automatically advances to the next

## Task record
Every task must be a GitHub issue or a clearly referenced subitem of original #437, with:
`TASK_ID, ORIGINAL_POINT, E_STAGE, OWNER_REPO, SOURCE_HEAD, DEPENDS_ON, ACCEPTANCE_POSITIVE, ACCEPTANCE_NEGATIVE, STATUS, LEASE_OWNER, LEASE_EXPIRES_UTC, PR_URL, CI_RUNS, INDEPENDENT_REVIEW, PRODUCTION_GATE, PHYSICAL_OR_PROVIDER_GATE, LAST_CHECKPOINT, NEXT_COMMAND`.

**Statuses:** `NOT_STARTED → READY → IN_PROGRESS → REVIEW → VERIFIED → CLEARED`. Side states: `BLOCKED`, `PAUSED_QUOTA`, `HUMAN_APPROVAL`, `DEFERRED`. `VERIFIED` means specified software/evidence checks pass; `CLEARED` requires **every** business, security, release and physical/provider gate applicable to the original requirement.

### Repeatable state machine (one task per run)
1. Read #437 + current branch check + existing lease.
2. Select highest-priority original-point/ASM task whose prerequisites are **verified** and whose files/contract are not leased by another writer.
3. Claim short expiring lease and post START event to the task issue.
4. Inspect relevant implementation; avoid duplicating existing PR.
5. Make minimal repository-owned change in isolated branch; test positive/negative cases; self-review; open/update draft PR.
6. Await all required exact-head independent checks, respond to genuine findings and rerun changed-head tests.
7. Post GitHub evidence with PASS/FAIL/UNVERIFIED, protected approval need and status `VERIFIED` or `BLOCKED`.
8. If all clearance requirements have independently passed, mark `CLEARED`, update dashboard source register, choose next READY task. If human gate is necessary, leave task `HUMAN_APPROVAL` and select independent READY work only.
9. Commit checkpoint after every substantial task boundary and before session exit.

## Checkpoint template
```
RUN_ID:
SESSION: OASIS-APPVERSE-MASTER-E0-TO-LAUNCH
TASK_ID / ORIGINAL_POINT / STAGE:
REPO / BRANCH / EXACT_SHA:
SOURCE_EVIDENCE_URLS:
LEASE_OWNER / EXPIRY:
STATE: READY | IN_PROGRESS | REVIEW | VERIFIED | CLEARED | BLOCKED | PAUSED_QUOTA | HUMAN_APPROVAL
CHANGED_FILES:
TESTS_PASS / TESTS_FAIL / NOT_EXECUTED:
SECURITY_NEGATIVE_TESTS:
UPSTREAM / DOWNSTREAM CONTRACT PINS:
PROTECTED_RELEASE / DEVICE / PROVIDER EVIDENCE:
DASHBOARD_BUILD / TESTING / CERTIFICATION / COMBINED: N/V unless audited
BLOCKER / REASON:
NEXT_SAFE_ACTION / EXACT_RESUME_COMMAND:
OWNER_ACTION_REQUIRED: NONE or named approval
UPDATED_AT_UTC:
```

# 7. Autonomous scheduling and what can actually run unattended

**Today, the Claude runner has NOT been verified active or authenticated. GitHub PR #642 documents a work order, not a running AI worker.** Two alternative supported execution mechanisms are available **after owner/admin sets them up**:

### Preferred for an owner who wants minimal manual relaying: GitHub Actions Claude Code Action

1. In the Central repository install Anthropic's official GitHub Claude app or use a verified GitHub App identity with least-privilege permissions. **Credentials must be supplied via repository/environment secrets or workload identity**, never a chat or committed file.
2. Configure a trusted-default-branch GitHub Action using `anthropics/claude-code-action@v1`, initially `workflow_dispatch` only. Use an allowed `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN` (only when permitted by the provider/account) or approved workload identity. Never assume ChatGPT credentials transfer to Claude. See [Anthropic official setup](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md).
3. Restrict permissions to **read content and issues in E0**. Later authorize **issue comments, draft PRs and isolated branch writes only** to appropriate repos. Avoid globally writable production credentials. Enforce `concurrency` so only one coordinator runs at once; require a task lease and approved repo allowlist.
4. Trigger initially by manual `workflow_dispatch`, confirm real logs/identity, one E0.1 report and checkpoint. Only then add an hourly schedule or a tightly filtered `claude-ready` issue label trigger.
5. Every run reads GitHub state, works **one bounded eligible task**, posts checkpoint, and exits. GitHub carries memory across ephemeral runners; this **does not** depend on preserving one terminal process for months.
6. Disable automatic scheduling on governance failure, unverified credentials, lost lease or protected approval; never automatically press merge/deploy/real provider send.

**Alternative where enabled:** Claude Code `/schedule` creates a cloud-hosted routine; `/loop` repeats within an open session, not an unattended permanent runner. Check `/help` and account permissions. Configure a routine to read #437 and work the *next permitted* task with a GitHub checkpoint; ensure it honors the same lease/approvals and does not create a second overlapping runner. See [Claude Code power user guidance](https://support.claude.com/en/articles/14554000-claude-code-power-user-tips).

**ChatGPT's already-enabled hourly Appverse Point 0 Watch** is an independent oversight/watchdog, not a Claude worker. It can read GitHub, detect stalled/blocked lanes and perform permitted separate evidence reviews. It cannot reset Claude quotas, inherit Claude credentials, edit Claude's local workspace or auto-start Claude unless an external authorized runner is configured.

# 8. Quota exhaustion, pause and resume

**Never promise an uninterrupted Claude session.** A provider limit, GitHub runner timeout or VM shutdown stops active work. Build durability around independent GitHub checkpoints.

On Claude quota exhaustion:
1. Set active leased task `PAUSED_QUOTA`, record run, source SHA, worktree, task, tests, PR and full deterministic next action.
2. Persist any non-sensitive code and test evidence safely to its authorized branch/PR; *never* force-push secret material, production credentials or unreviewed binaries.
3. Release/expire the lease intentionally so other workers do not duplicate a partial migration. Mark any uncommitted work as nonportable and block automatic restart until recovered.
4. The GitHub/ChatGPT watcher may audit **independent read-only work** during the pause; a separately authorized nonoverlapping implementation agent may work only with a fresh lease. Do **not** hop accounts or bypass the quota.
5. Once provider usage legitimately restores, the configured runner re-reads #437 and checkpoints; checks the original branch/lease; resumes the **same** task safely if consistent. Otherwise mark `BLOCKED` and return to a safe READY task.

For interactive CLI session use `/resume` to return to a named/saved session. For a new automated GitHub runner, resume **state**, not conversational memory: reconstruct from exact GitHub issue, branch, SHA and last checkpoint.

# 9. FIRST AND ONLY COPY-PASTE PROMPT — new master Claude Code session

```text
OASIS BAKLAWA APPVERSE — AUTONOMOUS ENTERPRISE EXECUTION
SESSION: OASIS-APPVERSE-MASTER-E0-TO-LAUNCH
STAGE: E0 / POINT 0
MODE: READ-ONLY APPLICATION / PRODUCTION AUDIT; GITHUB CHECKPOINTS PERMITTED

You are the principal engineer and the primary backend/architecture worker.
Do not start a new feature programme or a competing dashboard.

Canonical controls:
Central #437 (original 1–100)
Central #629 (activation priorities)
Central #642 (Point-0 dashboard and work order; draft)
Central #643 (Mission Control evidence refresh repair; draft)
APPVERSE_MISSION_CONTROL.md
appverse-control/state.json
appverse-control/dependency-graph.json
All repository-local CLAUDE.md
docs/appverse-point0/CLAUDE_AUTONOMOUS_EXECUTION_RUNBOOK_v1.md
docs/appverse-point0/CLAUDE_AUTONOMOUS_WORK_ORDER.md
docs/appverse-point0/PROGRESS_BAR_SPEC_v1_1.md
docs/appverse-point0/progress.json

Your FIRST task:
1. Check your current actual Claude runner, GitHub auth, env, and scope.
2. Read the canonical records and locate all existing repository checkouts.
3. Verify exact heads, open PRs, checks, code, deployments and production authority.
4. Reconcile the 100 original requirements with app-specific modules, gates and evidence.
5. Verify the *actual* dedicated Lovable Website GitHub remote/provenance.
6. Verify Mission Control job evidence and review draft #643; do not merge it.
7. Publish the first E0.1 checkpoint to issue #437 with hard blockers and a
   dependency-ordered READY task register. Do not fabricate percentages.

Required dashboard per app, stage, original point and enterprise:
BUILD %, TESTING %, CERTIFICATION % and COMBINED %.
Combined = (Build + Testing + Certification)/3 ONLY after all three are
independently verified against approved exhaustive denominators; otherwise N/V.
GO/NO-GO is a separate protected decision.

Then proceed independently with the next safe READY task, respecting task
leases, repository boundaries, exact-head tests and independent approval.
For E0 do not modify application or production code.
Once E0 clears, implement bounded Core and application changes in isolated
repository worktrees; use at most two additional task-specific Claude workers
and never overlap backend/migration or file ownership.

At every task boundary post to GitHub:
RUN_ID, TASK_ID, REPO, SHA, STATUS, BLOCKERS, TESTS, PR, NEXT, QUOTA,
OWNER_ACTION, TIMESTAMP. Mark VERIFIED only with evidence; mark CLEARED only
when the original point's full security/runtime/physical/release criteria pass.
A merged PR alone is NOT CLEARED.

If blocked by another task, skip safely to independent work; if blocked by
protected owner approval, record and wait for that approval.
If quota exhausted, checkpoint PAUSED_QUOTA and stop until legitimate reset.
No bypass of production controls, no fake tests, no paid preview, no provider
or customer sends, no payments, no DNS cutover, no automatic final launch.

Start now with E0.1 read-only verification. Report only what was actually
executed; distinguish planned action from running automation.
```

# 10. What the owner must actually do — once

1. Choose **Claude Code CLI on a durable development machine/VM** or Claude Desktop Code mode; authenticate Claude and GitHub. Keep local machine running for live sessions, or provision an approved GitHub/cloud scheduled runner for unattended jobs.
2. Create the **one new named Claude Code session**, open Central repo and paste §9 verbatim **once**.
3. For truly no-repeat-copy operation, enable **one** GitHub-based automated Claude runner after proof of E0 manual run, proper secrets and explicit permissions; do not set two independently writable schedulers.
4. Verify website's actual GitHub repository remote in Lovable/GitHub (cannot infer it from name). Tell Claude which repo is authoritative only after evidence confirms.
5. Review and approve protected Core migrations, real provider sends/financial or production actions, and final enterprise GO where those controls require human sign-off. Otherwise follow the status dashboard and GitHub issues, not individual Claude chat responses.

**First successful milestone:** actual Claude E0.1 GitHub checkpoint recorded by authenticated runner, scoring denominators audited, website repo verified, next READY queue grounded; PR #643 separately reviewed and its refresher verified in a real later workflow run.

