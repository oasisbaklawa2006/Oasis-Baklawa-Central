# WhatsApp Operator Workspace + Decoding Closure

## Physical evidence driving this change

The 16 Aug 2026 physical test established that transport and Core atomic stitching can preserve and stitch inbound WhatsApp fragments, but the operator experience is not release-ready:

- long governance/diagnostic content obscures the primary conversation workflow;
- fixed chrome and nested scrolling make sections partially blocked on narrow/tablet layouts;
- discovery is poor when the operator does not already know sender name/phone;
- reply/composer is not persistently discoverable;
- legitimate fragmented orders with media can remain undecoded even though the raw evidence is preserved;
- engineering concepts (packet, confidence internals, governance slots, observability) dominate the primary operator surface.

This work MUST preserve WA-1..WA-7 fail-closed governance, Core packet mutation authority, immutable evidence, RLS/AAL2/permission checks, and the governed operator reply outbox. It is a presentation + interpretation closure, not an authority rewrite.

## Required operator information architecture

### Desktop/tablet
Three operational zones:

1. **Inbox queue** — newest/unread/unanswered first, sender or Unknown, phone, message preview, timestamp, unread/unanswered marker, fragment/media count, potential-order/clarification state. Search must match sender, phone, message text/preview and decoded product/order hints. Unknown senders remain discoverable without knowing their identity.
2. **Conversation** — chronological WhatsApp-like message timeline with text and media evidence/status. This is the dominant pane. Conversation header remains visible.
3. **Order Intelligence** — compact secondary/collapsible panel. Show actionable extracted client/product/quantity/address/payment state first. Confidence/provenance/governance/audit details belong under expandable details.

### Narrow/mobile
Do NOT stack the full three-zone desktop UI into one enormous page. Use a list -> conversation flow. Selecting a conversation prioritizes the thread. Order Intelligence opens as a secondary drawer/panel. Provide an obvious Back to inbox action.

## Composer invariant

When a conversation is selected, the governed reply composer must remain visible/sticky at the bottom of the conversation viewport on every supported breakpoint. It must not be displaced by insights, diagnostics, filters, bottom navigation, or fixed app chrome. Existing `wa.reply.send`, governed-context, AAL2 and outbox fail-closed gates remain authoritative.

## Progressive disclosure

The following are secondary and collapsed by default in the operator workflow:

- observability;
- keyboard/export help;
- local AI preview;
- operational event feed;
- confidence/provenance internals;
- governance slot explanations;
- raw audit/diagnostic panels.

They remain reachable for supervisors/audit but must not block reading or replying.

## Interpretation contract

A fragmented physical order is interpreted across the complete selected packet, not one arbitrary fragment. Media evidence is part of the packet context.

The decoder must:

- preserve every inbound fragment and provider identity;
- use the packet's chronological stitched text plus packet-scoped media/evidence state;
- identify products/quantities only when supported;
- never default/invent a missing product, unit or quantity;
- distinguish ordinary conversational numbers from quantities;
- show unresolved fields explicitly and make them human-correctable;
- present one coherent potential-order draft for one packet;
- never create a live Sales Order merely from interpretation;
- retain evidence/provenance for each extracted field.

## Golden physical acceptance case

The 16 Aug physical scenario becomes a release regression gate:

1. customer sends six inbound fragments in a burst, including two photos;
2. six provider messages are preserved;
3. one governed conversation/packet contains all six in chronological order;
4. two media items are visibly accounted for with processing/unreadable/available state;
5. interpretation runs over the whole packet;
6. supported client/product/quantity facts are extracted;
7. unsupported facts are `unresolved`, never invented;
8. operator can correct/confirm the draft without creating a live SO;
9. composer is visible without traversing diagnostics;
10. operator sends one reply;
11. exactly one governed outbox row is accepted;
12. exactly one provider send/callback is recorded.

Any missing fragment, hidden media, invented field, inaccessible composer, duplicate reply, or silent interpretation failure fails certification.

## Implementation constraints

- Central owns operator UX and interpretation presentation only.
- Core remains packet/data authority.
- No weakening RLS, audit immutability, permissions, AAL2, idempotency, evidence isolation or CI.
- No production data/history rewrite.
- Existing Stage-1/WA guardrails must pass unmodified.
- Add focused tests for narrow layout composer visibility, unknown-sender discovery, packet-wide interpretation, media accounting, and the golden physical case.
