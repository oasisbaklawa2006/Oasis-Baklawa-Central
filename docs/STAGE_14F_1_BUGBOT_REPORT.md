# STAGE 14F.1 BUGBOT REPORT

**PR reviewed:** https://github.com/oasisbaklawa2006/Oasis-Baklawa-Central/pull/129  
**Bugbot review:** Cursor Bugbot on commit `c045023` — **12 findings** (summary comment on PR)  
**Evidence:** `gh api repos/.../pulls/129/comments` — 12 inline review comments from `cursor[bot]`

---

## Counts

| Severity | Count |
|----------|-------|
| **Total** | **12** |
| **High** | **2** |
| **Medium** | **5** |
| **Low** | **5** |

---

## Findings table (high + medium)

| Severity | File | Location | Bugbot claim | Real? | Required fix |
|----------|------|----------|--------------|-------|----------------|
| **High** | `ReservationGovernancePanel.tsx` | `handleOrderChange` / line loader | Stale `selectedLine` when order changes | **Yes** | Reset line on order change; load lines with order-scoped helper |
| **High** | `ReservationGovernancePanel.tsx` | order-items `useEffect` | Race: stale fetch can set wrong line | **Yes** | Cancel guard + `loadOrderLinesForReservation`; remove duplicate fetch |
| **Medium** | `reservationBoardQueries.ts` | `buildReservationCreateBlockers` | Blockers use line qty not reserve qty | **Yes** | `reserveQty` param + panel `useMemo` blockers |
| **Medium** | `createGovernedReservation.ts` | `createAndReserveInventoryForOrder` | Failed reserve leaves pending row | **Yes** | Best-effort `cancelReservation` on reserve failure |
| **Medium** | `reservationBoardQueries.ts` | `loadReservationBoardOrderContext` | Ignores errors on parallel queries | **Yes** | `throwQueryError` on all Supabase responses |
| **Medium** | `ReservationGovernancePanel.tsx` | context `useEffect` | Location reload overwrites reserve qty | **Yes** | Set qty only when line changes, not on location reload |
| **Medium** | `ReservationGovernancePanel.tsx` | post-success refresh | Success path refresh failure silent | **Yes** | try/catch refresh; surface warning |

## Low findings (documented; partially addressed in 14F.1)

| Severity | File | Claim | Real? | Action in 14F.1 |
|----------|------|-------|-------|-----------------|
| Low | `ReservationGovernancePanel.tsx` | Seed qty stuck across lines | Yes | Fixed: reset seed when line changes |
| Low | `ReservationGovernancePanel.tsx` | Duplicated order line mapping | Yes | Fixed: `mapOrderItemsToLineCandidates` + `loadOrderLinesForReservation` |
| Low | `ReservationGovernancePanel.tsx` | Refresh swallows errors | Yes | Fixed: catch + message |
| Low | `ReservationGovernancePanel.tsx` | Create enabled without context | Yes | Fixed: require `context` before button |
| Low | `reservationBoardQueries.ts` | Verified scan window too narrow | **Debatable** | No change — matches 4G read model (`carton` / `packing` / `dispatch_gate`) |

---

## Fixes applied

**yes** — branch `cursor/stage-14f1-bugbot-fixes-a394`

### Files changed

- `src/components/admin/ReservationGovernancePanel.tsx`
- `src/lib/inventory-reservations/reservationBoardQueries.ts`
- `src/lib/inventory-reservations/createGovernedReservation.ts`
- `src/lib/inventory-reservations/__tests__/reservationBoardQueries.test.ts`
- `src/lib/inventory-reservations/__tests__/createGovernedReservation.compensation.test.ts`
- `docs/STAGE_14F_1_BUGBOT_REPORT.md`

### Tests

```bash
npm run typecheck          # pass
npm run build              # pass
npm test -- --run src/lib/inventory-reservations   # pass (28 tests)
```

---

## Governance safety (fixes)

- No migrations
- No `stock_consumption_lineage` writes
- No auto stock finalization
- Cancel-on-failure uses governed `cancelReservation` service only
- Blockers strengthened (includes `pending` open reservations)

---

## READY FOR STAGE 14G

**YES** — after merging 14F.1 bugfix branch to `main` and deploying to **staging** (`aruyieslaxjhnamlstpx`). Run the Stage 14G runbook from `docs/STAGE_14F_IMPLEMENTATION_REPORT.md`.
