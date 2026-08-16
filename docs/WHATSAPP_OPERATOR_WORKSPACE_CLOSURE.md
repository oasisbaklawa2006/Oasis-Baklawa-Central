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

When a conversation is selected, the governed reply composer must remain visible/sticky at the bottom of the conversation viewport on every supported breakpoint. It must not be displaced by insights, diagnostics, filters, bottom navigation, fixed app chrome. Existing `wa.reply.send`, governed-context, AAL2 and outbox fail-closed gates remain authoritative.

Visibility alone is insufficient. The composer textarea/input and Send control must remain unobscured, keyboard-focusable and reachable after viewport resizing and when the mobile virtual keyboard reduces the visual viewport. Focus must not scroll the composer behind fixed application chrome, and the operator must be able to enter text and activate Send without dismissing governance or diagnostic panels first. Focus/reachability tests must preserve the existing permission, governed-context, AAL2 and outbox fail-closed behavior rather than bypass it.

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

A fragmented physical order is interpreted across the complete **selected packet**, not one arbitrary fragment. Media evidence is part of that packet context.

Packet selection is explicit and fail-closed. The inbox/conversation may contain several packets for the same contact; selecting a packet establishes the sole interpretation boundary. The active packet ID must drive its timeline, extraction request key, evidence/media lookup and potential-order draft. Text, media, evidence, resolution results or corrections belonging to any other packet must not enter the selected packet's decoder context. If packet ownership is ambiguous or unavailable, interpretation remains unresolved rather than combining packets. One selected packet produces at most one coherent potential-order draft; switching packets switches the entire interpretation/evidence context atomically.

The decoder must:

- preserve every inbound fragment and provider identity;
- use only the selected packet's chronological stitched text plus packet-scoped media/evidence state;
- identify products/quantities only when supported;
- never default/invent a missing product, unit or quantity;
- distinguish ordinary conversational numbers from quantities;
- show unresolved fields explicitly and make them human-correctable;
- present one coherent potential-order draft for one selected packet;
- never create a live Sales Order merely from interpretation;
- retain immutable evidence/provenance for each extracted field.

Human correction must never overwrite the original extraction or its evidence link. The original extracted value, confidence/provenance and supporting evidence remain immutable. A confirmation/correction is stored as a separate operator decision containing the packet/field identity, original extraction reference, operator actor, decision timestamp, corrected/confirmed value and resulting effective value. Subsequent corrections append another decision rather than rewriting history. The UI may show the latest effective value, but audit/provenance must be able to reconstruct the original extraction and every operator decision.

## Golden physical acceptance case

The 16 Aug physical scenario becomes a release regression gate:

1. customer sends six inbound fragments in a burst, including two photos;
2. the fixture declares six distinct expected provider message identities; each exact identity is preserved once and only once;
3. every expected provider identity belongs to exactly one governed packet membership, with no duplicate membership and no missing/replaced identity;
4. the selected governed packet contains those exact six identities in stable chronological/packet-sequence order, even when the test supplies rows in shuffled input order;
5. the two media fragments have two distinct provider/evidence identities and are visibly accounted for with processing/unreadable/available state;
6. interpretation runs over the whole selected packet and excludes text/media/evidence from neighbouring packets for the same contact;
7. supported client/product/quantity facts are extracted;
8. unsupported facts are `unresolved`, never invented;
9. operator correction/confirmation preserves the immutable original extraction/evidence and appends actor/time/effective-value decision provenance without creating a live SO;
10. composer, input and Send control remain visible, unobscured, focusable and reachable without traversing diagnostics, including narrow viewport and virtual-keyboard viewport reduction;
11. operator sends one reply;
12. exactly one governed outbox row is accepted;
13. exactly one provider send/callback is recorded.

Any missing/replaced/duplicate provider identity, cross-packet evidence leakage, hidden media, invented field, overwritten provenance, inaccessible composer, duplicate reply, or silent interpretation failure fails certification.

## Implementation constraints

- Central owns operator UX and interpretation presentation only.
- Core remains packet/data authority.
- No weakening RLS, audit immutability, permissions, AAL2, idempotency, evidence isolation or CI.
- No production data/history rewrite.
- Existing Stage-1/WA guardrails must pass unmodified.
- Add focused tests for composer visibility/focus/reachability including virtual-keyboard viewport reduction, unknown-sender discovery, selected-packet isolation, packet-wide chronological interpretation from shuffled input, immutable correction provenance, media accounting, exact provider-identity deduplication, and the golden physical case.
