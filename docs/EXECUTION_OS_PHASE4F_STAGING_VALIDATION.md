# Phase 4F staging validation — Legacy dispatch decommission

## Prerequisites

- [ ] Phases 4A–4E migrations applied and staging checklists signed off
- [ ] Governed finalize proven on sample order (`dispatch_release_lineage` + `orders.status`)

## Legacy route smoke

- [ ] Open `/admin/packing-dispatch` — governance banner visible
- [ ] Open `/admin/dispatch` (alias) — same banner
- [ ] Open `/admin/dispatch-mgmt` — banner on handheld view
- [ ] Open `/security-gate` — banner visible

## Mutation buttons absent / neutralized

- [ ] Packing modal: full closure disabled unless partial leg checked; button reads **Record partial leg**
- [ ] Packing modal: **Governed finalization** link works
- [ ] Submit full dispatch (partial unchecked) — toast blocks + no network `orders` PATCH to `dispatched`
- [ ] Order pipeline: **Governed Finalize** action shows error toast (no status change)
- [ ] Security gate scan-out: carton releases but order stays `cleared_for_dispatch` (or prior) until 4E

## Governed path still works

- [ ] `/admin/dispatch-finalization` loads for `DISPATCH_MANAGER` / `DISPATCH_HEAD`
- [ ] Sample eligible order can finalize (4E checklist)
- [ ] Customer publication preview unchanged from 4E

## Network tab proof

- [ ] On packing-dispatch partial leg: may see `dispatches` INSERT — must **not** see `orders` UPDATE `status=dispatched`
- [ ] On accounts gate pass: must **not** see `orders` UPDATE to dispatched
- [ ] Finalize on 4E board: single governed `orders` UPDATE with status guard

## Forbidden proofs

- [ ] Grep `src/pages/admin/AdminPackingDispatch.tsx` — no `status: "dispatched"` on `orders.update`
- [ ] Grep `src/pages/admin/AdminSecurityGate.tsx` — same
- [ ] Grep `src/pages/admin/AdminAccountsRelease.tsx` — same
- [ ] No new `markDispatched` / `forceDispatch` helpers

## Role gating

- [ ] `SALES_EXECUTIVE` still blocked from admin dispatch routes
- [ ] Dispatch module nav includes **Dispatch finalization**

## Grep exception table (unchanged from 4E)

| Pattern | File | Reason |
|---------|------|--------|
| `.update(` | `supabaseDispatchFinalizationStore.ts` | Governed `orders.status` only |

No new `.update(` / `.delete(` in legacy pages for dispatched closure.
