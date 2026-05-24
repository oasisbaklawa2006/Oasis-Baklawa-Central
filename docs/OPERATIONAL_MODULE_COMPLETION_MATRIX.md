# Operational module completion matrix

Last updated: 2026-05-24

| Module | Current status | Pilot ready? | Blocking gap | Backend required? | Risk | Next PR |
|--------|----------------|--------------|--------------|---------------------|------|---------|
| Retail / store coordination | Route + inventory read + local reservation/factory drafts + timelines | Partial | Shelf truth + reservation API | Yes for pilot bookings | Customer promise drift | `retail-reservation-backend` (TBD) |
| Inventory visibility | `factory_inventory` snapshot + confidence | Partial | Per-outlet shelf / POS | Yes | Misread as shelf stock | `shelf-inventory-read` (TBD) |
| Barcode / label system | Payload builders + Label Command Center shell | No | Print execution + symbology rules | Optional for JSON-only pilot | Wrong label format | `label-print-adapter` (TBD) |
| Reservation / prebooking | Local drafts + projections | No | Persisted rows + stock policy | Yes | Double-booking | merge with retail backend PR |
| Factory follow-up | Local drafts + projections | No | Persisted queue + notifications | Yes | Missed production asks | `factory-followup-queue` (TBD) |
| Customer timeline | Curated component + staff preview | No | Bind to order state + auth scope | Yes for public | Over-sharing internals | `customer-timeline-bind` (TBD) |
| WhatsApp engine | Inbox + projections elsewhere | Partial | — | — | Volume / staffing | ops process |
| Finance board | Shipped surfaces | Partial | — | — | Credit policy | ongoing |
| Dispatch | War room + dispatch mgmt | Partial | — | — | SLA drift | ongoing |
| Approval engine | Existing flows | Partial | — | — | Bottleneck | ongoing |
| Media vault | Not in this block | No | Storage policy | Yes | Compliance | future |
| Notification center | Partial | No | Unified outbox | Yes | Missed alerts | future |
| AI order intake | Not in this block | No | Guardrails | Yes | Bad orders | future |
| CMD war room | Orders + WA + inventory head + retail pilot strip | Partial | Live retail/reservation counts | Yes for true counts | False sense of coverage | `cmd-retail-signals` (TBD) |

**Pilot ready?** “Partial” means safe for **internal** rehearsal with manual verification, not unattended customer-facing promises.
