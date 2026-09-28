# APPVERSE-AI-FINAL-01 — AI Studio finalisation routing

**ASM-ID:** `APPVERSE-AI-FINAL-01`  
**THREAD-ID:** `ai-studio-finalisation-20260919`  
**REPOSITORY:** `oasisbaklawa2006/oasis-ai-studio`  

## Mission

Reconcile current AI Studio `main` against the AI/knowledge-plane scope and complete the remaining AI Studio-owned software necessary for final Appverse convergence.

The lane includes repository-local product authoring, product/variant hierarchy, approved packaging metadata, media workspace, catalogue/version/publication workflow, AI-assisted naming/descriptions/aliases/multilingual/channel copy, mobile creation/approval surfaces, deferred-detail handling, AI Studio-owned runtime/deployment artefacts, stale/superseded AI Studio PR reconciliation, and exact-head certification.

Integration work in this ASM item is verification from the AI Studio side. Central, Core, Buyer and Trace remain separate authorities.

## Dependencies

- current `oasisbaklawa2006/oasis-ai-studio/main`
- `oasisbaklawa2006/oasis-supabase-core` as canonical backend/migration/RPC/Edge authority
- Task 5 canonical Core defect ledger
- Mission Control dependency nodes:
  - `AI-POINT49`
  - `AI-POINT50`
  - `AI-POINT51`
  - `AI-ALIAS-SESSION`
  - `CORE-AI-CHAT-CAPTURE`
  - `CENTRAL-AI-CHAT-CONSUMER`
- current Central published-product consumer contract
- current Buyer customer-safe publication contract
- current Trace approved product/label consumption contract
- external website publication architecture as discoverable from current evidence

## Authorized actions

The AI Studio execution thread may:

- inspect and modify `oasis-ai-studio` code/config/tests/docs;
- create repository-local branches and PRs;
- run repository-local tests/CI and fix exact-head findings;
- inspect Core/Central/Buyer/Trace contracts read-only;
- verify AI Studio-side producer/consumer compatibility;
- classify old AI Studio PRs as current, merged-by-replacement, superseded, duplicate or stale;
- perform AI Studio-owned deployment/runtime verification only under the repository's existing release/production controls;
- return cross-repository defects to Mission Control with exact evidence.

## Prohibited scope expansion

This ASM assignment does not authorize the AI Studio thread to:

- create or edit Core migrations/schema/RPC authority;
- mutate Central implementation;
- mutate Buyer implementation;
- mutate Trace implementation;
- bypass protected production controls;
- mutate production merely to investigate;
- manufacture provider, physical-device, human-review or external-system evidence;
- declare Point100, Production Readiness or APPVERSE COMPLETE.

## Stop condition

Return control to Mission Control when all of the following are true:

1. AI Studio repository-owned software scope is reconciled against current main.
2. Required AI Studio-owned implementation gaps are repaired.
3. Exact-head required CI/tests are green.
4. Current AI Studio-owned P0/P1 count is zero.
5. AI Studio-owned deployment/runtime evidence is complete as far as authorized.
6. Old/open AI Studio PRs are classified and unique still-required work is preserved.
7. AI Studio-side Core/Central/Buyer/Trace/website contracts are verified or exact foreign-scope defects are routed.
8. Remaining blockers, if any, are only explicit upstream/downstream release gates, protected-production approvals, external-provider actions, or physical-device/human evidence.

Valid terminal status:

`APPVERSE-AI-FINAL-01 — AI STUDIO REPOSITORY SCOPE CLEARED`

or, when the repository work is complete but external authority remains:

`APPVERSE-AI-FINAL-01 — AI STUDIO SOFTWARE COMPLETE TO AUTHORITY BOUNDARY — BLOCKED ONLY BY: <exact external gates>`

## Production safety

Repository production gates remain authoritative. Before any AI Studio-authorized production mutation, verify exact SHA/CI, inspect production read-only, identify mutation/blast radius/rollback/environment/secrets, then execute only the scoped authorized action and verify runtime afterward.

`PR MERGED != STAGE CLEARED`.
