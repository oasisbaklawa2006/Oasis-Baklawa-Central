# Resolver Unification Wave — Executive Summary

**Date:** 2026-06-09  
**Constraints honored:** No SQL, migrations, WhatsApp sends, order creation, or inbox behavior changes

---

## Deliverables

| Workstream | Deliverable | Path |
|------------|-------------|------|
| A | Resolution diff audit | `docs/RESOLVER_DIFF_AUDIT.md` |
| B | Golden utterance matrix (111 cases) | `docs/RESOLVER_GOLDEN_MATRIX.md` + `src/lib/resolver-golden/` |
| C | Shared resolver architecture | `docs/SHARED_RESOLVER_ARCHITECTURE.md` |
| D | Collision remediation plan | `docs/RESOLVER_COLLISION_REMEDIATION.md` |
| E | Clarification UX design | `docs/WHATSAPP_CLARIFICATION_UX.md` |

---

## Readiness scores

| Dimension | % | Basis |
|-----------|---|-------|
| **Resolver unification readiness** | **42%** | Design complete; zero shared code; 111-case matrix ready; no parity tests |
| **Collision risk** | **34%** | 12/29 clarify cases driven by catalogue/substring defects |
| **Clarification readiness** | **45%** | Policy defined in PI; WA band exists; rival chips + scripts not built |

---

## Estimated effort to production resolver

| Phase | Scope | Invasiveness |
|-------|-------|--------------|
| **PR-1** | Extract `product-resolution` package skeleton + types | Low — code move only |
| **PR-2** | Unified `extractSignals` + `buildAliasIndex` | Medium |
| **PR-3** | Unified `scoreCandidates` + `clarificationPolicy` + substring guard | Medium |
| **PR-4** | Wire PI lab to shared package | Low |
| **PR-5** | Wire WA-05A via adapter; golden parity tests ≥ 90% | High |
| **PR-6** | Collision remediation governed drafts | Ops + Low code |
| **PR-7** | Clarification UX chips + scripts in inbox | Medium UI |

**Technical complexity:** Six code PRs touching two existing resolver stacks plus one catalogue cleanup wave. Highest risk is PR-5 (WA inbox regression). Substring guard and collision cleanup are prerequisites for ≥ 95% golden matrix pass rate.

---

## Recommended implementation PR sequence

1. `cursor/product-resolution-package-skeleton-9b16` — types, index, golden test harness
2. `cursor/product-resolution-signals-index-9b16` — unified signals + alias index
3. `cursor/product-resolution-policy-9b16` — scoring + clarification + substring guard
4. `cursor/product-resolution-pi-adapter-9b16` — PI lab cutover
5. `cursor/batch001-collision-cleanup-drafts-9b16` — governed alias remediation (ops)
6. `cursor/product-resolution-wa05a-adapter-9b16` — WA inbox cutover + parity CI
7. `cursor/whatsapp-clarification-chips-9b16` — UX from `WHATSAPP_CLARIFICATION_UX.md`

---

## Validation

```bash
npm run typecheck    # pass
npm run build        # pass
npm run test -- src/lib/resolver-golden src/lib/product-intelligence src/lib/language-wave  # 65 tests
```

---

## Verdict

**READY FOR IMPLEMENTATION PR-1.** Architecture, golden matrix, collision plan, and clarification UX are documented. Production resolver requires shared package extraction and collision remediation before WA inbox cutover.
