# Factory Operations Autonomous Certification Runbook

Status: **SOFTWARE EXECUTION EVIDENCE RETAINED — CURRENT HEAD MUST REMAIN GREEN BEFORE MERGE**

This runbook covers the Factory Operations certification harness in PR #405. It does not authorize production mutation, production credentials in branch-controlled previews, or a persistent second Supabase project.

## Safety boundary

Credentialed Factory certification accepts `localhost` / `127.0.0.1` by default. A remote disposable target must be explicitly allowlisted with an exact host and a non-empty environment identifier. `*.vercel.app`, `b2b.oasisbaklawa.com`, the known production Vercel hostname, and the repository's known production Supabase project host are rejected by the harness.

No service-role key is consumed by Playwright. The local bootstrap scripts use the local Supabase service-role key only while creating disposable identities and deterministic fixtures after a canonical Core replay. That key is never written to the role-credential file and the scripts require a canonical `http://` loopback Supabase origin before any service-role request.

Authenticated backend reads in Playwright use the same user's bearer token plus the disposable environment's anon key, so RLS remains part of the proof. Traces, screenshots, and videos are disabled in `playwright.factory-cert.config.ts`.

## Canonical backend authority

Central does not own or copy Supabase migrations for certification. `scripts/factory-certification/start-ephemeral.sh` requires a local checkout of `oasisbaklawa2006/oasis-supabase-core`, then mirrors Core Migration CI's local replay contract:

```bash
supabase start
supabase db reset --local
```

The GitHub certification workflow checks out Core `main` into a temporary subdirectory and uses pinned Supabase CLI `2.101.0`, matching Core Migration CI. Teardown is always `supabase stop --no-backup`.

## Local environment

```bash
export FACTORY_CERT_CORE_REPO=/absolute/path/to/oasis-supabase-core
export FACTORY_CERT_ALLOW_LOCAL_RESET=true
export FACTORY_CERT_CREDENTIAL_FILE=/tmp/oasis-factory-certification.env
bash scripts/factory-certification/start-ephemeral.sh
```

The start script:

1. replays canonical Core from zero;
2. obtains only local Supabase API/anon/service-role values;
3. creates disposable Auth identities for active canonical roles;
4. uses `grant_staff_role` whenever the role is on Core's provisionable allowlist;
5. locally seeds implemented legacy roles only when the role exists in `public.roles` but is not provisionable;
6. seeds deterministic, non-commercial Production fixtures for every Production TV group;
7. writes role email/password exports only inside `/tmp`, with mode `0600` enforced even for a pre-existing file.

The controlled Arabic fixture uses full UUID `e3ed28b0-0000-4000-8000-000000000001`, display short ID `E3ED28B0`, assigned quantity `6`, produced quantity `0`, priority `normal`, status `pending`.

## Application target

```bash
export FACTORY_CERT_TARGET_URL=http://127.0.0.1:4173
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

Do not set those variables to production or a branch-preview target. Exact allowlisting never overrides the explicit production-host denylist.

## Role credentials

Every role uses a distinct pair:

```text
FACTORY_CERT_<ROLE>_EMAIL
FACTORY_CERT_<ROLE>_PASSWORD
```

The harness rejects one email being reused for multiple canonical roles. Missing role credentials are `CREDENTIAL_REQUIRED`, not PASS. Before route certification, the harness reads `public.users` through the authenticated user's own RLS session and proves that the database role matches the role being tested.

## Source-truth registry

`src/lib/factoryOperationsSourceTruthRegistry.ts` records existing Factory data authorities rather than introducing a replacement queue model. It explicitly keeps `production_jobs` as governed Production authority; RGS reservations/balances/transfers/issues as custody truth; `b2b_assembly_*` as P&A truth; the P&A↔3PGS bridge and procurement/receipt relations; existing Dispatch/carton references; and `operational_queue_items` as a dead legacy projection for retired Production/Assembly/Ready-Goods execution boards.

## Current executable layers

### Route / role / device health

`tests/factory-operations-route-health.cert.spec.ts` covers every `FACTORY_CURRENT` and `LEGACY_REDIRECT` registry entry, with exact role identity, role proof, device viewport, exact destination, blank/error/console/overflow checks and TV read-only checks. The PR workflow executes and retains the complete route × role × device matrix.

### Governed Production source truth

`tests/factory-operations-production-truth.cert.spec.ts` reads expected jobs directly from `production_jobs` through the same authenticated RLS session and requires each Production TV to project the exact job set and matching full ID, canonical department, status, priority, assigned quantity and produced quantity. The disposable environment seeds at least one open job for all five Production TV groups, so zero/zero parity is rejected.

The current six-TV grouping follows Core's forward correction `20260818090000_rgs_six_tv_department_correction.sql` and Central's `tvGroupOf()` mirror: Arabic includes semi-prepared, Chocolate includes Dragees, Fusion includes Dates, Bakery is `BAKERY`, Nuts is independent, and RGS is the sixth non-production TV.

### Read-failure injection

`tests/factory-operations-failure-injection.cert.spec.ts` aborts browser reads only. Failed `production_jobs` reads must show the Production TV error state rather than `No Open Production Jobs`; failed `inventory_reservations` reads must show the Planner error state rather than false zero shortage.

### Mutation and custody evidence

The disposable workflow executes canonical Core pgTAP contracts for RGS, P&A, 3PGS and Dispatch/Gate authority plus a positive/denied/idempotent Gate-release fixture. It also executes the selected Trace scan, mutation, chain and fail-closed client contract suites. Machine-readable summaries are retained as workflow artifacts.

## Automatic disposable PR execution

`.github/workflows/factory-certification-ephemeral.yml` runs on relevant PR changes with no production secrets. It checks out Central plus canonical Core and Trace `main`, creates a local Supabase stack from Core migrations, creates disposable identities and deterministic fixtures, builds Central against that backend, executes the browser, Core custody and Trace contract layers, uploads machine-readable evidence, then destroys the local database without backup.

Any later branch push invalidates prior exact-head certification for merge purposes. The new head must complete the same workflow successfully before approval/merge.

## Local run

```bash
npx playwright test -c playwright.factory-cert.config.ts
```

Results are written to `factory-certification-results.json`. Missing environment or exact role credentials must remain skipped as `CERTIFICATION_ENV_REQUIRED` or `CREDENTIAL_REQUIRED` and must never be reported as PASS.

## Retained evidence and remaining gate

The harness has retained successful disposable evidence for all software layers above. The final PR head must still show its own green workflow evidence after any review-driven change.

The only separate operational acceptance gate outside this autonomous software certification is physical wall-TV / scanner / printer / kiosk/handheld UAT.

Production remains untouched and is not an allowed substitute for disposable mutation certification.
