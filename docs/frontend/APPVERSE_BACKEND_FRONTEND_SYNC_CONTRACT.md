# Oasis App-Verse Backend ↔ Frontend Synchronization Contract

## Purpose

The backend-development thread defines business truth. The frontend workstream translates that truth into the simplest usable role experience without redefining database authority.

## Authority order

1. Supabase/Core owns schema, RLS, durable contracts and authoritative data state.
2. Central owns operational command and permitted business actions.
3. AI Studio owns governed product/editorial enrichment workflows.
4. Trace owns physical traceability, scan evidence and handover visibility.
5. Buyer App owns customer-facing presentation and governed buyer actions.
6. Frontend workspaces are navigation/presentation containers only; they are not backend departments.

## Module handoff minimum

A backend module is ready for detailed frontend freeze only when the backend thread can state:

- canonical entities and identifiers;
- source-of-truth tables/views/RPCs;
- role and permission boundaries;
- allowed actions and approval authority;
- state machine and terminal states;
- exceptions, overrides and escalation paths;
- audit evidence requirements;
- automation triggers and human-decision points;
- data freshness/realtime expectations;
- mobile/scan/TV-specific operational requirements where applicable.

## Frontend translation

For each backend-ready module, frontend then defines:

- role-specific Home signals;
- primary queue and next action;
- exception/attention treatment;
- list/detail hierarchy;
- progressive disclosure of secondary controls;
- mobile/handheld interaction pattern;
- TV/display pattern where relevant;
- empty/loading/error/offline states;
- accessibility and keyboard/touch behavior;
- analytics/observability events;
- UAT acceptance criteria.

## Non-negotiables

- Do not expose a UI action merely because a table is writable.
- Do not duplicate backend authority in client-side conditions.
- Do not let workspace grouping alter backend department ownership.
- Do not fabricate KPI values when an authoritative source is not yet defined.
- Preserve auditability for approvals, overrides, financial release, dispatch and trace evidence.
- Keep advanced tools available through compatibility navigation until replacement flows pass UAT.
- Prefer one obvious next action over dense button matrices.

## Current visual direction

The canonical UI direction is:

**Lumia operational simplicity + Dubai Mall / Souk / Quiet Luxury visual system + backend-authoritative workflows.**

Operational interfaces prioritize speed and legibility. Premium character comes from typography, spacing, restrained surfaces and material cues rather than decoration.

## Current App-Verse navigation model

Seven UI workspaces:

1. Home
2. Customers & Sales
3. Orders & Finance
4. Operations
5. Products & Catalogue
6. Trace & Dispatch
7. Governance

These workspaces are deliberately broader than backend domains and must never be interpreted as schema boundaries.
