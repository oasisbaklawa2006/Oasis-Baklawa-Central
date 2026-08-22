# App-Verse Point 14 — Canonical Environment Matrix

**Date:** 2026-07-23  
**Status:** DOCUMENTED GOVERNANCE FREEZE  
**Runtime implementation:** NOT CLAIMED

## 1. Purpose

This document freezes the authoritative environment model for the Oasis App-Verse across Customer App, Central, AI Studio, Trace and Supabase Core.

The goal is to prevent environment drift, accidental production writes, preview systems acting as authority, secret leakage, production data misuse, and deployments that cannot be traced to an exact source revision.

## 2. Environment classes

| Environment | Purpose | Production authority | Production data allowed | External side effects |
|---|---|---:|---:|---|
| Local development | Individual development and isolated testing | No | No | Disabled or sandbox-only |
| Shared development | Team integration and early schema validation | No | Synthetic or masked only | Sandbox-only |
| Pull-request preview | Visual and functional review of one exact branch/SHA | No | No | Disabled or sandbox-only |
| Staging | Production-like integration validation | No | Masked/synthetic only unless explicitly approved | Sandbox/test tenants only |
| UAT | Controlled business acceptance | No | Curated test data; no unrestricted production clone | Explicitly approved test side effects only |
| Production | Live customer and operational authority | Yes | Yes | Live integrations allowed |
| Disaster recovery | Recovery target for production continuity | Conditional, only during declared failover | Replicated production data | Live only during declared failover |
| Offline device cache | Temporary task-bound operational continuity | No independent authority | Minimum encrypted task data only | Queued and reconciled on reconnect |

## 3. Application mapping

Each of the five applications must have explicit environment bindings.

### Customer App

- local/preview must use non-production customer accounts and non-live order submission;
- staging/UAT must expose only customer-safe projections;
- production is the only environment allowed to create real buyer-facing orders and support requests;
- preview builds must never be linked from production customer communications.

### Central

- local/preview cannot create or mutate real orders, payments, inventory, production jobs, dispatches or gate releases;
- staging/UAT must use synthetic or explicitly curated business scenarios;
- production is the only operational command authority;
- demo and projection-only interfaces must remain visibly non-authoritative.

### AI Studio

- non-production may create draft products, media and catalogue simulations only;
- only production-approved publication flows may publish live operational or customer-safe product projections;
- non-production AI output may not silently overwrite production product truth.

### Trace

- local/preview scans must use test identity namespaces;
- staging/UAT labels and barcodes must be visually and technically distinguishable from production labels;
- only production may create live physical movement evidence;
- offline scan queues remain bound to the originating environment and may never cross-promote.

### Supabase Core

- owns the authoritative mapping of project IDs, schemas, RLS, RPCs, Edge Functions, storage and secrets per environment;
- production credentials may never be used by local, preview, staging or UAT clients;
- environment promotion must be migration-led and contract-led, never manual drift.

## 4. Canonical environment bindings

Every deployable application must declare at minimum:

- environment name;
- exact Git commit SHA;
- deployment provider and deployment ID;
- Supabase project ID;
- API base URLs;
- storage bucket namespace;
- realtime channel namespace;
- auth redirect origins;
- integration mode: disabled, sandbox or live;
- feature-flag source;
- release owner;
- deployment timestamp;
- rollback target.

No deployment is accepted as governed without this evidence.

## 5. Supabase project separation

The canonical target model is separate Supabase projects for:

1. development;
2. staging/UAT, where practical;
3. production;
4. disaster recovery or tested recovery capability.

Where an interim shared project exists, isolation must be enforced through explicit schema, tenant, RLS, storage and integration controls and recorded as temporary technical debt.

Production remains project `tcxvcatsqqertcnycuop` unless superseded by a separately approved migration record.

## 6. Data classification by environment

| Data class | Local/Preview | Staging/UAT | Production |
|---|---|---|---|
| Public catalogue data | Synthetic or copied approved public subset | Approved public subset | Live |
| Customer PII | Prohibited | Masked or curated test identities | Live, governed |
| Payment and bank data | Prohibited | Synthetic only | Live, restricted |
| Internal HR/user data | Prohibited | Synthetic/minimal | Live, role-restricted |
| Inventory and production | Synthetic | Curated scenarios | Live authority |
| Trace scan evidence | Test namespace only | Test namespace only | Live immutable evidence |
| Audit and security logs | Local/test only | Test only | Live governed retention |
| Secrets | Environment-specific only | Environment-specific only | Production-only secrets |

Production data must not be copied into lower environments without explicit approval, masking, minimisation and audit evidence.

## 7. Secret management

- secrets must live in the environment’s managed secret store;
- `.env` files containing secrets must not be committed;
- frontend bundles may receive only explicitly public/publishable values;
- service-role, provider API and signing secrets remain server-side;
- every secret has an owner, purpose, environment, rotation date and revocation path;
- rotated secrets must be runtime-tested before closure;
- secret names may be consistent across environments, but values must differ;
- production secrets must never be reused in preview, staging or local systems.

## 8. Integration matrix

| Integration | Local/Preview | Staging/UAT | Production |
|---|---|---|---|
| Resend email | Disabled or test recipient allow-list | Sandbox/allow-list | Live |
| WhatsApp provider | Disabled/mock | Sandbox/test number | Live governed intake |
| Payment/banking | Mock only | Sandbox only | Live |
| AI providers | Test keys/limited quota | Non-production keys | Production keys |
| Barcode/label printers | Simulator/test device | Test-labelled devices | Governed production devices |
| Push/SMS/OTP | Test recipients | Allow-list | Live |
| Vercel deployment | Preview | Staging/UAT project or protected alias | Production project/domain |

No non-production environment may contact unrestricted real customers.

## 9. Authentication and redirect controls

- each environment has explicit allowed origins and redirect URLs;
- production auth sessions must not be accepted by non-production applications;
- OAuth, OTP and magic-link callbacks must be environment-bound;
- mobile bundle identifiers and deep links must distinguish preview/UAT from production where supported;
- test users must be visibly marked and prevented from obtaining production authority.

## 10. Storage and media controls

- storage buckets or prefixes must be environment-isolated;
- test uploads must never appear in the production catalogue;
- signed URL policies must be environment-specific;
- lower-environment data must have shorter retention where practical;
- production media publication requires approved product/publication authority.

## 11. Feature flags

Feature flags must include:

- environment scope;
- audience or tenant scope;
- owner;
- expiry/review date;
- default safe state;
- audit history;
- rollback behaviour.

A preview-only or experimental feature must not become production authority merely because its UI is visible.

## 12. Migration and promotion rules

Promotion order:

1. migration and contract authored in the authoritative repository;
2. static validation and CI;
3. development apply/test;
4. staging/UAT apply/test;
5. backup and rollback confirmation;
6. production approval;
7. production apply;
8. runtime verification;
9. deployment evidence recorded.

Manual production schema edits are prohibited except declared emergency repair with immediate backfill into authoritative migrations.

## 13. Exact-SHA deployment rule

Every environment deployment must resolve to an immutable Git SHA.

Branch names, local folders, screenshots or Vercel project names are insufficient evidence.

Production acceptance requires:

- exact SHA;
- successful required checks;
- approved change record or PR;
- matching migration state;
- deployment ID;
- smoke test;
- rollback target.

## 14. Preview and demo safety

Preview, demo and projection-only environments must:

- display an unmistakable environment badge;
- disable or sandbox irreversible actions;
- avoid production secrets;
- avoid real customer notifications;
- avoid production-grade labels/barcodes;
- never represent themselves as operational authority;
- expire or be removed when no longer needed.

## 15. Offline device environment binding

Every offline-capable device record must include:

- environment ID;
- device ID;
- user identity;
- location/department scope;
- app version and build SHA;
- queue sequence;
- last sync time.

A queue created in one environment must be rejected by every other environment.

## 16. Disaster recovery

Production recovery readiness must include:

- documented recovery owner;
- backup scope and frequency;
- tested restore procedure;
- RPO and RTO targets;
- secret and integration failover plan;
- DNS/domain and mobile endpoint switching plan;
- data-integrity verification;
- declared activation and deactivation records.

A DR system is not operational authority until an authorised failover is declared.

## 17. Environment observability

Logs and alerts must identify:

- environment;
- application;
- deployment SHA;
- request/correlation ID;
- tenant/company where permitted;
- device where relevant;
- integration mode;
- error classification.

Production alerts must not be diluted by preview/test noise.

## 18. Environment promotion gates

A release cannot promote when any of the following apply:

- unknown source SHA;
- failing required checks;
- unapplied or drifted migrations;
- production secret used outside production;
- unresolved critical security issue;
- missing rollback target;
- unverified customer-safe projection;
- unrestricted live integration enabled in non-production;
- demo data or test labels indistinguishable from production;
- required business UAT not completed.

## 19. Ownership

- Supabase Core owns environment backend contracts, migration authority and shared secret conventions.
- Each application repository owns its environment configuration, build and deployment evidence.
- Central owns operational UAT acceptance.
- AI Studio owns publication UAT.
- Trace owns device, label and scan-environment separation.
- Customer App owns buyer-facing environment safety and production-domain acceptance.

## 20. Implementation consequences

This point freezes the target model only.

Implementation remains required under later points, including environment creation, CI controls, secret inventories, exact-SHA checks, migration validation, protected deployments, backup/restore tests and runtime UAT.

## 21. Completion record

Point 14 is complete as an architecture/governance freeze because:

- environment classes are defined;
- application bindings are defined;
- data and secret boundaries are defined;
- integration modes are defined;
- promotion and rollback gates are defined;
- exact-SHA evidence is required;
- preview, offline and DR rules are defined;
- implementation is explicitly not misrepresented as completed.

> **POINT 14 — COMPLETE**

## 22. Addendum (2026-08-21): Lane 2 certification environment clarification

This addendum is a governance clarification, not a migration, and does not
reopen or amend §§1–21 above.

- The sole persistent/canonical Supabase authority remains `tcxvcatsqqertcnycuop`,
  as stated in §5. No second persistent Supabase project is authorised.
- No certified staging/UAT Supabase project is currently named or approved
  under this point. §5's "staging/UAT, where practical" target model
  remains an unfulfilled aspiration, not a live binding.
- A historical, informal reference (`aruyieslaxjhnamlstpx`), used in ad hoc
  engineering sessions on 2026-05-30 before this point existed, was
  discovered embedded in Central's Lane 2 (P&A) certification harness
  (`tests/lane2-pna-e2e-chain.spec.ts`, `.github/workflows/lane2-pna-staging-proof.yml`,
  `docs/LANE2_PNA_STAGING_FIXTURE.md`) as though it were an approved
  staging environment. It was not, and the appearance of a project
  reference in code, comments, or old session reports does not by itself
  confer governance authorisation. That harness has been corrected to
  remove the false authority claim and fail closed instead (see the
  referenced files' current state).
- Any future temporary or disposable certification environment (CI-provisioned,
  ephemeral, or otherwise) requires explicit governance approval and a
  named record here or in a successor point before code may treat it as
  authorised. Until then, mutating certification proofs that need a real
  backend remain deferred.
- Temporary CI infrastructure used for a certification run must never
  become, by drift or convenience, an independent migration authority or a
  persistent business environment. Any disposable instance must be
  provisioned from the canonical Core migration lineage and destroyed
  after use — it does not accrue standing as a second environment merely
  by having existed.
