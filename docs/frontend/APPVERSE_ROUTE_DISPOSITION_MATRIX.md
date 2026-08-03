# App-Verse Route Disposition Matrix

Purpose: decide what happens to every current Central admin route before screen-level implementation. This is a frontend disposition only; routes are not deleted or redirected by this document.

Legend:
- KEEP = retain as canonical primary/specialist screen
- SIMPLIFY = retain route/capability but redesign interaction
- CONSOLIDATE = move daily use into a stronger canonical surface; retain compatibility route until certified
- SPECIALIST = deep tool, not daily primary navigation
- LINK-OUT = context/deep link to another App-Verse application authority
- BLOCKED-BY-BACKEND = final action model waits for backend schema/contract confirmation

## Home / command

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin` | SIMPLIFY | role-aware Home / attention surface |
| `/admin/heartbeat` | SPECIALIST | executive analytical deep dive |
| `/admin/target-vs-actual` | SPECIALIST | management performance review |

## Customers / Sales / WhatsApp / Support

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin/clients` | SIMPLIFY | canonical customer context |
| `/admin/approvals` | CONSOLIDATE | customer/access approval mode within customer context |
| `/admin/operator-inbox` | SIMPLIFY | canonical WhatsApp/customer-attention operator surface |
| `/admin/whatsapp` | CONSOLIDATE | compatibility alias to operator inbox |
| `/admin/support` | SIMPLIFY | support/ticket queue sharing customer/order context |
| `/admin/exceptions` | SPECIALIST | unresolved business exceptions |
| `/admin/customer-timeline-preview` | KEEP | customer activity/history drill-down |
| `/admin/operational-search` | KEEP | cross-domain search |
| `/admin/sales-hub` | SPECIALIST | sales performance view |
| `/admin/central-pool` | CONSOLIDATE | compatibility alias |
| `/admin/cmd-war-room` | CONSOLIDATE | compatibility alias |

## Orders / Finance

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin/order-management` | SIMPLIFY | canonical order-centric operating surface |
| `/admin/orders` | CONSOLIDATE | legacy/general order list compatibility |
| `/admin/accounts-release` | SIMPLIFY | finance/account release queue |
| `/admin/finance` | SIMPLIFY | finance daily queue and payment review |
| `/admin/finance-board` | SPECIALIST | finance release overview |
| `/admin/finance-governance` | SPECIALIST | governance/audit controls |
| `/admin/pricing` | KEEP | pricing configuration/specialist work |
| `/admin/moq` | KEEP | MOQ policy/configuration |
| `/admin/currency` | KEEP | currency configuration |

## Operations / Production / Stores

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin/execution-command-center` | SIMPLIFY | canonical management execution view |
| `/admin/live-work-queues` | CONSOLIDATE | queue lens within command center |
| `/admin/execution-risk` | SPECIALIST | risk view |
| `/admin/execution-bottlenecks` | SPECIALIST | bottleneck analysis |
| `/admin/execution/production` | SIMPLIFY | canonical production/HOD board |
| `/admin/execution/assembly` | SIMPLIFY | canonical assembly execution board |
| `/admin/execution/ready-goods` | SIMPLIFY | ready-goods execution board |
| `/admin/execution/dispatch` | SIMPLIFY | dispatch execution board |
| `/admin/execution/third-party` | SIMPLIFY | third-party execution board |
| `/admin/execution/retail` | SIMPLIFY | retail coordination execution board |
| `/admin/execution/complaints` | CONSOLIDATE | complaints lens into support/customer attention |
| `/admin/inventory-command-center` | SIMPLIFY | canonical stores/inventory operating view |
| `/admin/reservation-board` | SPECIALIST | reservations detail |
| `/admin/inventory-risk-board` | SPECIALIST | shortage/risk analysis |
| `/admin/ready-goods` | CONSOLIDATE | compatibility/details behind ready-goods execution |
| `/admin/store-coordination` | SIMPLIFY | store transfer/coordination work |
| `/admin/stock-finalization` | BLOCKED-BY-BACKEND | controlled stock finalization action |
| `/admin/assembly-tasks` | CONSOLIDATE | compatibility route to assembly execution model |
| `/admin/production` | CONSOLIDATE | legacy/general production view |
| `/admin/operations` | CONSOLIDATE | legacy/general operations view |
| `/admin/inventory` | CONSOLIDATE | legacy/general inventory view |
| `/admin/department` | CONSOLIDATE | legacy departmental view |
| `/admin/3pcs-store` | SIMPLIFY | specialized third-party store surface |

## Trace / Packing / Dispatch

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin/scan-timeline` | KEEP | trace evidence timeline / deep link context |
| `/admin/carton-explorer` | KEEP | carton traceability detail |
| `/admin/label-command-center` | KEEP | labels/identifiers |
| `/admin/dispatch-readiness` | SIMPLIFY | readiness decision/action queue |
| `/admin/dispatch-completion` | SIMPLIFY | completion evidence/action |
| `/admin/dispatch-finalization` | BLOCKED-BY-BACKEND | final authority/action contract |
| `/admin/dispatch-mgmt` | CONSOLIDATE | legacy/manager dispatch surface |
| `/admin/packing-dispatch` | CONSOLIDATE | legacy combined packing/dispatch surface |
| `/admin/dispatch` | CONSOLIDATE | compatibility/general dispatch route |
| `/security-gate` | SIMPLIFY | dedicated gate/physical handover surface |
| `/admin/golden-chain-operator` | BLOCKED-BY-BACKEND | sequential cross-domain operator action |

Central should expose trace context and evidence; specialist Trace application authority must not be duplicated in Central.

## Products / Catalogue

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin/products` | SIMPLIFY | operational product master context |
| `/admin/merchandising` | KEEP | merchandising context |
| `/admin/catalogue-sync` | KEEP | publication/sync status |
| `/admin/catalogue-approvals` | KEEP | approval queue |
| `/admin/product-intelligence-prototype` | LINK-OUT | AI Studio/product intelligence authority |

## Governance / Administration

| Route | Disposition | Target role/use |
|---|---|---|
| `/admin/users` | KEEP | user/role administration |
| `/admin/settings` | KEEP | settings |
| `/admin/audit` | SPECIALIST | audit trails |
| `/admin/notifications` | KEEP | notification management |
| `/admin/announcements` | KEEP | announcements |
| `/admin/display-management` | KEEP | TV/display administration |
| `/admin/logistics` | KEEP | logistics configuration/management |
| `/admin/entity-graph-explorer` | SPECIALIST | diagnostic/deep relationship explorer |
| `/admin/queue-execution-preview` | SPECIALIST | preview/diagnostic |
| `/admin/barcode-execution-preview` | SPECIALIST | preview/diagnostic |
| `/admin/verification` | CONSOLIDATE | compatibility redirect to execution command center |

## TV surfaces

| Route | Disposition |
|---|---|
| `/tv/arabic-sweets` | SIMPLIFY as dedicated distance-view surface |
| `/tv/chocolate` | SIMPLIFY as dedicated distance-view surface |
| `/tv/dragees` | SIMPLIFY as dedicated distance-view surface |
| `/tv/fusion` | SIMPLIFY as dedicated distance-view surface |
| `/tv/bakery` | SIMPLIFY as dedicated distance-view surface |
| `/tv/nuts` | SIMPLIFY as dedicated distance-view surface |
| `/admin/assembly-tv` | SIMPLIFY as dedicated distance-view surface |
| `/admin/rgs-tv` | SIMPLIFY as dedicated distance-view surface |
| `/admin/dispatch-tv` | SIMPLIFY as dedicated distance-view surface |

## Implementation rule

No route is removed in the first redesign wave. Consolidated routes remain functional compatibility paths until the replacement screen has passed role-by-role UAT, direct-link testing, permission testing and workflow acceptance.
