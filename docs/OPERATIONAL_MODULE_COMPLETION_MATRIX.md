# Operational module completion matrix

Last updated: 2026-05-20

| Module | Current status | Pilot ready? | Blocking gap | Backend required? | Risk | Next PR |
|--------|----------------|--------------|--------------|---------------------|------|---------|
| Inventory operating system | Domain + feeds + admin suite + CMD strip (projection) | Partial | Movement ledger + reservation locks | Yes | Misread as live stock | `inventory-ledger-persistence` (TBD) |
| Barcode scan lifecycle | Anomaly derivation + payloads + scan timeline shell | Partial | Scan event store + hardware | Yes | False scan confidence | `barcode-scan-store` (TBD) |
| Execution dependency engine | Graph + lane evaluation + feeds + CMD aggregate | Partial | Per-order readiness flags | Yes | Incomplete bottleneck picture | `execution-readiness-bind` (TBD) |
| Governance foundation | Matrices + feeds + policy copy | Partial | Approval instances + enforcement | Yes | Unauthorized overrides | `governance-approval-persist` (TBD) |
| Retail / store coordination | Route + inventory read + local reservation/factory drafts + timelines | Partial | Shelf truth + reservation API | Yes for pilot bookings | Customer promise drift | `retail-reservation-backend` (TBD) |
| Inventory visibility | `factory_inventory` snapshot + confidence | Partial | Per-outlet shelf / POS | Yes | Misread as shelf stock | `shelf-inventory-read` (TBD) |
| Barcode / label system | Payload builders + Label Command Center shell + scan lifecycle libs | No | Print execution + symbology rules | Optional for JSON-only pilot | Wrong label format | `label-print-adapter` (TBD) |
| Reservation / prebooking | Local drafts + projections + reservation board (shell) | No | Persisted rows + stock policy | Yes | Double-booking | merge with retail backend PR |
| Factory follow-up | Local drafts + projections | No | Persisted queue + notifications | Yes | Missed production asks | `factory-followup-queue` (TBD) |
| Customer timeline | Curated component + staff preview | No | Bind to order state + auth scope | Yes for public | Over-sharing internals | `customer-timeline-bind` (TBD) |
| WhatsApp engine | Inbox + projections elsewhere | Partial | — | — | Volume / staffing | ops process |
| Finance board | Shipped surfaces | Partial | — | — | Credit policy | ongoing |
| Dispatch | War room + dispatch mgmt | Partial | — | — | SLA drift | ongoing |
| Approval engine | Existing flows + governance foundation libs | Partial | New matrices not enforced | Yes | Policy drift | ongoing |
| Media vault | Document graph metadata + types | No | Storage policy + uploads | Yes | Compliance | `media-vault-storage` (TBD) |
| Notification center | Partial | No | Unified outbox | Yes | Missed alerts | future |
| AI order intake | Not in this block | No | Guardrails | Yes | Bad orders | future |
| CMD war room | Orders + WA + inventory head + execution strip + inventory links | Partial | Live scan + reservation counts | Yes for true coverage | False sense of coverage | `cmd-retail-signals` (TBD) |

**Pilot ready?** “Partial” means safe for **internal** rehearsal with manual verification, not unattended customer-facing promises.
