# Point 0 Dashboard v1.1 — Build • Testing • Certification • Combined

Approved by owner on 5 Nov 2026. This specification supersedes the original **Built / Implemented / Certified** visual score arrangement but does NOT renumber or change any original 1–100 requirement, Mission Control authority, score denominator, acceptance requirement, or production gate.

## Four visual bars at every level
The whole enterprise, each application (including shared WhatsApp ops), each E0–E8 stage, and each original P001–P100 row show:
1. **BUILD %** — accepted implementation with exact source commit and relevant implementation tests.
2. **TESTING %** — independent positive + negative functional, integration, authenticated-role, persistence, regression and cross-app tests pinned to actual release/env.
3. **CERTIFICATION %** — formal mandatory security, provider/real-device, operational UAT, production release and independent sign-off gates, according to scope.
4. **COMBINED %** — the *equal-weight arithmetic mean* (Build + Testing + Certification)/3 **only** if all three are valid evidence-backed percentages with approved exhaustive denominator coverage. Never calculate with a missing component; write `null` / “Not verified”, not zero.

## Presentation
- Four labelled, horizontally filling progress bars, with an adjacent legible percentage.
- Unknown/unverified: striped grey track and “N/V”; no green status bar, no invented percentage.
- One row per app with separate four measures; expand to show status, responsible repo, pinned SHA, blocker and evidence.
- E0–E8 cards expose the same bars; original P001–P100 register has the same four measures and search/filter.
- Enterprise rollup aggregates weighted *unique* original requirements, not a simple mean of apps; shared Core + WhatsApp controls are not double-counted.
- Show `overall GO/NO-GO` as separate governance status; even 100% of numerical bars cannot override protected approvals or physical UAT.
- Preserve an offline dated view until the live refresh pipeline is verified, and state the source, timestamp and SHA of each score.
- Do not show percentage bars as loading/spinner animations suggesting progress when no measured value exists.

## Evidence discipline
- Every numerator requires requirement ID, approved in-scope weight, source SHA, dated environment, test/report URL, verifier and applicable release/UAT witness.
- Three denominators may differ when controls are not applicable, but each must be declared, complete and independently auditable; programme-wide weighting must be approved before percentages appear.
- `Implementation/Integration` remains an important engineering gate, but is counted in the **Testing** proof (integration/contract/runtime tests) and in **Certification** formal acceptance, rather than displayed as a redundant fourth core dimension.
- During E0 all scores remain `null`. PR checks, commit counts, merged status and implementation guesses are insufficient.
- Source of truth remains `APPVERSE_MISSION_CONTROL.md` and `appverse-control/state.json`; supporting draft register: `docs/appverse-point0/progress.json`.

## Claude E0 instruction
Populate evidence and weights first. Then implement a GitHub-backed timestamped dashboard refresh through the already-existing Mission Control evidence pipeline after diagnosing its missing generated file. Commit only scoped branch changes with tests; draft PR and protected approvals, no production mutation. Report status in #437 and #642, avoiding manual relay.

**Scope:** dashboard and governance documentation only; no product/application code, release or production changes.
