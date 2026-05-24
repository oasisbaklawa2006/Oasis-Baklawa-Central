# First safe persistence candidates

Last updated: 2026-05-20

This list orders **likely first** persistence work once the controlled-write program approves real mutations. It is not a commitment to build order; each item still needs schema, RLS, audit, and rollback design in its own change set.

1. **Notification acknowledge** — small state transition, clear compensating semantic; still needs outbox and actor scope.
2. **Media attachment metadata** — metadata row without binary pipeline first, or metadata after blob upload contract is fixed.
3. **Approval request create** — append-only request row with dual-control logging; finance route already familiar.
4. **Retail reservation draft** — operator-visible draft with idempotency; depends on stock policy and conflict rules **outside** this UI.
5. **Factory follow-up queue** — queue row without WhatsApp auto-send; linkage to production jobs later.
6. **Inventory reconciliation note** — narrative note without ledger movement (hold flag shared until split).
7. **Inventory reservation hold request** — intent row only until movement ledger and holds are approved.

**Explicitly not in this foundation PR:** stock deduction, dispatch release mutation, WhatsApp auto-send, C2C execution, autonomous automation.
