# WhatsApp Canonical Intent and Zero-Loss Governance

**Status:** Canonical acceptance authority for future WhatsApp work  
**Scope:** Oasis-Baklawa-Central WhatsApp business-intake module  
**Source of truth:** Director-stated operating intent, validated against the real Oasis B2B group workflow

## 1. Purpose

The WhatsApp module is the company-controlled intelligent business-intake system for Oasis Baklawa.

It must capture every business communication, determine who submitted it and whose business it represents, reconstruct the complete meaning across fragmented or multimodal messages, actively obtain missing clarity, learn only from confirmed answers, and route the completed communication into the correct governed workflow.

It is not merely an inbox, chatbot, order parser, or Sales Order screen.

## 2. Highest-order invariant: zero silent order loss

Once a potential order enters any authorised Oasis channel, it must remain durably visible, traceable, owned, and actionable until it reaches one of three legitimate outcomes:

1. converted into a governed order path;
2. actively pending with an explicit next action and owner; or
3. explicitly closed by an authorised user with a recorded reason.

The system may delay execution for lack of clarity, but it may never delay visibility, ownership, or accountability.

### Prohibited outcomes

- hidden because AI confidence is low;
- excluded because customer identity is missing;
- muted because media extraction failed;
- dropped because packet stitching failed;
- left indefinitely unassigned;
- silently closed;
- treated as non-order without a recorded disposition;
- lost between inbound capture, clarification, draft creation, and SO promotion.

### Reconciliation invariant

At every reporting boundary:

`Potential orders received = converted + actively pending + explicitly closed`

Any unmatched intake is a control breach.

## 3. Identity model

Every communication may involve three distinct identities:

1. **Submitting sender** — the person or system that entered or forwarded the message.
2. **Original communicator** — the person who originally wrote, dictated, photographed, or issued the instruction.
3. **Commercial customer** — the customer account whose transaction or business matter is represented.

These identities may be the same, but must never be collapsed automatically.

When the submitting sender is an employee:

- the employee is not the buyer;
- the SO must not be created in the employee's name;
- the underlying customer must be identified before order readiness;
- the system must ask the employee for missing customer information when necessary;
- the employee remains accountable for clarifying the communication they submitted.

## 4. Universal intake sequence

For every inbound communication, the system must resolve:

1. Who submitted it?
2. Is the submitter acting for another person or customer?
3. What is the primary intent?
4. Are there secondary intents?
5. What exactly is being communicated?
6. Who originally authored or issued the instruction?
7. Which commercial customer does it concern?
8. Which facts are confirmed, inferred, missing, ambiguous, contradictory, or not applicable?
9. What clarification is required?
10. Which governed workflow must receive the completed matter?

## 5. Supported communication forms

The module must preserve and process, directly or through a reviewable extraction layer:

- one text message;
- multiple consecutive text messages;
- forwarded messages;
- voice notes;
- photographs;
- photographed handwritten notes;
- PDFs and purchase orders;
- payment screenshots;
- videos;
- captions;
- replies and quoted messages;
- later corrections or revisions.

A media or extraction failure must create visible human work. It must never suppress the intake.

## 6. Packet and conversation model

The correct interpretation unit may be a group of related messages rather than one message.

The system must support:

- automatic packet suggestions based on time, sender, reply links, customer context, continuation language, media captions, and revisions;
- operator merge and split;
- preservation of original chronology;
- source evidence linking each extracted fact to the supporting message or attachment;
- explicit supersession when later instructions revise earlier ones;
- idempotent handling of duplicate forwards.

## 7. Intent taxonomy

The minimum supported top-level intents are:

- `ORDER`
- `ORDER_MODIFICATION`
- `ENQUIRY`
- `COMPLAINT`
- `PAYMENT_ADVICE`
- `ACCOUNT_QUERY`
- `DISPATCH_REQUEST`
- `DISPATCH_STATUS`
- `PRODUCT_SPECIFICATION`
- `CANCELLATION`
- `COMMERCIAL_EXCEPTION`
- `OTHER`

One packet may contain one primary intent and multiple secondary intents. Non-order communication must not be forced into an order-failure state.

## 8. Exact-meaning extraction

The system must extract complete actionable meaning, including where relevant:

- customer and branch;
- product and variant;
- quantity and unit;
- packaging level;
- delivery location;
- requested dispatch or delivery date;
- urgency meaning;
- price or rate request;
- payment reference;
- linked SO, PO, invoice, or complaint;
- special instructions;
- whether the message is new, revised, corrective, confirmatory, or cancelling.

Urgency changes priority. It does not reduce mandatory clarity.

## 9. Clarification engine

Clarification is a first-class workflow, not an error message or optional note.

When information is missing, ambiguous, or contradictory, the system must:

1. identify the exact unresolved fields;
2. generate the smallest necessary set of targeted questions;
3. ask the current message sender or appropriate responsible person;
4. capture and audit the answer;
5. update the interpretation;
6. ask follow-up questions until readiness is achieved or the case is escalated;
7. preserve every question, answer, correction, and confirmer.

Examples of acceptable questions:

- Which customer does “RKG Noida” refer to?
- Does five boxes mean retail boxes or master cartons?
- Is Wednesday the dispatch date or required delivery date?
- Is this a new order or a revision of SO-1234?

“Please clarify” without identifying the missing fact is insufficient.

## 10. Controlled organisational learning

The system may learn from confirmed answers:

- employee-specific customer abbreviations;
- customer nicknames;
- branch and location shorthand;
- product abbreviations;
- packaging shorthand;
- recurring delivery references;
- quantity conventions.

A learned mapping must retain:

- employee or team context;
- geographic or branch context;
- who confirmed it;
- first and last confirmation dates;
- confirmation count;
- confidence;
- conflicts;
- revocation and management correction.

Learning may improve suggestions. It must not silently rewrite Customer Master or Product Master truth.

## 11. Potential-order intake lifecycle

A potential order must create a durable intake record immediately, even when incomplete.

Recommended active states:

- `RECEIVED`
- `POTENTIAL_ORDER`
- `AWAITING_CLASSIFICATION`
- `AWAITING_CUSTOMER`
- `AWAITING_PRODUCT`
- `AWAITING_QUANTITY`
- `AWAITING_OTHER_CLARIFICATION`
- `READY_FOR_OPERATOR_REVIEW`
- `SALES_ORDER_DRAFT_CREATED`
- `CONVERTED_TO_SO`

Permitted terminal dispositions:

- `CANCELLED_BY_CUSTOMER`
- `DUPLICATE_CONFIRMED`
- `CLOSED_NOT_AN_ORDER`
- `REJECTED_WITH_AUTHORISED_REASON`

There must be no silent terminal state.

## 12. Mandatory ownership and escalation

Every potential order must always have either:

- an assigned operator;
- an assigned team queue with an explicit SLA; or
- an escalation owner.

The system must expose and escalate:

- new unacknowledged intakes;
- unassigned potential orders;
- failed interpretations;
- clarification not initiated;
- clarification unanswered;
- urgent or high-value orders ageing beyond SLA;
- unresolved end-of-shift items;
- closures without sufficient reason or authority.

## 13. Order readiness gate

An incomplete communication may remain active and visible, but must not become an executable SO.

Minimum order readiness requires:

- confirmed commercial customer;
- confirmed product lines;
- confirmed quantities and units;
- packaging resolved where required;
- delivery location resolved where required;
- required date or urgency meaning understood;
- commercial exceptions identified and routed for approval;
- original message and clarification lineage preserved.

Sales Order Draft creation and live SO promotion remain separate governed steps.

## 14. Intent-specific routing

After sufficient clarity:

- order → governed Sales Order Draft;
- payment advice → Finance verification;
- complaint → complaint/case workflow;
- enquiry → Sales response task;
- dispatch communication → Operations/Dispatch task;
- account query → Finance/Accounts;
- product specification → Product/Production review;
- cancellation → controlled cancellation workflow.

One intake may create multiple linked work items.

## 15. Operator Inbox requirements

The inbox must expose durable queues for at least:

- New
- Potential Orders
- Unassigned
- Awaiting Clarification
- Failed Interpretation
- Ready for Review
- Ageing
- At Risk
- Escalated
- Converted
- Explicitly Closed

Each item should show:

- complete source packet;
- sender/original-author/customer distinction;
- proposed customer and evidence;
- intent and secondary intents;
- unresolved fields;
- clarification history;
- current owner;
- next action;
- elapsed time and SLA;
- linked draft/SO/task;
- final disposition where closed.

Default filters must never make failed or unresolved order-like communication disappear.

## 16. Management control standard

Management reporting must include:

- potential orders received;
- acknowledged;
- unassigned;
- awaiting clarification;
- failed interpretation;
- ready for draft;
- converted to SO;
- explicitly closed;
- ageing beyond SLA;
- delayed employee submissions;
- closure reasons;
- operator workload;
- unmatched reconciliation items.

The primary control metric is:

`Unaccounted potential orders = 0`

## 17. Customer-channel transition objective

The long-term strategic outcome remains establishment of the official Oasis WhatsApp number as the trusted direct customer channel.

Employee-mediated intake is a transition bridge. Once customer identity and contact authority are sufficiently verified, the official channel should provide confirmations, status, approved payment/account information, and service updates while preserving the responsible employee's relationship role.

The company, not an individual employee, must retain visibility, continuity, and ownership of every commercial interaction.

## 18. Security and fraud-control principles

- no anonymous operational sends;
- no caller-supplied employee identity trusted without authentication;
- no employee may substitute a customer number without governed customer-master controls;
- no personal payment details may be used in approved customer communication;
- no deletion of potential-order intake records;
- no closure without authority and reason;
- immediate access revocation and conversation reassignment on employee exit;
- full audit of sender, assignment, interpretation, clarification, reply, closure, and conversion;
- AI failure must fail open to human visibility, not fail closed into silence.

## 19. Absolute acceptance test

Introduce a difficult, incomplete, fragmented, employee-submitted order with ambiguous customer shorthand and unreadable media.

Even if every AI resolver fails, the system must still:

- capture it;
- identify the employee submitter;
- classify it as order-like or unresolved but at risk;
- keep it visible;
- assign it;
- generate or prompt clarification;
- escalate if unanswered;
- include it in reconciliation;
- prevent premature SO creation;
- preserve the full audit trail.

If the item can disappear, remain unowned, or evade reconciliation, the module fails this specification.
