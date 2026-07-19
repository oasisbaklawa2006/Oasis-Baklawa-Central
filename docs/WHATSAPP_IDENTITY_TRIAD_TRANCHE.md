# WhatsApp Identity Triad Tranche

## Objective

Persist and govern the three identities required by the canonical WhatsApp programme:

1. submitting sender;
2. original communicator;
3. commercial customer.

## Safety boundary

This tranche is additive and does not create or mutate orders, order items, sales-order drafts, finance, dispatch, inventory, Customer Master, or Product Master truth.

## Governed behaviour

- Contact and internal-user identities remain mutually exclusive for each person-role.
- Complete resolution requires all three identities plus an operator evidence note.
- Partial resolution remains visible and actionable under `AWAITING_CUSTOMER` where applicable.
- Resolution is authorized, row-locked, and append-only audited.
- Explicit role-type correction replaces the previous role type rather than producing an ambiguous dual identity.
- Converted and explicitly closed intakes cannot have identity history rewritten.

## Validation targets

- migration contract tests;
- authorization and terminal-state guards;
- row-locking and audit evidence;
- identity-role replacement regression coverage;
- downstream write-boundary checks.
