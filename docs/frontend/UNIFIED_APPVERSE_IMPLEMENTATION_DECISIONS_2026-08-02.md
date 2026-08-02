# Unified App-Verse Frontend — Implementation Decisions

Date: 2026-08-02

## Adopt

- Seven-workspace global information architecture.
- Role-specific Home rather than one generic admin dashboard.
- Existing route tree retained behind the new shell during migration.
- Shared design-token layer for Central, AI Studio and Trace.
- Contextual detail sheets/drawers to reduce navigation loss.
- Deep links across authority owners rather than duplicate editors.
- Handheld/TV surfaces treated as distinct operational modes, not scaled desktop pages.

## Do not adopt

- A permanently expanded sidebar containing every route.
- A CSS-only redesign that leaves current information architecture unchanged.
- Copying AI Studio product-write capability into Central.
- Copying Trace physical-evidence writes into Central.
- Removing legacy/audit routes during the first frontend tranche.
- Using decorative premium typography on dense operational tables and scan flows.
- Showing preview/audit/diagnostic modules as equal-weight daily navigation.

## First implementation boundary

The first code PR after this specification should touch shell/navigation/design-system files only. It should not redesign business modules yet. Existing screens remain functional behind the new navigation until shell UAT is complete.
