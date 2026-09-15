# OASIS BAKLAWA APPVERSE — MISSION CONTROL

> **Single programme objective:** complete the Oasis Baklawa Appverse.
>
> This is the programme control plane, not an activity diary. GitHub PRs are evidence; they are not the objective.

## Status legend

- 🟢 **CLEARED** — every mandatory gate for the stated scope is verified.
- 🟠 **IN PROCESS** — actively being implemented or certified.
- 🟡 **BLOCKED** — a named dependency prevents progress.
- 🔵 **READY** — prerequisites are clear and work may start.
- 🔴 **NOT CLEARED** — known work remains or final clearance evidence is incomplete.
- ⚪ **LOCKED** — intentionally cannot start until upstream gates clear.

## Non-negotiable clearance rule

**MERGED ≠ CLEARED.** A PR merge may satisfy one gate. No stage/substage becomes CLEARED merely because a PR merged. Clearance requires all mandatory gates: authority, reachability, tests, integration, UI/runtime where applicable, protected release where applicable, and physical/provider/production evidence where explicitly required.

## Current programme authority — APPVERSE-LINK-01

The final convergence mission is now explicitly routed:

- **ASM-ID:** `APPVERSE-LINK-01`
- **THREAD-ID:** `appverse-completion-final-linking-20260915`
- **REPOSITORY:** `oasisbaklawa2006/Oasis-Baklawa-Central`
- **MISSION:** final cross-repository dependency control, sequencing, and fail-closed convergence to Point100 / Production Readiness / APPVERSE COMPLETE.
- **DEPENDENCIES:** [`appverse-control/dependency-graph.json`](appverse-control/dependency-graph.json)
- **STOP CONDITION:** the dependency graph and link-integrity CI are green; every active lane is routed to its owning repository; final completion remains blocked only by explicit software review/release and external production/physical/provider gates.

The machine-readable programme state remains [`appverse-control/state.json`](appverse-control/state.json). The cross-repository dependency graph is [`appverse-control/dependency-graph.json`](appverse-control/dependency-graph.json). `state.json` owns semantic stage truth; the dependency graph owns final convergence sequencing.

## Production change safety gate

Mission Control may inspect, route, branch, test, compare and prepare non-production governance changes. It must **not** use programme-control authority to bypass the owning repository's production controls.

Without the separately governed authorization/evidence required by the owning lane, Mission Control must not:

- merge a protected production branch;
- apply a production database migration or rewrite production migration history;
- deploy production Edge functions/apps;
- mutate production data or secrets/configuration;
- create billable infrastructure merely to make a check green;
- manufacture or infer scanner/printer/TV/handheld/Security-Gate/Buyer-phone/provider evidence.

Non-production branch synchronization is allowed when it only brings the feature branch to the current repository-local authority and is followed by exact-head recertification.

## Cross-repository authority model

**Core publishes authority; consumers bind to it.** `oasisbaklawa2006/oasis-supabase-core` is the canonical owner of shared backend contracts, Supabase schema/migrations, governed RPC/Edge authority and release pins. Central, Buyer App, AI Studio and Trace must not create parallel transactional/backend truth.

**Each repository owns its client/domain implementation.** Central owns the Admin/Operational Control Tower, Buyer App owns the customer-facing/mobile Buyer experience, AI Studio owns the AI/knowledge plane, and Trace owns Trace client/domain behaviour. Their repository `CLAUDE.md` boundaries remain in force.

**Cross-repository linking is semantic/release linking, not Git-base linking.** A PR head/base pair stays inside one repository. Cross-repo dependencies are recorded as `producer → consumer` release edges in the Mission Control graph. A consumer that depends on a Core mutation authority must remain fail-closed until the required Core merge/release/runtime verification is complete.

**The only intentional stacked feature PR in the current final graph is AI Studio Point50 #211 on Point49 #210.** After Point49 merges, Point50 must be retargeted to AI Studio `main`, reconciled with then-current `main`, and run through fresh normal CI before review/merge. No other final lane may silently become stacked.

## Current final completion graph

The canonical exact graph is machine-readable in `appverse-control/dependency-graph.json`. The major final dependency edges are:

```text
AI #210 Point49
    └──> AI #211 Point50 (temporary same-repo stack)

Core #300 Trace write authority
    └── protected merge/release/runtime proof
        └──> Trace #38 consumer recertification/merge
             └──> Point100 #559

Core #308 durable WhatsApp consumer ─┐
Core #309 sender≠customer identity ──┴──> live-provider WhatsApp certification ──> Production Readiness

Central #588 AUTH-01 ────────────────┐
Central #589 governance ─────────────┤
Core #289 Finance ledger ────────────┤
Trace #38 ───────────────────────────┤
AI #210/#211/#212 ──────────────────┤──> Point100 #559 final software rehearsal
Buyer App current-main recert ──────┤
Core #308/#309 software authority ──┘

Point100 #559 ───────────────────────┐
Core #307 security hardening ───────┤
WhatsApp live certification ────────┤──> Production Readiness ──> APPVERSE COMPLETE
Physical/provider UAT ──────────────┘
```

Point100 is therefore a **convergence consumer**, not an authority source. Before final rehearsal it must be reconciled onto then-current Central `main` and update its exact authority pins/evidence to the final Core/Trace/AI/Buyer state. It must not be used to bless stale upstream commits.

## Current final lanes

| Lane | Repository / PR | State | Required next gate |
|---|---|---|---|
| AUTH-01 | Central #588 | 🟠 IN PROCESS | independent review → protected merge → production Buyer-login/runtime verification |
| Central governance | Central #589 | 🟠 IN PROCESS | Release Quality exact-head PASS → independent review → protected merge |
| Finance ledger | Core #289 | 🟠 IN PROCESS | exact-head Core gates/review → protected exact-SHA release → production Finance runtime proof |
| Trace write authority | Core #300 | 🟠 IN PROCESS | exact-head Core gates/review → protected Production Migration Release → production semantic/runtime proof |
| Core security | Core #307 | 🟠 IN PROCESS | review/merge → protected migration → production advisor/runtime verification |
| WhatsApp durable consumer | Core #308 | 🟠 IN PROCESS | exact-head gates/review/merge → migration + Edge deploy → Vault URL → queue-drain proof |
| WhatsApp identity | Core #309 | 🟠 IN PROCESS | exact-head gates/review/merge → governed webhook release → live-provider identity/zero-loss proof |
| AI Point49 | AI #210 | 🟠 IN PROCESS | independent review → protected merge → runtime multilingual evidence |
| AI Point50 | AI #211 | 🟡 BLOCKED | wait Point49 merge → retarget to `main` → reconcile → fresh CI/review/merge |
| AI Point51 | AI #212 | 🟠 IN PROCESS | independent review/merge + real-device camera/mobile UAT |
| Trace Point95/99 | Trace #38 | 🟡 BLOCKED | Core #300 production release/verification → Trace exact-head recertification → review/merge |
| Buyer App | current `main`, no open PR at census | 🔴 NOT CLEARED | recertify current Buyer journeys against canonical Core; open a bounded Buyer PR only for an evidenced defect |
| Point100 | Central #559 draft | ⚪ LOCKED | wait declared software upstreams → reconcile current authority pins → final exact-head rehearsal/review |
| Physical/provider UAT | cross-programme evidence | 🔴 NOT CLEARED | scanner/printer/TV/handheld/Security Gate/Buyer phone/payment/provider evidence as applicable |
| Production Readiness | Mission Control | ⚪ LOCKED | Point100 + security + WhatsApp live + external evidence + deployment/rollback/observability reconciliation |
| APPVERSE COMPLETE | Mission Control | ⚪ LOCKED | Production Readiness CLEARED and no launch blocker |

## Buyer App rule

No open PR existed in `oasisbaklawa2006/oasis-baklawa` at the final-linking census. Mission Control must **not invent a Buyer PR for symmetry**. Buyer App must first be recertified on its current `main` against canonical Core authority. Only an evidenced Buyer-owned defect may generate a bounded Buyer ASM item/PR.

## Point100 rule

Central #559 remains a draft final integrated software certification lane. It must stay locked until every mandatory software upstream declared in `dependency-graph.json` reaches its required merge/release state. Before final certification, Point100 must:

1. reconcile onto then-current Central `main`;
2. update exact upstream authority pins/evidence;
3. execute the full software rehearsal and negative-path suite against those final authorities;
4. obtain independent review;
5. remain explicit that physical/provider evidence is separate and cannot be inferred from a software PASS.

## Link-integrity enforcement

The dependency graph is enforced by:

- `scripts/appverse-control/check_dependency_graph.py`
- `.github/workflows/appverse-link-integrity.yml`

The guard fails on:

- missing or one-sided dependency edges;
- dependency cycles;
- undeclared stacked feature branches;
- any second final stacked PR besides AI Point50 → Point49;
- missing Core #300 → Trace #38 release ordering;
- Point100 omitting a mandatory software upstream;
- Production Readiness omitting Point100, Core security, WhatsApp live certification, or physical/provider UAT;
- APPVERSE COMPLETE bypassing Production Readiness;
- production safety gate or repository authority being weakened in the graph.

This check is deliberately programme-control-only. It does not grant Mission Control permission to mutate another repository's code.

## Current programme index

| ID | Stage | State | Active authority / PR | Immediate next gate |
|---|---|---|---|---|
| 00 | Architecture & Governance | 🟠 IN PROCESS | Central #589; APPVERSE-LINK-01 | merge current graph/guard; clear Central governance |
| 01 | Database / Schema / Migrations | 🟠 IN PROCESS | Core #300/#307 | exact-head review + protected release + production verification |
| 02 | Authentication / RBAC | 🟠 IN PROCESS | Central #588 | protected merge + live Buyer login verification |
| 03 | Core Backend Authority | 🟠 IN PROCESS | Core #289/#300/#307/#308/#309 | close independent Core release lanes |
| 04 | Central App Foundation | 🟠 IN PROCESS | Central #588/#589/#559 | clear #588/#589; Point100 remains downstream |
| 05 | Order / Pre-Factory Commercial Flow | 🔴 NOT CLEARED | Central #559 downstream | final authority-bound Point100 rehearsal |
| 06 | WhatsApp | 🟠 IN PROCESS | Core #308/#309 | protected releases + live provider zero-loss certification |
| 07 | RGS | 🔴 NOT CLEARED | — | remaining physical handheld/TV/operator UAT |
| 08 | 3PGS | 🔴 NOT CLEARED | — | final whole-chain/physical confirmation |
| 09 | Packing & Assembly | 🔴 NOT CLEARED | — | physical-device UAT + whole-chain confirmation |
| 10 | Production Departments | 🔴 NOT CLEARED | — | real TV/handheld/operator certification |
| 11 | Dispatch | 🔴 NOT CLEARED | Core #300; Trace #38; Central #559 | Core release → Trace recert → Point100 + physical Gate/scan proof |
| 12 | Finance & Accounts | 🟠 IN PROCESS | Core #289; Central #559 | Core release/runtime proof → Point100 Finance recertification |
| 13 | Buyer App | 🔴 NOT CLEARED | current main; no open PR | current-main journey recertification + real-phone/provider evidence |
| 14 | AI Studio | 🟠 IN PROCESS | AI #210/#211/#212 | Point49 → retarget Point50; Point51 review/device evidence |
| 15 | Trace | 🟠 IN PROCESS | Core #300; Trace #38 | Core production authority first, Trace consumer second |
| 16 | Cross-App Integration | 🟠 IN PROCESS | APPVERSE-LINK-01; Central #559 | enforce graph; converge producers before consumers |
| 17 | Automated Testing / Certification | 🟠 IN PROCESS | active exact-head lanes + Point100 | finish exact-head gates then final rehearsal |
| 18 | Security / Governance | 🟠 IN PROCESS | Central #589; Core #307 | clear governance/security protected release evidence |
| 19 | UI / UX Completion | 🔴 NOT CLEARED | Central #588; AI #212; Trace #38 | finish software surfaces + device evidence |
| 20 | End-to-End Certification | ⚪ LOCKED | Central #559 | unlock after mandatory software upstream convergence |
| 21 | Production Readiness | ⚪ LOCKED | Mission Control | Point100 + live/provider/physical + release reconciliation |
| 22 | **APPVERSE COMPLETE** | ⚪ LOCKED | Mission Control | Production Readiness CLEARED |

## Live evidence

Objective GitHub facts may be refreshed under `appverse-control/generated/` on the dedicated `mission-control/live-state` branch. Generated live facts may change evidence/alerts, but they must never silently overwrite semantic clearance in `state.json`.

## Thread routing contract

Every execution instruction must declare at least:

- `ASM-ID`
- `THREAD-ID`
- `REPOSITORY`
- `MISSION`
- `DEPENDENCIES`
- `STOP CONDITION`

Programme-wide final-linking work belongs to `APPVERSE-LINK-01` in Mission Control. Repository implementation work must be split/routed to the owning repository and must preserve the dependency/stop conditions from the graph.

For a truly mismatched instruction, the receiving repository agent must still fail closed:

> `ROUTING REJECTED — instruction does not belong to this thread.`
>
> `Likely ASM route: <workstream/ID>. No code, PR, migration, deployment, or scope expansion performed.`

Cross-scope discoveries return to Mission Control for reassignment. They are not fixed opportunistically across repository boundaries.

## Authority hierarchy

1. **Mission Control / ASM** — sequence, scope, dependencies, stage truth.
2. **Repository authority documents and ownership rules** — technical mutation boundaries.
3. **Execution agent/thread** — implementation of its assigned ASM item only.
4. **CI/review systems** — evidence and findings, not programme direction.

If these conflict, execution stops fail-closed and routes the conflict to Mission Control.
