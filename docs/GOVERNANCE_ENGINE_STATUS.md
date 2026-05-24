# Governance / approval engine — status

Last updated: 2026-05-20

## What is real in-tree

- Authority graph scaffolding, approval matrix requirements, override policy table, escalation copy, audit visibility notes, and protected transition lists (`src/lib/governance/`).
- `buildGovernanceOperationalFeed` — projects matrix and override rules into read-only operational events.

## What is projection-only

- Every row uses `occurredAt: null`; there is no live approval ticket system in this foundation.
- Inventory-side `inventoryGovernance.ts` mirrors static roles for future enforcement.

## What still requires persistence

- Approval instances, signatures, dual-control logs, and irreversible transition guards in API middleware.

## Safety

- No mutations, no silent overrides, no customer exposure of internal escalation text.
