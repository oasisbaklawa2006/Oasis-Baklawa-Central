# WhatsApp Current-Head Forensic Gap Matrix

**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Audited main head:** `68d53e2c1ff672e0b55166e727edf4f0cb6e1cf1`  
**Acceptance authority:** `docs/WHATSAPP_CANONICAL_INTENT_AND_ZERO_LOSS_GOVERNANCE.md` and `docs/WHATSAPP_B2B_DOMAIN_BOUNDARY_AND_APP_PLACEMENT.md`  
**Scope:** Current B2B WhatsApp intake, interpretation, clarification, order-draft, reply, routing, observability, and zero-loss controls.

## Executive verdict

The current build is a strong, reusable foundation, but it does **not yet satisfy the canonical B2B intent end to end**.

The operator inbox now contains sender, client, product, quantity, draft-extraction, and Sales Order Draft surfaces. The webhook also contains broad intent classification and a clarification-hold concept. However, the programme still has two strategically dangerous characteristics:

1. **Multiple overlapping order-creation paths still exist.** The webhook retains direct `orders` / `order_items` mutation logic in addition to the governed Sales Order Draft path.
2. **Zero silent order loss is not yet a first-class invariant.** There is no proven universal intake ledger, mandatory owner, explicit disposition for every order-like packet, or reconciliation equation enforced across all ingress paths.

Therefore, implementation should begin with **zero-loss observability and authoritative-path enforcement**, not with more AI parsing sophistication.

## Classification legend

- **EXACT** — satisfies the canonical rule materially as built.
- **PARTIAL** — useful foundation, but incomplete or inconsistent.
- **MISSING** — canonical capability not present as a governed end-to-end feature.
- **CONTRADICTORY** — current behaviour conflicts with the canonical intent.
- **UNSAFE** — can create confidentiality, order-loss, authority, or operational risk.
- **OBSOLETE / DUPLICATE** — overlapping path that should be retired or isolated.
- **REUSABLE** — should be retained and extended.

## Gap matrix

| Canonical requirement | Current-head evidence | Classification | Required action |
|---|---|---|---|
| One B2B number, one B2B domain, Central as runtime owner | Canonical documents merged to `main`; webhook uses B2B portal URL and B2B parser context | EXACT / REUSABLE | Add a fixed server-side `business_domain = B2B` invariant to ingress and downstream records; never trust caller-supplied domain. |
| Raw inbound capture remains durable | `whatsapp-webhook`, `whatsapp_messages`, packet layer, and inbox read path exist | PARTIAL / REUSABLE | Prove every supported provider payload creates a durable raw message before any parsing or routing; add ingestion-failure reconciliation. |
| No potential order may disappear | Inbox has failed-message and observability panels, but there is no universal potential-order intake entity or enforced balancing equation | MISSING / HIGH | Create zero-loss intake ledger or equivalent durable projection; every order-like or unresolved-risk packet must have active disposition, owner, next action, and reconciliation status. |
| Sender, original communicator, and commercial customer are distinct | Inbox now calls sender-identity and client-resolution hooks; webhook still has local `classifySender` and other paths use different identity logic | PARTIAL / HIGH | Persist the identity triad on the authoritative intake/packet; consolidate identity resolution behind one governed service. |
| Employee sender is never treated as buyer | Some draft paths distinguish employee sender; webhook retains staff/client/lead classification and customer-rewiring logic | PARTIAL / UNSAFE | Add a hard server-side invariant: employee submitter cannot become `company_id` solely from sender phone. Require commercial-customer resolution before order readiness. |
| Complete meaning may span multiple messages/media | Message stitcher, packets, chronological rendering, media hints exist | PARTIAL / REUSABLE | Add governed merge/split/supersession state and evidence provenance for every extracted field. Prove idempotent re-stitch behaviour. |
| Multi-intent classification | Webhook includes rules for cancellation, modification, complaint, payment proof, KYC and other intents; inbox has suggestion-only intent/routing | PARTIAL / REUSABLE | Normalize to the canonical intent taxonomy and persist primary + secondary intents on the intake record. Do not force non-order matters into order failures. |
| Clarification is a formal iterative workflow | Webhook contains `needs_clarification`, confidence thresholds, held-order follow-up handling, and confirmation parsing | PARTIAL / CONTRADICTORY | Replace order-row-centric hold logic with a first-class clarification case: unresolved fields, targeted questions, recipient, response, confirmer, audit, follow-up, escalation. |
| Clarification must not create premature commercial output | Webhook can clear a hold on a generic confirm-only response and then calculate totals / send PI or order acknowledgement | UNSAFE / HIGH | Generic “yes/confirm” must resolve only explicitly enumerated questions. Do not promote or send commercial information unless customer, lines, units, packaging, and authority are individually proven. |
| Quantity/unit/packaging must be explicit | Webhook parser defaults unclear quantity to `1`; `parseQuantity` also returns `1` when unmatched; inbox has a newer quantity-resolution layer | CONTRADICTORY / CRITICAL | Remove default-to-1 from executable paths. Unknown quantity/unit must remain unresolved and visible. Only suggestion previews may carry a non-executable placeholder. |
| One authoritative order path | Governed `sales_order_drafts` path exists, while webhook still contains direct `orders` and `order_items` update/insert logic; historical War Room/Central Pool paths also require current-head retirement check | CONTRADICTORY / CRITICAL | Designate `sales_order_drafts` as sole WhatsApp order outcome. Disable or quarantine all direct WhatsApp `orders` / `order_items` writes until explicit promotion. |
| Sales Order Draft and live SO are separate | Sprint-9 Sales Order Draft architecture and inbox hook exist | EXACT / REUSABLE | Preserve. Add stronger source-lineage and zero-loss intake linkage; ensure no legacy path bypasses it. |
| No B2B sensitive information before identity/permission | Webhook price calculation uses product B2B/base/wholesale fields and can send PI/acknowledgement to the inbound phone | UNSAFE / CRITICAL | Before any price, PI, account, payment, credit, or order detail is sent, verify B2B channel, commercial account, authorised contact, and disclosure policy. Employee proxy submissions require a separate recipient decision. |
| Controlled alias learning only from confirmed answers | Product aliases exist; operator/War Room learning paths exist; contextual employee/customer alias governance is not proven | PARTIAL | Introduce contextual alias memory with confirmer, employee/team context, location, conflicts, confidence, and revocation. Never silently mutate master truth. |
| Every potential order has an owner/SLA | Inbox shows ageing and observability, but mandatory persisted assignment and escalation are not proven for all order-like packets | MISSING / HIGH | Add queue/owner/SLA fields and escalation rules. Unassigned beyond threshold must become a control breach. |
| Every packet receives explicit disposition | Current packet status, intent suggestions, draft states and legacy statuses are fragmented | MISSING / HIGH | Define governed dispositions: order, potential order, non-order business, duplicate, irrelevant, unresolved. Closure requires authority and reason. |
| End-of-shift and management reconciliation | Observability exists; no proven equation `received = converted + pending + explicitly closed` | MISSING / CRITICAL | Add reconciliation view/RPC/dashboard and automated invariant test. Primary metric: `unaccounted_potential_orders = 0`. |
| AI/media failure fails open to human visibility | Failed-message panel exists; document parser may return empty result when AI key absent or parsing fails | PARTIAL / HIGH | Every extraction failure must create a visible owned task with raw media/message access and explicit next action. |
| Operator corrections persist as governed truth | Some draft quantity edits are local-state driven; local notes/saved views are stored in localStorage | PARTIAL / UNSAFE | Move business-significant corrections, notes, customer selections, and field confirmations to audited server state. LocalStorage may remain only for personal UI preferences. |
| Audit trail covers intake to closure | Audit tables and interaction logs exist, but prior audits found unwired audit tables and fragmented writes | PARTIAL / HIGH | Add append-only intake audit covering ingest, stitch, identity, interpretation, clarification, assignment, reply, draft, promotion, and closure. |
| Duplicate forwards cannot create duplicate work | WAMID dedup exists in some paths; packet and promotion idempotency have historically been partial | PARTIAL / HIGH | Enforce provider-message idempotency, packet idempotency, intake idempotency, and draft/promotion idempotency with deterministic keys. |

## Critical findings requiring immediate implementation priority

### C1 — Direct WhatsApp order mutation remains in the webhook

The current webhook contains logic that updates `orders`, deletes/reinserts `order_items`, calculates order value and advance, and sends PI/acknowledgement. This conflicts with the canonical architecture in which WhatsApp first creates a durable intake and, only after readiness, a governed Sales Order Draft.

**Required control:** all direct WhatsApp writes to executable order tables must be disabled or isolated behind an explicit feature flag defaulting off. The sole allowed outcome of intake interpretation should be an intake/clarification state or governed `sales_order_drafts` write.

### C2 — Unknown quantity can become quantity 1

The AI prompt instructs the parser to default unclear quantity to 1 with low confidence, and the fallback parser also returns 1 when no quantity pattern matches.

This is unacceptable for live operations. A low-confidence quantity is not a quantity.

**Required control:** represent unresolved quantity as `null` / unresolved state; prevent draft readiness until quantity and unit are confirmed.

### C3 — Commercial information may be sent before sufficient identity authority

The webhook can calculate B2B/wholesale-derived totals and send PI/acknowledgement to the inbound number. In the employee-proxy model, the inbound number may belong to an employee, while in a future wrong-channel case it may not be an authorised B2B contact.

**Required control:** commercial disclosure requires verified B2B domain, verified commercial account, authorised recipient role, and explicit policy decision.

### C4 — Zero-loss reconciliation is not yet enforced

The inbox is rich, but visibility is still a UI property rather than a database invariant. A message can be captured yet remain outside a governed potential-order lifecycle.

**Required control:** create a durable order-intake ledger or authoritative projection where every order-like/unresolved-risk packet is balanced as converted, actively pending, or explicitly closed.

## Strong reusable foundations

The following should be retained:

- `whatsapp_messages` raw-message storage;
- `whatsapp_message_packets` and stitcher foundation;
- Operator Inbox shell, virtualized list, search, ageing and observability components;
- sender identity, client, product and quantity resolution hooks as suggestion layers;
- Sales Order Draft tables, audit log and governed status transitions;
- operator-reply and outbound send hardening already merged;
- feature-flag governance pattern used in the webhook;
- operational event feed and management pulse surfaces.

## Required implementation sequence

### PR 1 — Zero-loss observability and authoritative-path guard

- Add current-head tests proving all WhatsApp direct `orders` / `order_items` paths are disabled by default.
- Add an authoritative potential-order intake projection/table with explicit disposition, owner/queue, next action, SLA, and reconciliation status.
- Surface New, Unassigned, Failed Interpretation, Awaiting Clarification, Ageing, At Risk, Escalated, Converted and Explicitly Closed queues.
- Add reconciliation view/RPC: `potential_received = converted + active_pending + explicitly_closed`.
- Add invariant test: `unaccounted_potential_orders = 0`.

### PR 2 — Persisted identity triad

- Persist submitting sender, original communicator, and commercial customer separately.
- Consolidate sender/customer resolution.
- Prohibit employee phone from becoming the commercial account by inference alone.

### PR 3 — Formal clarification cases

- Persist unresolved fields, questions, recipients, responses, confirmers, and status.
- Remove generic confirmation from resolving unspecified ambiguities.
- Preserve source evidence and all corrections.

### PR 4 — Canonical multi-intent routing

- Persist canonical primary and secondary intents.
- Route non-order business communications to governed tasks/cases.

### PR 5 — Contextual learning

- Add employee/team/location-scoped customer and product shorthand memory.
- Require confirmation evidence and conflict/revocation support.

### PR 6 — Multimodal failure-safe intake

- Add reviewable voice/image/PDF/handwriting extraction.
- Convert every extraction failure into owned visible work.

### PR 7 — SO readiness and disclosure hardening

- Make Sales Order Draft the sole order path.
- Remove executable default quantities.
- Enforce authorised B2B recipient checks before prices, PI, account or payment disclosure.

## Absolute acceptance test

Inject a fragmented employee-submitted order with:

- ambiguous customer abbreviation;
- product shorthand;
- missing quantity unit;
- unreadable attachment;
- later correction;
- duplicate forward.

Even when every AI resolver fails, the system must create one durable intake that is visible, assigned, awaiting targeted clarification, ageing/escalating, present in reconciliation, blocked from SO creation, and linked to all source evidence.

If the intake can disappear, remain ownerless, disclose B2B commercial information prematurely, or create an order with default quantity, the implementation fails.