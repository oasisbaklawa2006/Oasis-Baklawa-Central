# App-Verse Point 17 — Shared Company, Branch and Contact Hierarchy

**Status:** COMPLETE  
**Truth classification:** DOCUMENTED only

## Canonical hierarchy

The shared business hierarchy is:

`company -> branch/location -> contact/person -> membership/role assignment`

A company is the legal or trading customer entity. A branch/location is an operational buying, billing, shipping or service location belonging to that company. A contact is a human person. A membership links a contact to one company and, where applicable, one or more branches with scoped permissions.

## Canonical entities

### Company

Required identity and governance fields include:

- immutable `company_id`;
- legal name and trading name;
- tax and registration identifiers where applicable;
- customer classification and lifecycle status;
- billing defaults, credit relationship and commercial ownership references;
- parent-company relationship where applicable;
- canonical audit timestamps and actor references.

### Branch or location

Required fields include:

- immutable `branch_id`;
- owning `company_id`;
- branch name and branch type;
- billing, shipping, retail, warehouse, office or franchise purpose;
- structured address and service-region data;
- active/inactive status;
- default delivery, invoicing and contact references.

A branch cannot exist without a company owner.

### Contact

Required fields include:

- immutable `contact_id`;
- canonical name;
- verified and unverified communication channels kept distinct;
- lifecycle status;
- preferred language and communication preference;
- duplicate-resolution and merge history.

A contact is not itself a company and must not be used as the customer-account primary key.

### Membership

Membership is the governed relationship between a contact and company/branch scope. It records:

- `membership_id`;
- `contact_id` and `company_id`;
- optional branch scope;
- role/capability assignment;
- invitation, approval, active, suspended or revoked status;
- effective dates and audit evidence.

The same person may hold different memberships for different companies or branches.

## Authority boundaries

- Supabase Core owns the shared schema, constraints, RLS and shared RPC contracts.
- Central owns operational CRM stewardship and authoritative commercial consequences.
- Customer App may read and request governed changes only through customer-safe contracts.
- AI Studio may consume company/customer segmentation for publication rules but does not own customer hierarchy.
- Trace may reference company/branch/location identities for evidence but does not edit CRM truth.

## Invariants

1. IDs are immutable UUIDs and never reused.
2. Names, phone numbers and email addresses are attributes, not identity keys.
3. One contact may belong to multiple companies only through separate memberships.
4. Branch access never implies company-wide access unless explicitly granted.
5. Billing and shipping locations remain distinct even when their addresses match.
6. Deactivation preserves history; operational records are never orphaned by hard deletion.
7. Merges preserve aliases, source evidence and audit lineage.
8. Customer users can only see companies and branches within approved memberships.
9. Staff access is capability- and scope-based, not inferred from UI routes.
10. Shared schema changes must originate in or be reconciled into Supabase Core.

## Duplicate and merge handling

Potential duplicates are detected using normalized names, tax IDs, phone numbers, email addresses and addresses, but no automatic destructive merge is allowed. A governed merge must nominate a surviving identity, migrate memberships and references, preserve aliases, record before/after evidence and remain reversible through audit reconstruction.

## Status and lifecycle

Company, branch, contact and membership records use explicit lifecycle states such as draft, pending verification, active, suspended, inactive, merged and archived. Authentication status and commercial approval status remain separate.

## Acceptance record

- `17a` Company model frozen — COMPLETE
- `17b` Branch/location model frozen — COMPLETE
- `17c` Contact model frozen — COMPLETE
- `17d` Membership and scope model frozen — COMPLETE
- `17e` Authority boundaries frozen — COMPLETE
- `17f` Identity and deletion invariants frozen — COMPLETE
- `17g` Duplicate/merge rules frozen — COMPLETE
- `17h` Customer-safe access boundary frozen — COMPLETE

> **POINT 17 — COMPLETE**

## Implementation limitation

This document does not claim that the shared tables, RLS, RPCs, migrations, reconciliation jobs or UAT are implemented. Those require later coded, migrated, tested, deployed and runtime-verified work.