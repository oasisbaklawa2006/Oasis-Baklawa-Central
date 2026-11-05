# Certification lanes — current Core dispatch/Gate authority (E0 repair note)

Status: **DRAFT, review-ready only after exact-head CI and independent human review. Not a certification.**
Owner assignment: Mission Control #437, owner authorization comment 6663057890 (draft-only; Core is read-only authority).

## Contract being certified (Core, read-only source)
Only three Core migrations touch the dispatch/Gate authority surface; nothing is later than the role separation
(checked against Core `main` `64589943`):

| Migration | Effect |
|---|---|
| `20260908020000_macro_dispatch_finalization_authority.sql` | `release_order_to_dispatched_v1` finalizes after an immutable dispatch proof + active Finance clearance; role check is `gate_release` (Security Gate). |
| `20260929123000_b2b_dispatch_carton_ready_to_load_authority.sql` | Governed carton `ready_to_load` transition used by the tail. |
| `20261001220000_gate_dispatch_role_separation.sql` | Separation of duties: **Gate** release = `SECURITY_CONTROL`/`GATE_SECURITY` (+admin); **dispatch proof** and **finalization** = `DISPATCH_HEAD`/`DISPATCH_MANAGER`/`DISPATCH_INCHARGE` (+admin). "Security does not mutate order status." |

## What was wrong (all runtime- or source-evidenced in #437)
1. Factory seed re-created `release_order_to_dispatched_v1` with a `gate_release` stub (stale "Core has no …" comment): Dispatch Manager finalization → `P0001 NOT_AUTHORIZED: independent security gate authority required` (#647 diagnostics).
2. Point100 re-applied the **older** `20260908020000` and finalized as `GATE_SECURITY`, so its PASS did not validate the separation.
3. Seeding the proof chain (#648, closed) collided with Point100's governed chain (`B2B_FINANCE_DPL_ALREADY_FROZEN`). Not revived.

## Harness design (one chain, written once)
- **Shared governed chain** (no seeded evidence): `ensure-point38-admin-auth` → `ensure-point38-pi-issued` → `prepare-point38-canonical-exit` (consignment, DPL, Finance receipt, final invoice, e-way, dispatch clearance, each by its own role) → `finalize-point38-canonical-tail` (Gate decision as `GATE_SECURITY`; proof and finalization by the Core-defined owner).
- **Factory lane** runs the chain (`FACTORY_CERT_P38_GOVERNED_CHAIN`, default on) with `POINT38_TAIL_STOP_BEFORE_FINALIZE=true`; the **Dispatch Manager finalizes in the UI** through Core's real RPC.
- **Point100 lane** opts out of the Factory chain and runs it itself, then finalizes in the tail; its authority script is **verify-only** (never re-applies a migration).
- **Mode** (`role-separated` | `pre-separation`) comes from the Core checkout via `scripts/factory-certification/core-authority-mode.sh`; Node scripts fail closed on any other value.
- **No shim, no permissive RPC, no timeout change, no disabled job.**

## Negative authorization assertions (role-separated mode)
Each is a call that must be **rejected for the stated reason**; the lane fails otherwise (`POINT38_NEGATIVE_AUTHORIZATION_FAILED`):
1. `DISPATCH_MANAGER` → `release_b2b_dispatch_carton_at_gate_v1`: `independent security gate authority required`.
2. `GATE_SECURITY` → `record_dispatch_proof_packet_v1`: `dispatch proof authority required`.
3. `GATE_SECURITY` → `release_order_to_dispatched_v1`: `dispatch finalization authority required`, and the order must remain `cleared_for_dispatch` (`POINT38_NEGATIVE_AUTHORIZATION_MUTATED_STATE`).
Not asserted in pre-separation mode: that matrix is not the documented contract there, and asserting it would be a guess.

## Point100 pin
Point100 is pinned to Core `5800f4b8` (30 Sep 2026), which predates the role separation, so until the pin moves its green result is **not** current-Core evidence. The pin must be a Core SHA with a successful protected Production Migration Release. The Point100 job now prints a read-only, non-gating table of such releases and whether each contains the separation migration; the pin is chosen from that evidence, not guessed.

## Test surface
Source guards: `src/lib/point100/__tests__/certificationLaneAuthorityGuard.test.ts`. Behavioural proof is the exact-head jobs: Factory certification, Point100 rehearsal, Buyer regression, smoke, Codacy/CodeQL. Results are recorded per head in #437 (passes, failures, skips and unavailable evidence separately).

## Rollback plan
All changes are disposable-environment certification scripts and a workflow report step; no production, Core, RLS, secret or data change.
- Revert the PR (or the individual commits). Effect: the Factory lane reinstalls the stub and Point100 re-applies the old migration, i.e. the original defect returns; no persisted state is affected.
- The read-only report step can be removed alone without affecting any gate.
- If a lane turns red after merge for an unrelated reason, do **not** re-enable the shim; reproduce with the #647 diagnostics (visible toasts, last RPC responses) first.
