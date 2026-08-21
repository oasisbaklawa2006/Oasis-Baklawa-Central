# Lane 2 (P&A) Staging Fixture Matrix

Central issue #368, Lane 2 PR D (`tests/lane2-pna-e2e-chain.spec.ts`).

This spec proves the governed P&A assembly chain against a **non-production**
deployment backed by the **staging** Supabase project (`aruyieslaxjhnamlstpx`).
It must never run against production (`tcxvcatsqqertcnycuop` /
`b2b.oasisbaklawa.com`).

## Governed provisioning path

Assembly and receiver identities require `can_manage_b2b_inventory` and
`can_receive_b2b_inventory` respectively. Provision via the governed Core
`admin-provision-user` Edge Function once merged, or an existing governed
staff-provisioning path — not browser-side `signUp()`.

## Required GitHub Actions secrets

```
LANE2_TEST_PREVIEW_URL          # Vercel preview or staging Central URL (NOT production)

TEST_SUPABASE_URL               # Staging project URL (aruyieslaxjhnamlstpx)
TEST_SUPABASE_ANON_KEY          # Staging anon/publishable key

PNA_ASSEMBLY_EMAIL
PNA_ASSEMBLY_PASSWORD           # can_manage_b2b_inventory

PNA_RECEIVER_EMAIL
PNA_RECEIVER_PASSWORD         # can_receive_b2b_inventory — MUST differ from assembly

PNA_ORDER_NUMBER                # Case A: pre-existing order_number, NO mandatory 3PGS shortage
PNA_3PGS_SHORTAGE_ORDER_NUMBER  # Case B: different order with mandatory 3PGS/PACKING shortfall
```

No defaults exist in the spec. Missing secrets fail the workflow precondition
step with a clear error.

## Fixture requirements (orders are preconditions, not created by the test)

| Case | Env var | BOM / stock requirement |
|------|---------|-------------------------|
| A | `PNA_ORDER_NUMBER` | Every component resolvable; **no** 3PGS/PACKING_ASSEMBLY/B2B_RAW shortage; FINISHED_GOODS shortfall permitted |
| B | `PNA_3PGS_SHORTAGE_ORDER_NUMBER` | At least one 3PGS/PACKING_ASSEMBLY/B2B_RAW component genuinely short |

The test **creates assembly jobs** and mutates inventory through issue/consumption
(Case A). Case B leaves the job at `partially_reserved`. Use dedicated staging
orders reserved for this proof; re-seed or replace after each full Case A run.

## Execution

Manual dispatch only: **Lane 2 P&A Staging Proof** workflow
(`.github/workflows/lane2-pna-staging-proof.yml`).
