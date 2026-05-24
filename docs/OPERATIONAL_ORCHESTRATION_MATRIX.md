# Operational orchestration matrix

Last updated: 2026-05-20

| Capability | Primary lib / route | Data source today | Automation | Next persistence |
|------------|--------------------|-------------------|------------|-------------------|
| Inventory truth | `inventory-operating-system` | Caller projections | None | Movement ledger + RLS |
| Barcode lifecycle | `barcode/*` + `scan-timeline` | Demo / empty windows in UI | None | Scan event store |
| Execution gating | `execution-engine` + feeds | Caller booleans; CMD uses finance-only slice | None | Readiness checkpoints |
| Governance | `governance/*` | Static matrices | None | Approval instances |
| Media proof graph | `media-vault/mediaVaultDocumentGraph.ts` | Metadata template | None | Blob storage + links |
| CMD risk strip | `CMDWarRoom` + `CmdOperationalCommPulse` | Orders + WA + factory_inventory count + derived lanes | None | Wire scan + reservation counts |

**Rule:** Nothing in this matrix performs stock mutation, reservation confirmation, or dispatch execution without a future, explicitly reviewed write path.
