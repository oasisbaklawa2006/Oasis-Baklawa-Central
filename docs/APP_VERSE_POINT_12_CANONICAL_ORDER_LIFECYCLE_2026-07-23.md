# App-Verse Point 12 — Canonical Order Lifecycle

**Status:** DOCUMENTED GOVERNANCE FREEZE  
**Runtime implementation:** NOT CLAIMED  
**Programme point:** 12

## Purpose

Freeze one canonical order lifecycle shared across Customer App, WhatsApp intake, Central, Finance, Inventory, Production, Packing, Trace, Dispatch and customer-safe projections.

## Authority

- Customer App and WhatsApp may initiate order intent.
- Central is the canonical order authority.
- Finance controls financial clearance and holds.
- Central Inventory controls reservation and availability consequences.
- Production, Assembly, Packing and Dispatch execute governed work derived from the order.
- Trace supplies physical identity and movement evidence.
- Supabase Core governs shared contracts and customer-safe projections.

## Canonical lifecycle

1. `INTENT_CAPTURED`
2. `DRAFT_CREATED`
3. `DRAFT_UNDER_REVIEW`
4. `VALIDATION_FAILED` or `VALIDATED`
5. `AWAITING_CUSTOMER_CONFIRMATION` where required
6. `SUBMITTED`
7. `ACCEPTED`
8. `FINANCE_REVIEW`
9. `FINANCE_HOLD` or `FINANCE_CLEARED`
10. `INVENTORY_REVIEW`
11. `INVENTORY_HOLD`, `PARTIALLY_RESERVED`, or `RESERVED`
12. `PRODUCTION_REQUIRED` where stock is insufficient
13. `PRODUCTION_PLANNED`
14. `IN_PRODUCTION`
15. `PRODUCTION_COMPLETE`
16. `ASSEMBLY_PENDING` or `ASSEMBLY_COMPLETE` where applicable
17. `PACKING_PENDING`
18. `PACKING_IN_PROGRESS`
19. `PACKED`
20. `DISPATCH_READY`
21. `LOADING_IN_PROGRESS`
22. `DISPATCHED`
23. `IN_TRANSIT`
24. `DELIVERED`
25. `CLOSED`

## Alternate terminal or exceptional states

- `REJECTED`
- `CANCELLED`
- `EXPIRED`
- `FAILED`
- `PARTIALLY_FULFILLED`
- `RETURN_INITIATED`
- `RETURNED`
- `REFUND_PENDING`
- `REFUNDED`
- `DISPUTED`

No order may disappear silently. Every rejected, failed, cancelled or expired path must preserve reason, actor, timestamp, correlation ID and audit evidence.

## State-transition rules

- State changes occur only through authorised commands.
- Every transition records previous state, new state, actor, reason, command ID, correlation ID and causation ID.
- Client applications cannot write canonical state directly.
- A later stage cannot be reached without satisfying required predecessor gates.
- Finance, inventory, production, packing and dispatch holds are separate conditions and must not be collapsed into one generic hold.
- Releasing a hold requires explicit authority and audit evidence.
- Physical scans alone do not change customer-visible order status; Central interprets Trace evidence and applies the business consequence.

## Draft and submission rules

- Customer App, WhatsApp, manual entry and API intake create source-attributed drafts.
- Drafts may be corrected without creating a new order identity.
- Submission freezes the submitted commercial snapshot: customer, branch, delivery address, item, variant, pack, quantity, price, tax, MOQ, lead time and terms.
- Later approved amendments create versioned order amendments, not silent overwrites.

## Validation gates

Before acceptance, Central must validate:

- customer and branch eligibility;
- buyer authority;
- product publication and operational availability;
- SKU, pack, carton and MOQ rules;
- price and customer-specific terms;
- tax and delivery requirements;
- duplicate-order risk;
- requested date and lead time;
- payment or credit conditions.

## Partial and split fulfilment

- Partial fulfilment must be explicit and customer-governed where policy requires consent.
- Each fulfilment split receives its own fulfilment identity while retaining the parent order identity.
- Quantities must reconcile exactly across reserved, produced, packed, dispatched, delivered, cancelled and returned quantities.
- A parent order closes only when all lines and fulfilment splits reach terminal reconciliation.

## Amendments and cancellation

- Amendments require a reason and version number.
- Material amendments trigger revalidation and may trigger finance, inventory, production or customer reapproval.
- Cancellation after reservation, production, packing or dispatch must invoke compensating actions rather than deleting records.
- No historical order version may be overwritten or removed.

## Customer-safe projection

Internal states are not exposed directly. Customer App receives a governed projection such as:

- `RECEIVED`
- `UNDER_REVIEW`
- `CONFIRMED`
- `PAYMENT_REQUIRED`
- `PREPARING`
- `PARTIALLY_READY`
- `READY_TO_DISPATCH`
- `DISPATCHED`
- `DELIVERED`
- `ON_HOLD`
- `CANCELLED`

The detailed mapping is frozen separately in Point 13.

## Required identifiers

Every order workflow must preserve:

- `order_id`
- `order_number`
- `order_version`
- `source_type`
- `source_reference`
- `customer_company_id`
- `customer_branch_id`
- `buyer_contact_id`
- `correlation_id`
- `causation_id`
- `command_id`
- `idempotency_key`

## Prohibited patterns

- direct canonical state writes from front ends;
- deleting failed or cancelled orders;
- one generic status field attempting to represent every department state;
- silently replacing ordered SKU, price, quantity or delivery address;
- customer status derived directly from raw scans;
- duplicate live orders created from the same WhatsApp packet or customer submission;
- closing an order while unreconciled quantities remain.

## Implementation consequences

Later execution points must implement:

- command handlers and transition guards;
- immutable order-event history;
- state-specific RBAC;
- idempotent submission and amendment handling;
- quantity reconciliation;
- customer-safe projections;
- automated tests for legal and illegal transitions;
- migration of duplicate legacy order authorities into one Central order service.

## Completion statement

Point 12 freezes the canonical order lifecycle. It does not claim runtime implementation or deployment.

> **POINT 12 — COMPLETE**
