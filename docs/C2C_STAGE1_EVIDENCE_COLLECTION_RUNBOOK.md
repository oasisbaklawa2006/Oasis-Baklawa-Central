# C2C — Stage 1 evidence collection runbook

**Purpose:** Step-by-step **how to collect** each P0 evidence packet when program leadership authorizes **evidence work only** (still **no** unauthorized runtime). **Status for all packets: MISSING** until artifacts attach and reviewers accept.

**Related:** `C2C_STAGE1_CONTROL_DASHBOARD.md`, `C2C_STAGE1_AUTHORITATIVE_OWNER_STATUS_MATRIX.md`, `C2C_SAMPLE_EVIDENCE_BUNDLE_TEMPLATE.md`, `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`.

**Attachment hub (suggested):** versioned path under `docs/evidence/stage1/` **or** immutable ticket / object store link — record in `C2C_STAGE1_STATUS_TRANSITION_LOG.md` when moving status.

---

## How to read each section

Fields **1–8** below. **Owner** = primary **role** from matrix. **Blocks Stage 1:** **YES** for all until **MISSING** clears per workflow.

> **Packet index note:** `C2C_STAGE1_EVIDENCE_PACKET_INDEX.md` also lists **Kill-switch proof** as its own row; treat as **same drill family** as rollback or attach a **distinct** halt attestation — either way must satisfy index + pre-pilot §12.

---

### 1. Staging isolation proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** staging project id, key fingerprints, egress denylist / allowlist export, diagram showing no prod queue URLs / prod DB strings. |
| 2 | **Acceptable:** signed export PDF, redacted `terraform`/config snapshot, ticket with hashes + reviewer initials (no secrets). |
| 3 | **Not acceptable:** “trust me” prose; unstamped screenshots of ambiguous env vars; shared prod keys. |
| 4 | **Owner:** **Staging Operations Lead** (backup **Platform Lead**). |
| 5 | **Attach:** `docs/evidence/stage1/` or ticket URL in log + matrix path column. |
| 6 | **Pass:** demonstrates **staging-only** resources per charter. |
| 7 | **Fail:** any prod identifier overlap without written waiver. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 2. JWT / auth proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** matrix of entrypoints × auth outcome (401 unauthenticated, 200 valid, 403 wrong role) with redacted headers. |
| 2 | **Acceptable:** `jwt-matrix.jsonl` + short README; CI or curl log excerpts. |
| 3 | **Not acceptable:** single happy-path curl only; live tokens pasted in full. |
| 4 | **Owner:** **Identity / JWT Reviewer** (backup **Security Lead**). |
| 5 | **Attach:** evidence hub + link in matrix. |
| 6 | **Pass:** **every** dry-run entrypoint covered. |
| 7 | **Fail:** anonymous access succeeds. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 3. Operator identity proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** negative tests rejecting spoofed / unauthorized `operator_id` / session. |
| 2 | **Acceptable:** test log with case ids; security review note. |
| 3 | **Not acceptable:** only positive-path admin test. |
| 4 | **Owner:** **Identity / JWT Reviewer** (backup **Security Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** rejects invalid operator consistently. |
| 7 | **Fail:** privilege escalation possible on paper. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 4. Idempotency proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** double-submit + two-tab script; dedupe store behavior logs. |
| 2 | **Acceptable:** timestamped logs showing single logical outcome. |
| 3 | **Not acceptable:** manual “I clicked once” note. |
| 4 | **Owner:** **Platform Lead** (backup **Release Authority**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** zero duplicate logical sends under test. |
| 7 | **Fail:** duplicate side effects observed. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 5. Replay proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** replay captured request within TTL; expect suppress / stable id. |
| 2 | **Acceptable:** paired request/response logs with ids. |
| 3 | **Not acceptable:** one-off manual retry without TTL boundary. |
| 4 | **Owner:** **Identity / JWT Reviewer** (backup **Security Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** duplicate_suppressed or identical dry-run outcome id per design. |
| 7 | **Fail:** second side effect on replay. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 6. Duplicate-send proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** load or soak run in **staging** with send counters / metrics. |
| 2 | **Acceptable:** CSV or query export of logical send count = 1 per id. |
| 3 | **Not acceptable:** developer laptop only, no staging footprint. |
| 4 | **Owner:** **Platform Lead** (backup **Release Authority**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** count invariant under declared load. |
| 7 | **Fail:** >1 logical send for same idempotency key. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 7. Audit proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** ordered audit ids; failure injection showing `audit_written_at` precedes completion / mock send markers. |
| 2 | **Acceptable:** `audit-chain.json` + narrative; finance review if in scope. |
| 3 | **Not acceptable:** DB dump with PII; missing ordering. |
| 4 | **Owner:** **Audit Lead** (backup **Finance Authority Reviewer**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** matches pre-pilot §7 ordering rules. |
| 7 | **Fail:** completed without audit trail on any case. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 8. Rollback proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** dated kill-switch / rollback drill log meeting SLO in pilot design doc. |
| 2 | **Acceptable:** `rollback-drill.log` with timestamps + verifier sign-off (role, not forged personal name). |
| 3 | **Not acceptable:** tabletop-only narrative without timed drill. |
| 4 | **Owner:** **Rollback Authority** (backup **Staging Operations Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** meets SLO; halt verified. |
| 7 | **Fail:** drill exceeds SLO or halt not observed. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 9. Observability proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** live staging dashboard capture + metric/query definitions for pilot signals. |
| 2 | **Acceptable:** URLs + screenshot PDF + `dashboards.md` excerpt. |
| 3 | **Not acceptable:** localhost-only Grafana. |
| 4 | **Owner:** **Observability Lead** (backup **Platform Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** tiles cover dry-run critical paths per spec. |
| 7 | **Fail:** blind spots on provider call / prod fingerprint alerts. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 10. Alert proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** inject fault; capture page / ticket receipt for P0 routes (`DryRunRealProviderCall`, `DryRunProdKeyFingerprint`, etc. per checklist). |
| 2 | **Acceptable:** `alert-test-042.txt` style receipt + routing proof. |
| 3 | **Not acceptable:** “alerts exist” config export without fired alert. |
| 4 | **Owner:** **Observability Lead** (backup **Staging Operations Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** on-call path proven end-to-end. |
| 7 | **Fail:** silent failure or wrong severity route. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 11. Queue-disabled proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** snapshot showing `disabled` / worker off **or** strict staging-only queue isolation per §4. |
| 2 | **Acceptable:** `queue-snapshot.json` + narrative mapping to prod non-overlap. |
| 3 | **Not acceptable:** undocumented “queues not used” claim. |
| 4 | **Owner:** **Staging Operations Lead** (backup **Platform Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** no prod queue bleed. |
| 7 | **Fail:** shared namespace or prod name visible. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 12. No-send proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** distributed trace / log proving **zero** real provider send on dry-run path. |
| 2 | **Acceptable:** trace id + span summary redacted. |
| 3 | **Not acceptable:** code inspection only. |
| 4 | **Owner:** **Platform Lead** (backup **Release Authority**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** zero outbound provider send spans. |
| 7 | **Fail:** any real send span. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 13. No-production-write proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** pipeline screenshot + config proving prod targets disabled; freeze charter acknowledgment link. |
| 2 | **Acceptable:** CI config export + `FREEZE.md@sha` reference. |
| 3 | **Not acceptable:** verbal confirmation. |
| 4 | **Owner:** **Staging Operations Lead** (backup **Governance Lead**). |
| 5 | **Attach:** evidence hub. |
| 6 | **Pass:** prod write paths unreachable from staging job graph. |
| 7 | **Fail:** ambiguous routing to prod. |
| 8 | **Blocks Stage 1:** **YES** |

---

### 14. Approver signoff proof — **MISSING**

| # | Guidance |
|---|----------|
| 1 | **Collect:** signed PDF or immutable ticket links per `C2C_GOVERNANCE_SIGNOFF_WORKFLOW.md` **after** evidence exists. |
| 2 | **Acceptable:** `approvals.pdf` or ticket IDs with role labels (no forged signatures). |
| 3 | **Not acceptable:** self-approval; chat “LGTM”. |
| 4 | **Owner:** **Release Authority** (custody); independent approvers per separation matrix. |
| 5 | **Attach:** evidence hub + status log. |
| 6 | **Pass:** all required roles signed; SoD satisfied. |
| 7 | **Fail:** missing role or SoD violation. |
| 8 | **Blocks Stage 1:** **YES** |

---

## Roll-up status

| Packet group | Status |
|--------------|--------|
| All sections above | **MISSING** |

No packet may be marked **COMPLETE** in this runbook until governance updates matrix + log per `C2C_STAGE1_OWNER_ASSIGNMENT_RULES.md`.
