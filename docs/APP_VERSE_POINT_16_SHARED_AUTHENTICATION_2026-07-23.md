# App-Verse Point 16 — Shared Authentication

**Status:** COMPLETE  
**Truth classification:** Governance/documentation freeze only  
**Runtime implementation:** Not completed by this point

## Objective

Define one canonical authentication model across Customer App, Central, AI Studio, Trace and Supabase Core so that identity, session, recovery, suspension and environment boundaries are consistent and enforceable.

## 16a — Canonical authentication authority

Supabase Auth is the canonical authentication authority for human users. Supabase Core owns shared authentication schema extensions, policies, hooks, RPCs, Edge Functions and cross-app contracts.

Applications may own presentation and workflow, but may not create competing user-password stores, independent session authorities or incompatible identity records.

## 16b — Identity classes

The canonical identity classes are:

- internal staff user;
- customer-company user;
- service identity;
- device identity;
- temporary invitation or onboarding identity;
- suspended or retired identity.

A person, company contact, application login and device remain separate entities linked by immutable identifiers.

## 16c — Staff authentication

Internal staff access must use governed authentication with verified identity, active employment/engagement state, assigned role and valid company/branch/department scope.

Authentication proves identity only. Authorization remains governed by the shared role-and-permission model.

## 16d — Customer authentication

Customer App access must distinguish:

- invited/pending user;
- verified user awaiting buyer approval;
- approved buyer;
- company owner or branch administrator;
- accounts-only user;
- read-only user;
- suspended user.

A successful login does not automatically grant catalogue pricing, order submission, account or document access.

## 16e — Authentication methods

Allowed methods may include:

- email magic link or OTP;
- phone OTP through an approved provider;
- password where explicitly enabled;
- approved OAuth providers;
- service-to-service credentials for backend workloads only.

Each enabled method requires environment-specific redirect, expiry, abuse-prevention and recovery controls.

## 16f — Session model

Sessions must be:

- environment-bound;
- application-aware;
- revocable;
- time-limited;
- refreshed only through approved SDK/server flows;
- validated server-side for protected operations;
- unable to cross production and non-production boundaries.

Frontend possession of a token is not sufficient authority for privileged operations.

## 16g — Token validation

Protected backend operations must validate, as applicable:

- token signature;
- issuer;
- audience;
- expiry;
- authenticated user ID;
- session validity;
- account status;
- role and scope;
- step-up status for sensitive actions;
- device binding where required.

Service-role credentials must never be exposed to browser, mobile or handheld clients.

## 16h — Redirect and deep-link governance

Authentication redirects and mobile deep links must be allow-listed by environment and application.

Preview, development, staging and production callback URLs must remain distinct. Wildcard production redirects are prohibited unless explicitly justified and security-reviewed.

## 16i — Account linking and duplicate identity prevention

Email, phone and OAuth identities may link to one canonical user only through controlled reconciliation.

The system must prevent:

- duplicate users for the same verified identity;
- accidental linking across different people;
- customer-company access inherited from an unrelated contact;
- silent reassignment of historical audit records.

Merges preserve aliases, source evidence and prior audit attribution.

## 16j — Invitations and onboarding

Invitations must carry:

- intended company and branch;
- proposed role;
- inviter identity;
- expiry;
- single-use or governed replay protection;
- approval state;
- audit evidence.

Accepting an invitation must not bypass buyer approval, employment verification or role-separation rules.

## 16k — Recovery and credential changes

Password reset, phone change, email change, MFA reset and account recovery are security-sensitive actions.

They require:

- verified recovery channel;
- audit event;
- session revocation where appropriate;
- notification to the affected user;
- step-up or administrative approval for high-risk changes;
- no disclosure of whether unrelated accounts exist.

## 16l — Suspension, offboarding and revocation

Suspension or offboarding must revoke or invalidate active access without deleting historical identity or audit evidence.

The system must support:

- immediate session revocation;
- role and scope removal;
- device de-authorisation;
- service-key rotation;
- preservation of prior actions;
- controlled reactivation.

## 16m — Device and handheld authentication

Trace handhelds, shared operational devices and Smart TV surfaces must not rely on unrestricted personal sessions.

They require purpose-specific controls such as:

- registered device identity;
- operator sign-in or handover;
- location/task binding;
- short session lifetime;
- remote revocation;
- offline credential limits;
- no service-role secret embedded in the application.

## 16n — Service identities

Service-to-service calls must use dedicated, least-privilege identities or signed requests. Shared human accounts and browser-visible service keys are prohibited.

Every service identity must have an owner, purpose, environment, rotation policy and audit trail.

## 16o — Environment isolation

Users, sessions, secrets, redirect URLs and service identities must be isolated between local, development, preview, staging, UAT, production and disaster-recovery environments.

Production authentication data must not be copied into lower environments without an approved, minimised and anonymised process.

## 16p — Security controls

Authentication controls must include, according to risk:

- rate limiting;
- OTP abuse protection;
- bot and credential-stuffing resistance;
- secure cookie/storage behaviour;
- replay prevention;
- session fixation prevention;
- MFA or step-up authentication;
- anomaly monitoring;
- alerting for sensitive changes.

## 16q — Application responsibilities

### Customer App
Owns customer-facing sign-in, onboarding, approval-state presentation, recovery UX and safe session handling.

### Central
Owns staff operational entry points and consumes canonical identity, role and scope contracts.

### AI Studio
Consumes canonical staff identity and editorial permissions; it may not maintain independent authority.

### Trace
Consumes canonical operator identity plus governed device identity and offline-session rules.

### Supabase Core
Owns shared auth contracts, policies, backend validation helpers, identity extensions and environment configuration standards.

## 16r — Prohibited patterns

The following are prohibited:

- separate password databases per application;
- frontend use of service-role credentials;
- treating authentication as authorization;
- trusting unverified JWT claims supplied by a client;
- production wildcard redirects without review;
- silent account merging;
- deleting users to hide historical activity;
- shared staff accounts;
- permanent handheld login without operator attribution;
- allowing preview applications to authenticate against production by default.

## 16s — Implementation consequences

Later implementation work must:

- reconcile existing auth flows across all repositories;
- consolidate shared claims and profile extensions in Supabase Core;
- enforce server-side authorization;
- implement revocation and recovery controls;
- test deep links, redirects, mobile persistence and offline devices;
- prove environment isolation;
- remove competing or unsafe authentication paths.

## Completion statement

Point 16 freezes the canonical shared-authentication model. It does not claim that all applications have already been migrated or runtime-verified against it.

> **POINT 16 — COMPLETE**
