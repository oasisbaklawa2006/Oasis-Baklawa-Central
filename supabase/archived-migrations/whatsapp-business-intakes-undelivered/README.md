# WhatsApp Business Intakes — Undelivered Migrations (Quarantined)

**Status: `BLOCKED_UNDEPLOYED_PENDING_CANONICAL_REIMPLEMENTATION`**

## What this directory is

This directory holds 47 SQL migration files that were merged into `main` between
2026-07-18 and 2026-07-20 but were **never applied to the production database**.
They were originally located in `supabase/migrations/` and have been moved here
byte-for-byte, with git rename history preserved, so that they can no longer be
picked up by `supabase db push` or `supabase migration list` (both tools only
scan the top-level `supabase/migrations/` directory non-recursively — see
`supabase/migration-governance/blocked-undelivered-migrations.json` for the
verification evidence).

Nothing in this directory has been edited, squashed, renamed, or reordered. It is
the exact original SQL, relocated only.

## Why these were never deployed

There is no automated migration deployment pipeline anywhere in this repository
or its sibling repositories (`oasis-supabase-core`, `oasis-ai-studio`,
`oasis-trace`) — merging a migration file to `main` has never been sufficient by
itself to apply it to the live database. Deployment has always required a manual
`supabase db push`, which did not happen for this batch. This is a structural gap,
not a deliberate holdback of any specific migration.

## Why they are quarantined rather than deleted or deployed

These 47 files define a third, entirely separate WhatsApp intake table family
(`whatsapp_business_intakes` and descendants) that does not match the canonical,
approved architecture. The live operational WhatsApp pipeline is:

```
whatsapp-webhook -> whatsapp_messages -> whatsapp-message-stitcher ->
whatsapp_message_packets -> whatsapp-route-packet / whatsapp-identify-sender ->
Central OperatorInbox -> create_sales_order_draft_atomic -> sales_order_drafts
```

Deploying this batch as-is would create a third, competing WhatsApp production
lane. Per the approved WhatsApp Canonical Consolidation Design, useful concepts
from this batch (sender attribution, escalation register, SLA/accountability
tracking) are to be **reimplemented against the canonical schema**, not deployed
in their original form. Deleting the files outright would discard real design
work and lose git-history continuity; deploying them as-is would fragment the
WhatsApp data model. Quarantine preserves the content for reference while making
it structurally impossible to deploy by accident.

## What must NOT be done with this directory

- Do not move these files back into `supabase/migrations/`.
- Do not run `supabase db push` with a modified `--workdir` or config that
  re-includes this path.
- Do not treat any object defined here as available in application code —
  none of these tables, functions, or triggers exist in the live database.
- Do not edit these files in place. If a concept from one of these migrations is
  approved for reimplementation, it should be written as a new migration in
  `supabase/migrations/` against the canonical schema, with its own review.

## Related governance

- Machine-readable inventory: `supabase/migration-governance/blocked-undelivered-migrations.json`
- Architecture decision record: `docs/architecture/ADR-whatsapp-business-intakes-not-deployed.md`
- CI guard preventing silent reintroduction: see the repository's CI workflow
  (job: migration path guard)
- Canonical WhatsApp pipeline design: `docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md`,
  `docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md`

## File inventory (47 files, original filenames preserved)

20260718173000_wa_zero_loss_intake_foundation.sql
20260718190000_wa_zero_loss_inbound_wiring.sql
20260718193000_wa_zero_loss_operator_queue.sql
20260718200000_wa_zero_loss_lifecycle_actions.sql
20260719040000_wa_zero_loss_identity_triad.sql
20260719040500_wa_zero_loss_identity_role_switching.sql
20260719041000_wa_zero_loss_identity_reference_hardening.sql
20260719061000_wa_zero_loss_formal_clarifications.sql
20260719061500_wa_zero_loss_formal_clarification_rpc_security.sql
20260719062000_wa_zero_loss_formal_clarification_closure.sql
20260719062500_wa_zero_loss_clarification_due_time_required.sql
20260719080000_wa_zero_loss_multi_intent_routing.sql
20260719083000_wa_zero_loss_intent_lifecycle.sql
20260719084000_wa_controlled_contextual_alias_learning.sql
20260719084100_wa_contextual_alias_parent_reconciliation.sql
20260719084200_wa_contextual_alias_reuse_audit.sql
20260719090000_wa_multimodal_failure_safe_intake.sql
20260719101500_wa_so_readiness_lineage.sql
20260719114500_wa_so_readiness_lineage_hardening.sql
20260719130000_wa_zero_loss_reconciliation_exceptions.sql
20260719143000_wa_zero_loss_sla_management_dashboard.sql
20260719162500_wa_atomic_shift_signoff.sql
20260719170000_wa_clarification_answer_rpc_authority.sql
20260719170000_wa_escalation_and_shift_reconciliation.sql
20260719183000_wa_operator_cockpit_manager_drilldown.sql
20260719193000_wa_escalation_lifecycle_controls.sql
20260719213000_wa_intake_governed_transition_only.sql
20260719222500_wa_child_ledgers_governed_write_only.sql
20260720003000_wa_zero_loss_accountability_ledger.sql
20260720013000_wa_multi_message_packet_reconstruction.sql
20260720022000_wa_packet_accountability_queue.sql
20260720023000_wa_authorized_channel_intake_boundary.sql
20260720030000_wa_authorized_channel_history_reconciliation.sql
20260720082000_wa_authorized_channel_accountability_queue.sql
20260720100000_wa_authorized_channel_accountability_preflight.sql
20260720152000_wa_authorized_channel_accountability_breach_register.sql
20260720164000_wa_authorized_channel_accountability_reconciliation_summary.sql
20260720171000_wa_accountability_queue_deterministic_order.sql
20260720173500_wa_accountability_reconciliation_exception_register.sql
20260720184500_wa_accountability_reconciliation_parity.sql
20260720201500_wa_null_governed_state_classification_repair.sql
20260720203000_wa_stale_accountability_escalation_register.sql
20260720213000_wa_accountability_transition_integrity_register.sql
20260720214500_wa_historical_evidence_forward_repair_register.sql
20260720223000_wa_stale_accountability_escalation_summary.sql
20260720230000_wa_zero_loss_operations_summary.sql
20260720231500_wa_zero_loss_attention_register.sql

**Note:** two files share the identical timestamp prefix `20260719170000`
(`wa_clarification_answer_rpc_authority.sql` and
`wa_escalation_and_shift_reconciliation.sql`). This is preserved as-is from the
original merge history; it is flagged here as a known ordering ambiguity that
would have affected deployment order had this batch ever been pushed.
