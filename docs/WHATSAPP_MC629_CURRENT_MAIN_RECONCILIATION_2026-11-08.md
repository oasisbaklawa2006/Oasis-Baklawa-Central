# MC#629 WhatsApp original-communicator / no-default-quantity integration reconciliation

Reconciliation date: 2026-11-08. This is a current-main **review and test trigger**, not certification or authority for a production merge.

## Live source defect on current Central production baseline

Central `main` and READY Vercel production source commit: `cec4f309eae789d70e1f891d8df2761f182142fe`.

Read-only exact-source inspection of this commit finds:
- `src/components/whatsapp/OperatorInboxCommercialLayers.tsx` initializes `originalMethod` to `DIRECT_MESSAGE` before any evidence choice. It does not expose the Core `whatsapp_search_case_parties` party picker.
- `src/lib/wa-governance/draftOrderExtraction.ts` sets `rawQuantity: 1` when a product match exists but no quantity is supplied, even though downstream readiness must not treat such a placeholder as real. This is an unacceptable operator-facing implied quantity and must not reach any governed order writer.
- Production Core `public.whatsapp_search_case_parties(text,text,integer)` is present, **anon EXECUTE denied**, authenticated EXECUTE granted subject to function-internal permissions. The UI needs signed-in authorized testing; a grant surface alone does not certify row isolation.

## Existing PR #630 preserves the corrective implementation

Existing active branch `fix/mc629-original-communicator-activation` at initial inspected head `8ae232c9fa0e1612255b9defd1228c940e5b3ff5` already replaces the default method with an explicit choice, prevents silent SUBMITTING_SENDER→ORIGINAL_COMMUNICATOR assumption, implements read-only party search with stale-search protection, and carries positive/negative UI tests. It makes missing quantities `null`, presents clarification labels and adds early SO readiness semantics without bypassing billing/dispatch holds.

Historical PR CI reported 659 WhatsApp tests and green TypeScript/Vitest/quality, but the branch was **51 commits behind** `cec4f309` and is not fully recertified against current Central deployment. Prior green is historical evidence, not a live/current-main UAT PASS.

## Scope-preserving acceptance

1. On this same PR (do not create a duplicate implementation), run exact-head merge-ref CI against the **actual latest** main, not the October base. Verify full production build, typecheck, all WhatsApp/wa-governance suites, original-communicator React UI, no quantity=1 fallback and readiness holds. CI must not skip failures.
2. Confirm every changed Core RPC signature and parameter spelling against the deployed production **read-only**, especially `whatsapp_search_case_parties` and the four SO readiness gates.
3. Preserve all current-main changes outside the original 16-file WhatsApp scope; resolve any conflicts or TypeScript regressions in this branch before protected review.
4. Require signed-in Support and Sales tester sessions, AAL2 when appropriate, direct vs forwarded customer separation, cross-account negative search and actual operator case switching. A scripted/mock test is NOT authenticated staff UAT.
5. Require an independent human owner/code-owner approval after the final push, resolved review threads and protected merge; then a verified Central Vercel deployment/rollback record. No automatic deployment or customer message from this source-audit note.

**Status:** Existing corrective software present on PR but **UNMERGED**, staff UAT and live end-to-end SO release BLOCKED. Cross-reference Core final WhatsApp certificate: https://github.com/oasisbaklawa2006/oasis-supabase-core/issues/450.
