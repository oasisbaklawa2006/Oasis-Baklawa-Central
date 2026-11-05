# Oasis Appverse — Claude Code Primary Engineer Run Protocol

## Start here
Operate as principal coding, migration, and test agent. **Start E0** and preserve the original 1–100 sequence in [#437](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/437); follow `APPVERSE_MISSION_CONTROL.md`, `appverse-control/state.json`, `dependency-graph.json` and each repository's `CLAUDE.md`. Work is repository-local. This is NOT permission to override protected approval.

## Autonomous task protocol
1. Pin current `main`, PR head, release and environment SHA for each task; read existing work and dependencies. One lease/owner per overlapping file/contract; no duplicate PR or parallel order authority.
2. Move only through `READY → IN_PROGRESS → REVIEW → VERIFIED → CLEARED`; `BLOCKED`, `PAUSED_QUOTA` and `HUMAN_APPROVAL` are valid durable states. A PR merge **never** automatically clears a task.
3. For each bounded task, document acceptance and negative tests, build smallest isolated patch in correct repo, run local checks, open a draft PR, wait for exact-head CI and independent review, repair actual findings and retest. Do not call a failing or synthetic check green.
4. Post checkpoint directly to the assigned GitHub issue/PR and update evidence JSON in a governed branch. `RUN_ID | TASK_ID | SHA | ASSIGNEE | DEPENDENCIES | STATUS | TESTS | EVIDENCE | NEXT | OWNER_ACTION | QUOTA`. This replaces owner copy-and-paste between chats.
5. When verified, select the next independently READY task automatically *only if* a real Claude runner/agent session is operational. Never attempt protected production changes without release approval.
6. On credit/session exhaustion: checkpoint cleanly to GitHub as `PAUSED_QUOTA`, preserve worktree/branch, exact resume command, lease TTL, affected PR/tests; stop API calls until quota legitimately refreshes. Independent **read-only** QA or nonoverlapping branch work may proceed by another authorized agent, but no quota circumvention, multiple-account evasion, or duplicate writes.

## Entire scope, in dependency-aware order
- **E0 — Source-of-truth census:** all five repos, dedicated Lovable Website, open PRs/branches, auth/RLS, active migrations, production deployment SHA, existing 100 original points, 163 Studio controls, website actual remote; score accepted scope only after denominator/evidence audit.
- **E1 — Core:** production-safe schema/RPC/Edge ownership, preview/decrypt fault, migration drift, user/tenant RLS and AAL2, approved product/price/GST and customer-scoped publication, versioned quote and atomic SO authority, carton profiles/constraints, idempotency, provider authorizations, safe rollback.
- **E2 — AI Studio product:** role-safe Fast Create, variants/packages, correct weights/units, AI suggestion governance, save/reload and approved facts/permissions; real role tests.
- **E3 — AI Studio catalogue:** original-preserving media, AI optional improvement, review/approval, verified public catalogue collection/PDF/share and Oasis Connect consumer snapshots; never invent source data.
- **E4 — channel work in separate owning repos:** Buyer Expo Android/iOS OTP, customer info/cart, extensible carton 4/6/10 initial types, Core quote, UAT; WhatsApp Core+Central zero-loss triad identity, packet stitching, clarifications, one SO and consented official replies; existing Lovable Website source preserved and remote verified before mock-seed removal and retail/corporate/trade Connect integration. No live launch.
- **E5 — Central commercial:** a single governed customer/company product/quantity/tax/quote/SO, finance credit and advances, PI/invoice/document, customer-safe statuses and orders without duplicate/replay, independent approval.
- **E6 — Central factory + Trace:** department queues, inventory/batch/FEFO and BOM, packing assembly RGS 3PGS, QC holds, labels/printers/signed scans, dispatch documents and independent gate blocking, live device acceptance.
- **E7 — enterprise QA:** cross-repo positive and negative journeys, authenticated roles, real devices/provider, security/performance/A11y/recovery, pinned environment proofs.
- **E8 — protected launch:** exact-head Core-first releases with real approvals, consumers after producer runtime, staged pilot, telemetry, rollback, owner GO and documented final certificate.

## Existing work to reuse, not duplicate
Original master #437; activation #629; WhatsApp #631; financial #632; actual current PRs Central #462/#630/#633/#634/#641, Buyer #59/#61/#65/#66–#69, Studio #271/#273/#274/#276–#279, Core #471/#472/#473/#477–#480. Review exact heads and latest CI, not historical notes. No new paid Supabase branches, secret disclosure, bypass of red CI, production writes/deployment, external customer sends, irreversible database changes, live payments or domain cutover without separately governed approval.

## First deliverable
Read-only `E0.1` report with actual website Git remote verification, per-repo SHA/PR/CI/deploy inventory, restored Mission-Control evidence-refresh diagnosis, accepted scope denominator and named readiness blockers. Only then ask for any genuine needed owner-only decision. Keep operating while the authorized Claude execution environment exists.

## Dashboard v1.1 scoring directive (owner-approved, 5 Nov)
See `docs/appverse-point0/PROGRESS_BAR_SPEC_v1_1.md`. Replace the three old user-facing labels (Build / Implemented / Certified) with **Build / Testing / Certification**, plus a derived **Combined** bar. Combined = arithmetic mean of the three **only** when verified and denominator-approved, otherwise null/N/V. Track metrics for every app, E0–E8 stage, original point 1–100, and weighted enterprise rollup; preserve separate GO/NO-GO authority. Do not fabricate rates or mistake merged PRs for user acceptance. For full independent testing include integration/runtime/negative scenarios. No new dashboard percentage until E0 audits finish.
