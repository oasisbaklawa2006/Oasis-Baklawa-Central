# C2C — Current safe boundary

**Purpose:** Explicit **SAFE** vs **NOT SAFE** boundary for the C2C program **today**. Crossing into NOT SAFE requires **`C2C_EXECUTION_AUTHORIZATION_PRECONDITIONS.md`** and signed workflows — not a verbal OK.

---

## SAFE (allowed without additional C2C authorization)

- **Read-only** operator inbox UX (load packets, read messages, suggestions that do not auto-persist routing decisions).  
- **localStorage-only** features (filters, notes, saved views) — must never be treated as server authority.  
- **Docs** under `docs/C2C_*.md` and updates to governance artifacts.  
- **Types** (`src/types/c2c*.ts`) that remain type-only and unwired.  
- **Scaffolds** (`src/config/c2c*.ts`) with all execution flags **`false`** and **not** referenced from runtime paths.  
- **Mock fixtures** (`c2cMockStateFixtures.ts`) for docs/tests only.  
- **Observability planning** (dashboard specs, log field definitions) without wiring to prod.

---

## NOT SAFE (forbidden without thaw + evidence + approvals)

- **Real sends** (WhatsApp, SMS, email) under C2C pilot track.  
- **Retries** that hit providers without idempotency and caps.  
- **Queue execution** (workers, browser processors) for pilot-class traffic.  
- **Finance writes** triggered from messaging or pilot shortcuts.  
- **Dispatch writes** from messaging or pilot shortcuts.  
- **Reassignment authority** that changes ownership without locks and audit.  
- **TOOL 5** override or break-glass automation.  
- **Automation escalation** (unsupervised sends or routing persistence).  
- **Production pilots** for C2C expansion without executive + security sign-off.

---

## What crossing this boundary would require

1. **Written GO** against `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md` (staging) or production pilot preconditions.  
2. **Evidence bundle** per `C2C_EVIDENCE_ARTIFACT_STANDARD.md` + `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`.  
3. **Approvals** per `C2C_GOVERNANCE_APPROVAL_MODEL.md` and `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md`.  
4. **Isolation proof** per `C2C_STAGING_ISOLATION_CHARTER.md` / `C2C_STAGING_DATA_ISOLATION_RULES.md`.  
5. **Implementation PRs** that satisfy `C2C_IMPLEMENTATION_ENTRY_CRITERIA.md` and `C2C_IMPLEMENTATION_CONSTRAINTS_FOR_ENGINEERS.md`.  
6. **Rollback drill** log attached for the target environment.

---

## NOT PRODUCTION-WRITE READY

Crossing into customer-visible **production** writes for C2C goals remains **not authorized** by this boundary document alone.

---

## Cross-links

- `C2C_EXECUTION_AUTHORIZATION_PRECONDITIONS.md`  
- `C2C_GOVERNANCE_EVIDENCE_MASTER_INDEX.md`  
- `C2C_EXECUTION_FREEZE_MANIFEST.md`
