# Oasis Central Execution OS — One Phase = One Command

**Purpose:** Every bounded architectural phase ships in **one execution cycle** — implementation, hardening, tests, docs, staging validation, Bugbot readiness, merge discipline, and forbidden-scope enforcement. No fragmented follow-up prompts unless a real defect, CI failure, or staging issue appears.

**Applies to:** All Execution OS phases after PR #104 (entity graph / work queues foundation).

---

## Phase header (fill per command)

| Field | Value |
|-------|--------|
| **Phase** | _e.g. 3A/3D — Durable queues + operational events_ |
| **Target PR** | _e.g. feat(execution): add durable queue and operational event foundation_ |
| **Branch** | _e.g. `cursor/execution-os-phase3a3d-foundation-6c20` from latest `main` OR named dependency branch_ |
| **Mission** | _One sentence: what architectural capability this phase adds_ |

---

## Strict in-scope

**Allowed (customize per phase):**

- Named folders, contracts, repositories, migrations
- Authority guards for this phase’s write surface only
- In-memory + Supabase adapters where persistence applies
- Read-only UI shells only if phase explicitly includes UI (projection)
- Staging validation doc + SQL snippets when migrations exist

**Required in every phase:**

- Implementation
- Hardening (locking, authority, transitions, audit linkage)
- Tests (scoped to phase libs)
- Docs (phase doc + staging checklist if migrations)
- Authority validation
- Grep validation (forbidden writes + business actions)
- Merge readiness section in output

---

## Strict out-of-scope (default deny list)

Unless the phase charter **explicitly** authorizes an item, forbid:

| Category | Examples |
|----------|----------|
| Finance | approval, release, hold clearance |
| Commercial | invoice generation, payment capture |
| Inventory | stock reservation, stock deduction |
| Dispatch | dispatch completion, gate release without authority PR |
| Customer | public timeline binding, unsafe status leakage |
| Platform | Edge function edits, package.json changes |
| Automation | hidden writes, AI auto-actions, silent retries |
| Scope creep | unrelated refactors, duplicate #104/#105 commits on rebase |

---

## Implementation checklist

Define and deliver:

- [ ] Exact folders and files
- [ ] Contracts (types, repositories, state machines)
- [ ] Migrations (if any) — idempotent, commented, RLS documented
- [ ] UI surfaces (only if in charter)
- [ ] Authority matrix for **this phase’s actions only**
- [ ] Lifecycle states + legal transitions
- [ ] Event model (append-only where applicable)
- [ ] Rollback model (compensating events, no destructive delete)
- [ ] Idempotency keys + correlation_id
- [ ] Optimistic concurrency (`version` or equivalent)
- [ ] Customer-safe separation (internal vs public_candidate; no publish in phase)

---

## Hardening requirements

| Rule | Requirement |
|------|-------------|
| Locking | Optimistic version check on mutable rows |
| Events | Append-only; UPDATE/DELETE blocked (DB + TS helpers) |
| Authority | Every write path calls guard; unknown action denies |
| Transitions | Pure validator before persistence |
| Stale version | Fail safe with clear error |
| Duplicates | Partial unique indexes or idempotency dedupe |
| Destructive flows | Non-empty typed reason (cancel, fail, override) |
| Audit | Queue/event linkage; actor + correlation on every write |
| Deny by default | No `*` admin on routes unless explicit charter |

**Never:** silent mutations, bypass helpers, hidden state changes.

---

## Tests

**Add (as applicable):**

- Lifecycle: happy path + illegal transitions + terminal states
- Authority: unknown denied, scope denied, SUPER_ADMIN vs ADMIN rules
- Stale version rejection
- Event immutability helpers
- Customer-safe suppression (if customer libs touched)
- Idempotency dedupe
- Escalation / propagation (if phase includes it)

**Run:**

```bash
npm run typecheck
npm run build
npm run test -- --run <scoped paths for this phase>
```

---

## Grep validation

Run on **changed files only**:

```bash
# Structural forbidden patterns
rg '\.delete\(|\.upsert\(|\.rpc\(|functions\.invoke|fetch\(|console\.log|TODO|unsafe|forceBypass|hardcoded|\bany\b' <paths>

# Business forbidden (must be absent or deny-list only)
rg 'approveCredit|capturePayment|generateInvoice|markDispatched|reserveStock|deductStock|sendNotification' <paths>
```

**Allowed `.insert(` / `.update(`** only in documented repository paths for this phase. Document every match in the **grep exception table** in the phase output.

---

## Staging validation (if migrations)

Create or update:

`docs/EXECUTION_OS_<PHASE>_STAGING_VALIDATION.md`

Include:

- Pre/post apply checklist
- SQL: table/index/policy existence
- RLS: staff read, limited write, anon/customer deny
- Immutability: UPDATE/DELETE fail on append-only tables
- Partial unique / idempotency behavior
- service_role notes (RLS bypass vs trigger immutability)
- Post-dependency rebase commands
- Sign-off gates

**Order:** staging first — not production first.

---

## Bugbot + review readiness

Before marking phase complete, proactively check:

| Class | Mitigation |
|-------|------------|
| Auth drift | Route guard matches sidebar (`adminModuleAccess` ↔ `AdminLayout`) |
| Wildcard ADMIN | No `["*"]` broader than nav |
| Substring suppression | Customer-safe labels word-boundary or token list |
| Pressure coercion | `null` vs `0` for disconnected feeds |
| Scope leakage | Grep + charter review |
| Dual truth | Document projection vs persistence |

---

## Merge discipline

State in phase output:

| Item | Description |
|------|-------------|
| **Depends on** | PR numbers that must merge first |
| **Rebase** | Onto `main` after dependencies; no duplicate commits |
| **Migration** | Staging apply + checklist before prod |
| **CI** | typecheck, build, scoped tests green |
| **Bugbot** | Clean or documented false positives |

**Do not merge if:**

- Scope expanded beyond charter
- Forbidden business actions appear in code paths
- Authority weakened
- Customer-safe leaks internal terms
- Write boundaries blur (UI calling DB without repository)

---

## Expected output (agent return template)

1. **PR summary** — what shipped, what forbidden  
2. **Architecture summary** — diagram or table  
3. **Migration summary** — tables, RLS, triggers (if any)  
4. **Repository summary** — write contract  
5. **Authority summary** — actions allowed/denied  
6. **Lifecycle summary** — states and transitions  
7. **Tests added** — count and focus  
8. **Verification table** — typecheck, build, tests  
9. **Grep exception table** — allowed `.insert`/`.update` only  
10. **Staging checklist summary** — doc path + key gates  
11. **Remaining blockers** — next phase only, not this PR  
12. **Merge recommendation** — ready / blocked + why  

---

## Commit grouping

Use separate commits when possible:

1. `migration:` — SQL only  
2. `feat(core):` — types, lifecycle, contracts  
3. `feat(repository):` — persistence adapters  
4. `feat(authority):` — guards and matrix  
5. `feat(ui):` — only if UI in charter  
6. `test:` — scoped tests  
7. `docs:` — phase + staging validation  

Single commit acceptable for small phases; grouped commits preferred for review.

---

## Phase map (reference)

| Phase | PR focus | Persistence | UI writes |
|-------|----------|-------------|-----------|
| 3A/3D | Queue + event foundation | Yes | No |
| 3B | Execution actions (allowed list) | Uses 3A/3D | Gated buttons later |
| 3C | Barcode execution records | Yes | Scanner UI later |
| 3E | CMD execution center | Read + persistent | Display only first |
| 3F | Department boards | Uses queues | Per-charter |
| 3G | Authority matrix expansion | — | — |
| 3H | Customer timeline from events | Events only | Public bind later |

---

## Final rule

**One command envelope = one complete bounded phase.**

Fragmented follow-ups are only for:

- Bugbot defects (real, reproducible)
- CI failures
- Staging checklist failures
- Explicit scope correction from maintainer

Otherwise: ship implementation + hardening + tests + docs + staging doc + review readiness in the same cycle.

---

## Example command (copy for next phase)

```
ONE PHASE COMMAND — [PHASE NAME]
OASIS CENTRAL EXECUTION OS

Branch from: [main | branch] after PR #[N] merged.

Phase: [NAME]
Target PR: [title]
Mission: [one line]

Strict in-scope: [bullets]
Strict out-of-scope: [bullets + default deny list]

Implement: [folders/files]
Harden: [locking, authority, events, reasons]
Test: [paths]
Docs: [phase doc + staging validation if migration]
Grep + verify + merge discipline per EXECUTION_OS_ONE_PHASE_COMMAND_FRAMEWORK.md

Do not expand scope.
```
