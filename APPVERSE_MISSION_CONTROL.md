# OASIS BAKLAWA APPVERSE — MISSION CONTROL

> **Single programme objective:** complete the Oasis Baklawa Appverse.
>
> This is an index/control plane, not an activity diary. GitHub PRs are evidence; they are not the programme objective.

## Status legend

- 🟢 **CLEARED** — every mandatory gate for the stated scope is verified.
- 🟠 **IN PROCESS** — actively being implemented or certified.
- 🟡 **BLOCKED** — a named blocker/dependency prevents progress.
- 🔵 **READY** — prerequisites are clear and work may start.
- 🔴 **NOT CLEARED** — known work remains or final clearance evidence is incomplete.
- ⚪ **LOCKED** — intentionally cannot start until upstream gates clear.

## Non-negotiable clearance rule

**MERGED ≠ CLEARED.** A PR merge may satisfy one gate. No stage/substage becomes CLEARED merely because a PR merged. Clearance requires all mandatory gates: authority, reachability, tests, integration, UI/runtime where applicable, and physical/production evidence where explicitly required.

## Current programme index

| ID | Stage | State | Active authority / PR | Immediate next gate |
|---|---|---|---|---|
| 00 | Architecture & Governance | 🟠 IN PROCESS | Central #411; Core #133 | Control plane + bounded schema governance |
| 01 | Database / Schema / Migrations | 🟠 IN PROCESS | Core #133 | Bounded semantic census + migration monotonicity |
| 02 | Authentication / RBAC | 🔴 NOT CLEARED | — | Whole-Appverse role/route/RLS census |
| 03 | Core Backend Authority | 🟠 IN PROCESS | Core #130/#133/#134 | Close active authority slices; recensus dead paths |
| 04 | Central App Foundation | 🔴 NOT CLEARED | Central #411 | Final route/module + ownership census |
| 05 | Order / Pre-Factory Commercial Flow | 🟠 IN PROCESS | Core #130 | Payment evidence → finance/release chain |
| 06 | WhatsApp | 🟠 IN PROCESS | Core #126/#134 | Multimodal + protected/provider/release certification |
| 07 | RGS | 🔴 NOT CLEARED | — | Physical handheld/TV UAT + final census |
| 08 | 3PGS | 🟠 IN PROCESS | Central #410 | R4.2 closure → R4.3 put-away/discrepancy |
| 09 | Packing & Assembly | 🔴 NOT CLEARED | — | Physical UAT + final whole-chain confirmation |
| 10 | Production Departments | 🔴 NOT CLEARED | — | Real TV/handheld UAT |
| 11 | Dispatch | 🔴 NOT CLEARED | — | Complete governed lifecycle + legacy cutover census |
| 12 | Finance & Accounts | 🟠 IN PROCESS | Core #130 | Payment authority → finance clearance |
| 13 | Buyer App | 🔴 NOT CLEARED | — | Full current repository/journey census |
| 14 | AI Studio | 🔴 NOT CLEARED | — | Current-head + Core bridge clearance census |
| 15 | Trace | 🔴 NOT CLEARED | — | Latest state + device/scanner UAT census |
| 16 | Cross-App Integration | ⚪ LOCKED | Mission Control | Progressive unlock after upstream software gates |
| 17 | Automated Testing / Certification | 🟠 IN PROCESS | Core #126 | Extend Factory pattern across critical journeys |
| 18 | Security / Governance | 🟠 IN PROCESS | Central #411; Core #133 | Required control-plane checks |
| 19 | UI / UX Completion | 🔴 NOT CLEARED | — | Module-by-module UX completion census |
| 20 | End-to-End Certification | ⚪ LOCKED | Mission Control | Unlock after functional convergence |
| 21 | Production Readiness | ⚪ LOCKED | Mission Control | Unlock after E2E |
| 22 | **APPVERSE COMPLETE** | ⚪ LOCKED | Mission Control | All mandatory gates green |

The machine-readable authority is [`appverse-control/state.json`](appverse-control/state.json). Generated live GitHub facts belong under `appverse-control/generated/` and must never silently overwrite semantic clearance.

## Current convergence path

There is currently **no single universal blocker**. Four active lanes converge on completion in parallel:

1. **MIG-01** — schema/migration governance (`Core #133`, companion `Central #411`).
2. **WA-01** — WhatsApp release certification and media correction (`Core #126/#134`).
3. **3PGS-01** — governed 3PGS closure (`Central #410`; Core #129 is already merged prerequisite evidence).
4. **PF-01** — pre-factory commercial/payment authority (`Core #130`).

Final convergence remains:

`remaining module closure → cross-app integration → UI/UX completion → automated E2E → physical UAT → production readiness → APPVERSE COMPLETE`

## Verified evidence anchors used in ASM v1

- Factory Operations autonomous software certification was merged with 7/7 production-truth/failure-injection browser passes, 94/94 route/role/device health passes, 239 backend custody assertions, and 64/64 Trace contract tests. Its own closure explicitly leaves **physical device UAT separate**, so Factory-related stages are not globally marked CLEARED.
- Core migration/schema recovery reached production catch-up through `20260828002100`; governance is still active because #133 replaces the connection-heavy semantic watcher and adds migration-base monotonicity.
- WhatsApp CORE-A/B/C and Central exception-first UI are merged, but the release-certification lane remains active through #126 and media fix #134.
- 3PGS remains active in Central #410; the earlier Core #129 prerequisite is merged.

## Mission Control commands

When interacting with the programme-control thread, short commands are sufficient:

- `STATUS`
- `WHAT NEXT?`
- `SHOW BLOCKERS`
- `SHOW CRITICAL PATH`
- `CHECK PR <number>`
- `ROUTE THIS: <paste>`
- `CLAIM <ASM-ID> FOR <thread/agent>`
- `RELEASE <ASM-ID>`

## Thread routing contract

Every execution instruction must declare at least:

- `ASM-ID`
- `THREAD-ID`
- `REPOSITORY`
- `MISSION`
- `DEPENDENCIES`
- `STOP CONDITION`

If an instruction does not belong to the receiving thread/repository scope, the agent must **not execute it** and must respond:

> `ROUTING REJECTED — instruction does not belong to this thread.`
>
> `Likely ASM route: <workstream/ID>. No code, PR, migration, deployment, or scope expansion performed.`

Agents may report cross-scope discoveries to Mission Control, but must not silently absorb them into their mission.

## Authority hierarchy

1. **Mission Control / ASM** — sequence, scope, dependencies, stage truth.
2. **Repository authority documents and ownership rules** — technical mutation boundaries.
3. **Execution agent/thread** — implementation of its assigned ASM item only.
4. **CI/review systems** — evidence and findings, not programme direction.

If these conflict, execution stops fail-closed and routes the conflict to Mission Control.
