# Lane 2 (P&A) Staging Fixture Matrix

Central issue #368, Lane 2 PR D (`tests/lane2-pna-e2e-chain.spec.ts`).

## Environment governance status (2026-08-21)

**No certified staging Supabase project currently exists for this proof.**
`tcxvcatsqqertcnycuop` is the sole persistent/canonical Supabase authority
(see `docs/APP_VERSE_POINT_14_ENVIRONMENT_MATRIX_2026-07-23.md` and its
Lane 2 certification-environment addendum) and **must never be used** for
this mutating proof, or for any other test-certification mutation.

`aruyieslaxjhnamlstpx`, which earlier revisions of this document and the
Lane 2 workflow named as "the staging Supabase project," is a **historical,
NON-authoritative reference only**. It was used in ad hoc engineering
sessions on 2026-05-30 (Stage 14B/14F/14H) before App-Verse environment
governance existed, and was never named or ratified by the canonical,
frozen governance record. **It must not be recreated, restored, or
reconnected merely to make this workflow runnable.** The owner has not
authorised a second persistent Supabase project, and this document does not
propose one.

**Case A and Case B remain STAGING-UAT-PENDING / ENVIRONMENT-PENDING.**
Both are fully authored and statically validated (`tsc`, `eslint`,
`playwright --list`) but have never been executed against any real backend,
and cannot be, until a certification environment is separately approved.
This is not a defect in the test logic — the governed RPC chain, the 3PGS
dependency-boundary proof, and the UI-contract assertions are all
environment-agnostic and remain the future certification specification
exactly as written.

The Lane 2 workflow (`.github/workflows/lane2-pna-staging-proof.yml`)
enforces this: it stays manually dispatchable, but its first job
(`environment-governance-gate`) unconditionally fails closed with a clear
governance message before any browser or backend step can run. The spec
itself independently fails closed in `beforeAll`, for the same reason,
regardless of what `TEST_SUPABASE_URL` is supplied — so even a direct
`playwright test` invocation outside the workflow cannot execute a
mutation against any project, approved or not.

## Path to re-enabling this proof

Any future execution requires a **separately approved, disposable or
isolated** certification mechanism — for example, a CI-provisioned
instance built from `oasis-supabase-core`'s canonical migration replay and
destroyed after the run, or an ephemeral remotely-reachable instance torn
down immediately after certification. **A second persistent Supabase
project is not the expected or proposed solution** and is not authorised.
Until such a mechanism is explicitly approved and this document is updated
to name it, Case A/Case B stay environment-pending and the workflow stays
fail-closed by design.

## Governed provisioning path (for whenever an approved environment exists)

Assembly and receiver identities require `can_manage_b2b_inventory` and
`can_receive_b2b_inventory` respectively. Provision via the governed Core
`admin-provision-user` Edge Function once merged, or an existing governed
staff-provisioning path — not browser-side `signUp()`.

## Secrets this workflow expects (for whenever an approved environment exists)

```text
LANE2_TEST_PREVIEW_URL          # Vercel preview or non-production Central URL (NOT production)

TEST_SUPABASE_URL               # Approved certification project URL (none currently approved)
TEST_SUPABASE_ANON_KEY          # Its anon/publishable key

PNA_ASSEMBLY_EMAIL
PNA_ASSEMBLY_PASSWORD           # can_manage_b2b_inventory

PNA_RECEIVER_EMAIL
PNA_RECEIVER_PASSWORD         # can_receive_b2b_inventory — MUST differ from assembly

PNA_ORDER_NUMBER                # Case A: pre-existing order_number, NO mandatory 3PGS shortage
PNA_3PGS_SHORTAGE_ORDER_NUMBER  # Case B: different order with mandatory 3PGS/PACKING shortfall
```

No defaults exist in the spec. Configuring these secrets does **not** make
the workflow runnable — `environment-governance-gate` fails closed
regardless, until a certification environment is separately approved.

## Fixture requirements (orders are preconditions, not created by the test)

| Case | Env var | BOM / stock requirement |
|------|---------|-------------------------|
| A | `PNA_ORDER_NUMBER` | Every component resolvable; **no** 3PGS/PACKING_ASSEMBLY/B2B_RAW shortage; FINISHED_GOODS shortfall permitted |
| B | `PNA_3PGS_SHORTAGE_ORDER_NUMBER` | At least one 3PGS/PACKING_ASSEMBLY/B2B_RAW component genuinely short |

The test **creates assembly jobs** and mutates inventory through issue/consumption
(Case A). Case B leaves the job at `partially_reserved`. Whatever certification
environment is eventually approved, use dedicated orders reserved for this
proof; re-seed or replace after each full Case A run.

## Production isolation (unconditional, independent of the above)

- The workflow's `environment-governance-gate` job fails before any other
  job runs.
- `connectivity-guard`'s "Refuse preview builds not wired to production
  Supabase" step independently refuses any preview bundle baking in
  `tcxvcatsqqertcnycuop`.
- `lane2-pna-e2e`'s "Assert required secrets are present and refuse
  production Supabase" step independently refuses a `TEST_SUPABASE_URL`
  resolving to `tcxvcatsqqertcnycuop.supabase.co`.
- The spec's own `beforeAll` independently refuses `TEST_SUPABASE_URL`
  pointing at `tcxvcatsqqertcnycuop.supabase.co`, regardless of the
  workflow.

These four layers are independent of the staging-environment governance
question above and remain in force even if a future certification
mechanism is approved.

## Execution

Manual dispatch only: **Lane 2 P&A Staging Proof** workflow
(`.github/workflows/lane2-pna-staging-proof.yml`). As of 2026-08-21,
dispatching it will fail immediately at `environment-governance-gate` with
a message pointing back to this document — this is expected, not a bug,
until a certification environment is separately approved.
