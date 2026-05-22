# C2C — Staging write pilot master plan

**Status:** Architecture and governance design only. **No** migrations, Edge edits, client invokes, TOOL 5 implementation, queues, or production writes.

**Depends on:** `docs/C2C_MASTER_AUTHORITY_AND_WRITE_SAFETY_BLUEPRINT.md`, `docs/C2C_WRITE_PATH_THREAT_MODEL.md`, `docs/C2C_IMPLEMENTATION_GATING_MATRIX.md`, `docs/C2C_SAFE_SEQUENCE_ROADMAP.md`.

---

## 1. Pilot purpose

### Why staging-only

- **Isolates blast radius:** Mistakes in JWT binding, RLS gaps, idempotency, or audit pipelines must not reach customers or production finance/ops data.
- **Allows adversarial testing:** Scripted duplicate invokes, cross-tenant packet IDs, stale versions, and supervisor overrides can be exercised without regulatory or brand exposure.
- **Preserves production freeze:** The org-wide rule that **production write-path expansion remains frozen** continues until explicit sign-off after staging evidence.

### What risks are being isolated

| Risk category | Isolated how |
|---------------|----------------|
| Duplicate customer-visible sends | Staging numbers / test WABA only; idempotency keys tested before any prod traffic. |
| IDOR / packet hijack | Staging RLS parity reviews; penetration-style tests against real-shaped JWTs. |
| Audit loss or tampering | Staging append-only sink; permission tests proving UPDATE/DELETE denied on audit rows. |
| Automation runaway | No production queue; staging flags bound to named operators only. |
| Role escalation | Staging role matrix enforced in Edge + integration tests for forbidden paths. |

### Why production remains frozen

Production stays frozen until **all** of the following are true (non-exhaustive; see §6):

1. Immutable audit is **live and verified** for every pilot mutation class.  
2. JWT verification and **role allowlists** are proven in staging with negative tests.  
3. **Replay protection** and **optimistic locking** prevent duplicate and stale writes in stress tests.  
4. **Rollback** and **operator lockout** procedures are rehearsed (tabletop + technical).  
5. Authority stakeholders sign that **pilot success criteria** (§7) were met with evidence artifacts (logs, dashboards, replay dumps).

---

## 2. Candidate pilot actions (conceptual only)

These are **candidates** for the first bounded staging pilots. They do **not** exist as approved implementations in this repo track.

| Action | Conceptual intent | Notes |
|--------|-------------------|--------|
| **Packet reassignment** | Move ownership / queue assignment from A → B within policy. | Requires immutable audit + supervisor boundary + conflict rules. |
| **Route override** | Human selects non-default route after suggestion or policy exception. | Must not trust client intent blobs without server re-fetch. |
| **Operator acknowledgement** | Explicit ack that suggestion / SLA risk was seen before next automation step. | Breaks silent automation chains. |
| **Priority change** | Adjust explicit priority field on packet or internal task object. | Rate-limited; reason mandatory; supervisor cap optional. |
| **Escalation request** | Signal upstream team; may create ticket or flag — **not** auto customer message. | Abuse controls in threat model apply. |

---

## 3. Explicit non-pilot exclusions

The following are **out of scope** for the **initial** staging write pilot waves unless a separate authority CR expands the pilot:

- **Finance mutations** (credits, invoices, release holds tied to WhatsApp, etc.).
- **Auto-send** of WhatsApp messages without a human in the loop for that send unit.
- **Production order creation** or extraction into ERP from pilot paths.
- **Dispatch automation** (carrier labels, warehouse tasks) triggered from pilot.
- **Queue retries** at scale (worker fleets, scheduled replay) — pilot may design **replay logs** but not run production-grade queues.
- **Customer-visible automation** (marketing flows, proactive bulk outreach) without separate product/legal approval.

---

## 4. Pilot architecture

| Layer | Staging-only design expectation |
|-------|----------------------------------|
| **Staging-only Edge** | Functions deployed to **staging** project or staging alias; `verify_jwt` on; no browser path to prod Edge for pilot mutations. |
| **Staging-only audit** | Append-only audit table(s) or sink in **staging** first; retention and PII redaction policy documented before prod mirror. |
| **Shadow mode** | Compute intended mutation + diff; **log only**; no row change or external API call. |
| **Dry-run mode** | Transactional apply with **rollback** at end of request, or “would mutate” response for UI training. |
| **Replay logs** | Deterministic input/output capture for regression replay in lower env. |
| **Immutable audit expectation** | Every successful or rejected mutation attempt produces an **append** row (or structured log shipped to WORM/SIEM) with actor, correlation id, version, outcome. |
| **Rollback expectations** | Feature flags off → no new mutations; **audit never deleted**; compensating forward entries if business reversal needed; Edge version pin documented. |

---

## 5. Authority boundaries (pilot)

| Principal | Allowed (pilot scope) | Forbidden | Enforcement |
|-----------|----------------------|-----------|-------------|
| **Operator** | Ack; limited priority suggestion within bounds; initiate escalation **request**. | Reassign across business units; finance; raw service role. | Edge + RLS + UI module keys. |
| **Supervisor** | Reassignment within team tree; route override with reason; ack on behalf of team only if policy allows. | JWT admin; audit tamper; prod config. | Same + higher audit visibility. |
| **Admin** | Pilot feature flags in staging; user provisioning for pilot cohort. | Disable audit; bypass JWT for user paths. | Break-glass separate procedure. |
| **service_role** | Internal replay workers **only** in locked-down network path; no browser. | Exposed `invoke` from client. | Network + secret + allowlist. |

---

## 6. Safety gates before pilot (checklist)

Gates must be **green with evidence links** (run URLs, report hashes, ticket ids):

- [ ] **JWT verified** on every pilot Edge entrypoint.  
- [ ] **Immutable audit live** — append-only verified by permission test.  
- [ ] **Replay protection** — duplicate POST does not double-apply.  
- [ ] **Optimistic locking** — stale version rejected with actionable error to UI.  
- [ ] **Role allowlists** — negative matrix tests for each forbidden row in §5.  
- [ ] **Observability ready** — see `docs/C2C_WRITE_OBSERVABILITY_REQUIREMENTS.md`.  
- [ ] **Rollback ready** — see `docs/C2C_ROLLBACK_AND_RECOVERY_STRATEGY.md`.

---

## 7. Pilot success criteria

| Criterion | Measurable signal |
|-----------|---------------------|
| **No duplicate writes** | Idempotency metrics: duplicate key hits return single external effect count = 0 in stress suite. |
| **No unauthorized writes** | 100% of denied attempts logged with reason; penetration suite passes. |
| **No lost audit events** | Audit row count vs mutation attempt count reconciles; zero drops in load test. |
| **Deterministic replay** | Same captured inputs → same decision branch in replay harness. |
| **Rollback tested** | Flag-off drill: no new mutations; existing data consistent; audit intact. |

---

## 8. Pilot stop conditions

**Immediate halt** (incident commander + eng on-call):

- **Auth mismatch** — any 401/403 spike tied to pilot endpoints or wrong principal recorded.  
- **Duplicate actions** — duplicate customer message or duplicate route application in staging.  
- **Stale write conflicts** — unresolved conflict rate above agreed SLO without safe UI resolution.  
- **Audit gaps** — missing rows for known mutation attempts.  
- **Replay inconsistencies** — replay harness diverges from live trace for same inputs.

**Resume path:** Root-cause doc, code/config fix in **non-production** only, re-run full gate checklist (§6) before resuming pilot.

---

## Handoff

- Sequence alignment: `docs/C2C_SAFE_SEQUENCE_ROADMAP.md` **Phase 2–3**.  
- Lifecycle detail: `docs/C2C_WRITE_LIFECYCLE_SEQUENCE.md`.  
- Ops detail: `docs/C2C_ROLLBACK_AND_RECOVERY_STRATEGY.md`, `docs/C2C_WRITE_OBSERVABILITY_REQUIREMENTS.md`.
