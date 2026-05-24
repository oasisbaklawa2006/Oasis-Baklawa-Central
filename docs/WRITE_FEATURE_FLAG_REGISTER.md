# Write feature flag register

Last updated: 2026-05-20

All flags are defined as **compile-time constants** in `src/config/writeFeatureFlags.ts`. Default value in this repository: **false** for every flag. There are **no** `import.meta.env` or `process.env` reads in this register.

| Constant | Gates (high level) |
|----------|-------------------|
| `ENABLE_RETAIL_RESERVATION_WRITES` | Reservation draft create/cancel adapters |
| `ENABLE_FACTORY_FOLLOWUP_WRITES` | Factory follow-up queue adapters |
| `ENABLE_MEDIA_METADATA_WRITES` | Media attachment metadata writes |
| `ENABLE_NOTIFICATION_ACK_WRITES` | Notification acknowledge persistence |
| `ENABLE_INVENTORY_HOLD_WRITES` | Inventory hold requests **and** reconciliation note writes (shared gate until split) |
| `ENABLE_APPROVAL_REQUEST_WRITES` | Approval request creation |

`isWriteFeatureEnabled` in `writeFeatureGate.ts` resolves the flag per `WriteActionKind` via `WRITE_AUTHORITY`.

## Operational meaning

Until product and security explicitly enable a flag in a controlled release, **adapters must not perform I/O** for that class of write. UI may surface previews and disabled submit controls only.
