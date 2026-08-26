# Factory Operations Autonomous Certification Runbook

Status: **HARNESS IMPLEMENTATION IN PROGRESS — NOT PRODUCTION CERTIFICATION**

This runbook covers the dedicated Factory Operations certification harness in PR #405. It does not authorize production mutation, production credentials in branch-controlled previews, or a persistent second Supabase project.

## Safety boundary

Credentialed Factory certification accepts `localhost` / `127.0.0.1` by default. A remote disposable target must be explicitly allowlisted with an exact host and a non-empty environment identifier. `*.vercel.app`, `b2b.oasisbaklawa.com`, and the known production Vercel hostname are rejected by the harness.

No service-role key is consumed by the Playwright tests. Backend reads use the same authenticated user's bearer token plus the disposable environment's anon key, so RLS remains part of the proof.

Traces, screenshots, and videos are disabled in `playwright.factory-cert.config.ts` to reduce credential leakage risk.

## Required environment

Application target:

```bash
export FACTORY_CERT_TARGET_URL=http://127.0.0.1:4173
```

Disposable/local Supabase backend:

```bash
export FACTORY_CERT_SUPABASE_URL=http://127.0.0.1:54321
export FACTORY_CERT_SUPABASE_ANON_KEY='<local anon key>'
```

For an explicitly approved remote disposable environment only:

```bash
export FACTORY_CERT_ALLOW_REMOTE_EPHEMERAL=true
export FACTORY_CERT_ENVIRONMENT_ID='factory-cert-<unique-run-id>'
export FACTORY_CERT_ALLOWED_HOST='exact-app-host.example.test'
export FACTORY_CERT_ALLOWED_SUPABASE_HOST='exact-backend-host.example.test'
```

Do not set those variables to a production or branch-preview target.

## Role credentials

Every role uses a distinct environment-variable pair. The variable names are deterministic:

```text
FACTORY_CERT_<ROLE>_EMAIL
FACTORY_CERT_<ROLE>_PASSWORD
```

Examples:

```bash
export FACTORY_CERT_PRODUCTION_MANAGER_EMAIL='...'
export FACTORY_CERT_PRODUCTION_MANAGER_PASSWORD='...'
export FACTORY_CERT_PROD_ARABIC_SWEETS_EMAIL='...'
export FACTORY_CERT_PROD_ARABIC_SWEETS_PASSWORD='...'
export FACTORY_CERT_RGS_ADMIN_EMAIL='...'
export FACTORY_CERT_RGS_ADMIN_PASSWORD='...'
export FACTORY_CERT_GATE_SECURITY_EMAIL='...'
export FACTORY_CERT_GATE_SECURITY_PASSWORD='...'
```

The harness rejects one email being reused for multiple canonical roles. Missing role credentials are reported as `CREDENTIAL_REQUIRED`; they are not converted to PASS.

Before route certification, the harness reads `public.users` through the authenticated user's own RLS session and proves that the database role matches the role being tested.

## Current executable layers

### 1. Route / role / device health

`tests/factory-operations-route-health.cert.spec.ts`

For all `FACTORY_CURRENT` and `LEGACY_REDIRECT` routes from the typed registry:

- selects a canonical certification role;
- requires that role's own credential pair;
- proves the authenticated database role;
- exercises mobile, tablet, desktop, and/or TV viewports according to route metadata;
- requires exact canonical destination / redirect target;
- rejects blank renders, page errors, critical console errors, and horizontal overflow;
- checks that TV surfaces do not expose mutation controls.

### 2. Governed Production source truth

`tests/factory-operations-production-truth.cert.spec.ts`

The expected job set is read directly from `production_jobs` using the same authenticated RLS session. Each production TV must project exactly that job set and the same:

- full job ID;
- canonical department;
- status;
- priority;
- assigned quantity;
- produced quantity.

The certification environment must contain at least one open job for every tested Production TV department; zero/zero parity is rejected.

For Arabic Sweets, the default controlled golden short ID is `E3ED28B0`. Override only for a deliberately reseeded certification fixture:

```bash
export FACTORY_CERT_GOLDEN_JOB_SHORT_ID=E3ED28B0
```

### 3. Read-failure injection

`tests/factory-operations-failure-injection.cert.spec.ts`

Browser request interception proves that:

- failed `production_jobs` reads produce the Production TV error state, not `No Open Production Jobs`;
- failed `inventory_reservations` reads produce the Demand Planner error state, not a false zero-shortage state.

No database mutation is used for these failure scenarios.

## Run command

```bash
npx playwright test -c playwright.factory-cert.config.ts
```

The JSON execution report is written to:

```text
factory-certification-results.json
```

A test that cannot run because the disposable environment or exact role credential is absent must remain skipped with `CERTIFICATION_ENV_REQUIRED` or `CREDENTIAL_REQUIRED` in its annotation/output.

## Still pending before Factory Operations can be called certified

The following remain separate implementation/execution gates:

- deterministic ephemeral Supabase reset/reseed orchestration using canonical `oasis-supabase-core` migrations;
- disposable test-user creation for every required implemented role;
- controlled RGS, P&A, 3PGS, Dispatch and Gate source-truth fixtures;
- mutation/action-result certification in the disposable environment;
- RGS Production-to-RGS receipt/accept/pick/issue/acknowledge golden workflow;
- P&A -> 3PGS shortage -> fulfilment -> P&A resume golden workflow;
- Dispatch/Gate/Trace mutation chain;
- physical wall-TV / scanner / printer / kiosk UAT.

Production remains read-only and is not an allowed substitute for the disposable mutation-certification environment.
