# Appverse Point 0 — Verified Programme Baseline (5 November 2026 IST)

**This is a review-only evidence checkpoint, not a launch certificate.** Existing [Mission Control](../../APPVERSE_MISSION_CONTROL.md), its machine-readable `appverse-control/state.json`, and [original 1–100 issue #437](https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/issues/437) remain canonical. The nine E0–E8 execution stages are a *sequencing overlay*, not replacement numbering.

## Audited source heads and open PR census

| Lane | Main/source SHA | Open PRs | Built % | Integrated % | Certified % |
| --- | --- | ---: | --- | --- | --- |
| Supabase Core | `645899439fe0a84806238b9114649eb2c3785a75` | 7 | Unknown | Unknown | Unknown |
| Central | `4f80f1444b854e2ac2eb4dd9b7d00d7b21d5af13` | 5 | Unknown | Unknown | Unknown |
| AI Studio | `abeec87d9ca83ec91e78ba94ad554113d1d4c6e1` | 7 | Unknown | Unknown | Unknown |
| Expo Buyer | `e5096cfa37049743a3c3d768948943c03b10612b` | 7 | Unknown | Unknown | Unknown |
| Trace | `e9d9647b7537e7a85591b93666e28a500a0c708c` | 0 | Unknown | Unknown | Unknown |
| Website (Lovable source) | `98a2750a42df57494b1cbf136b43d9f957617739` | Git remote unverified | Unknown | Unknown | Unknown |
| WhatsApp Ops (Core + Central shared) | Multiple | Included above | Unknown | Unknown | Unknown |

**26 open PRs** in five principal repositories; sixth accessible `clone-oasis-baklawa-central` has zero open PRs and is not an operational application authority.

## Website handover
- Exact existing Lovable project: [Oasis Baklawa Website](https://lovable.dev/projects/bf9348e9-021e-47e6-8272-ceee39c7cb0b), ID `bf9348e9-021e-47e6-8272-ceee39c7cb0b`. Unpublished; Supabase-backed database enabled.
- Remix from Oasis Baklawa Gifting `502df2ab-4478-4a79-9be7-cfe1ec9d5bec`, historical source commit `143ef48c5113e2a540c75558239cf7006f1c314a`; website source has `docs/WEBSITE_REPOSITORY_MIGRATION.md`, `docs/OASIS_CONNECT_WEBSITE_CONTRACT.md`, `AGENTS.md`.
- `AGENTS.md` warns against rebasing or force-pushing synced Lovable history. Do **not** rebuild, rewrite or cut over.
- Current accessible GitHub account lists no verified dedicated website repository. Confirm the **actual** URL/remotes/ancestry before website implementation. Do not confuse it with `oasis-baklawa` (Expo Buyer).
- Website is downstream of approved `published_products_v1()` / Oasis Connect `website_retail_v1` with approved channel prices; no independent product master/price/stock/financial order authority or mock checkout activation.

## Three independent percentages — evidence contract
**Built** = proportion of accepted, weighted scope with source+tests at exact SHA.
**Integrated** = proportion with actual frontend/backend contracts proven on pinned environment and authenticated actors.
**Certified** = proportion with all mandatory security, negative tests, real provider/physical and protected release criteria passed.

The denominator is the 100 original requirements decomposed into app-specific controls and approved weights. Publish a numerical percentage **only when all denominator scope and evidence have been audited**; unknown MUST remain `null`. PR count and merged commits do not earn release percentages. Shared Core and WhatsApp controls cannot be double-counted.

## E0 actions — next
1. Reconcile every historical original P001–P100 status with current exact SHA evidence; build the weighted per-app denominator and source links.
2. Verify exact website Git remote; no website code/public changes until matched.
3. Audit current PRs, workflows, live deployments, Supabase migration ledger and guarded authority.
4. Repair the existing `appverse-mission-control.yml` refresher through a tested, separate guarded PR. The `mission-control/live-state` branch did not contain its expected generated `appverse-control/generated/github-state.json` at audit time; hourly workflow definition by itself is not live dashboard proof.
5. Verify an actual Claude Code runner and its auth/usage status. Work order alone does not launch the agent.
6. Publish task checkpoints on GitHub so the owner never needs to transfer messages across chats.

**No production writes, merges, deployment, provider sends, paid branch creation or secrets were performed by this documentation checkpoint.**
