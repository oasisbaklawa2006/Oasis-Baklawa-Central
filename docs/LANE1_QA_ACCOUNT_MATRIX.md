# Lane 1 QA Account Matrix

Central issue #368. These are permanent, controlled, non-human test identities
used by `tests/lane1-live-smoke.spec.ts` and the `Lane 1 Authenticated Live
Smoke` workflow. They are not operational users and must never be assigned to
a real employee's or customer's email.

## Governed provisioning path

Create every account through the app's own admin flow at **`/admin/users`**
(`src/pages/admin/AdminUsers.tsx`), logged in as an existing `ADMIN` /
`SUPER_ADMIN`. That page is this codebase's single account-provisioning
authority: it calls `supabase.auth.signUp()` for the identity, then upserts
`public.users` and `public.user_role_map` with the chosen role. Do not insert
into `auth.users` directly, and do not invent a second provisioning path.

## Account list

| Label | Canonical role | Purpose | Owner |
|---|---|---|---|
| `qa-rgs@<domain>` | `RGS_ADMIN` | RGS mutation surface (`/admin/ready-goods`) role-boundary and RPC-wiring proof | Central issue #368 |
| `qa-tv-rgs@<domain>` | `TV_READY` | RGS TV kiosk (`/tv/rgs`) read-only proof | Central issue #368 |
| `qa-production@<domain>` | `HOD_ARABIC` (or another production HOD) | Production handheld/job-execution board proof | Central issue #368 |
| `qa-tv-production@<domain>` | `PROD_ARABIC_SWEETS` | One grouped production-TV screen, department-scoping proof | Central issue #368 |
| `qa-admin@<domain>` (optional) | `SUPER_ADMIN` or `ADMIN` | Cross-TV grouping sweep only — never a substitute for the role-specific accounts above | Central issue #368 |

Use the minimum role that satisfies each row — never grant `SUPER_ADMIN` to a
role-boundary test account for convenience. If proving a specific production
department's TV boundary requires an additional account beyond
`qa-tv-production`, create the minimum additional role-specific identity
needed and add a row here.

Each account should use a clearly non-human display name (e.g. "QA — RGS Live
Smoke") and a generated strong password. Never document the password itself
here or anywhere else in source control.

## Secret variable names (GitHub Actions → Settings → Secrets and variables → Actions)

```
TEST_PREVIEW_URL           # e.g. https://b2b.oasisbaklawa.com

TEST_RGS_EMAIL
TEST_RGS_PASSWORD

TEST_TV_RGS_EMAIL
TEST_TV_RGS_PASSWORD

TEST_PRODUCTION_EMAIL
TEST_PRODUCTION_PASSWORD

TEST_TV_PRODUCTION_EMAIL
TEST_TV_PRODUCTION_PASSWORD

TEST_ADMIN_EMAIL           # optional — enables the six-TV cross-grouping sweep only
TEST_ADMIN_PASSWORD        # optional
```

No defaults exist for any of these. A missing required secret fails the
`Lane 1 Authenticated Live Smoke` workflow's own precondition step with a
clear error, rather than silently skipping the authenticated suite.

## Role assignment verification (read-only, after provisioning)

Before relying on a QA account, confirm:
- the `auth.users` row exists and is confirmed/active;
- the corresponding `public.users` row exists with `is_active = true`;
- `public.user_role_map` maps it to exactly the intended `role_id` — no
  secondary role;
- the account resolves through the same RLS/RPC role helpers a real staff
  account of that role would (e.g. `role_canonical_department()`,
  `is_internal_staff()`), not a special-cased bypass.

## Retention and revocation

These accounts are permanent controlled test identities, reused for CI live
smoke, release regression, and role-boundary checks — they are not meant to
be created and torn down per run. To revoke one: set `is_active = false` and
`invite_status = 'revoked'` on its `public.users` row (or delete the
`auth.users` identity via the same governed admin path), then remove the
corresponding secret pair from GitHub Actions.
