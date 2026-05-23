# C2C — Pre-pilot go / no-go checklist

**Purpose:** Gate **staging dry-run execution** (future work). **Design-only** — unchecked items mean **NO-GO** for starting the dry-run pilot in an environment.

Each section: **Evidence required** · **Blocker severity** · **Must-pass? (Y/N)**

**Severity:** **P0** = hard stop · **P1** = stop unless written waiver + extra controls · **P2** = should fix, not a hard stop alone

---

## 1. JWT readiness

| Field | Content |
|-------|---------|
| Evidence required | Documented ingress for **every** dry-run entrypoint: JWT verify **or** equivalent (mTLS/HMAC) in **staging**; test curl showing rejection without auth |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 2. Replay protection readiness

| Field | Content |
|-------|---------|
| Evidence required | Replay of captured request within TTL returns `duplicate_suppressed` or identical `dry_run_outcome_id` — test log attached |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 3. Idempotency readiness

| Field | Content |
|-------|---------|
| Evidence required | Double-submit and two-tab script results; zero duplicate logical sends |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 4. Queue isolation readiness

| Field | Content |
|-------|---------|
| Evidence required | Proof simulated queue uses staging-only resources (prefix list or separate project id); no prod queue names |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 5. Rollback readiness

| Field | Content |
|-------|---------|
| Evidence required | Timed rollback drill log meeting SLO in `C2C_FIRST_STAGING_DRYRUN_PILOT.md` design |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 6. Observability readiness

| Field | Content |
|-------|---------|
| Evidence required | Dashboard or query pack live in staging; alerts configured for `DryRunRealProviderCall` and `DryRunProdKeyFingerprint` |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 7. Audit readiness

| Field | Content |
|-------|---------|
| Evidence required | Sample export showing `audit_written_at` always precedes `mock_sent_at`; no `completed` without audit |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 8. Operator training readiness

| Field | Content |
|-------|---------|
| Evidence required | Attendance sheet + acknowledgment of “no prod numbers” and “DRY-RUN banner” rules |
| Blocker severity | **P1** |
| Must-pass? | **Y** |

---

## 9. Test-data readiness

| Field | Content |
|-------|---------|
| Evidence required | List of synthetic contacts/phones (`DRYRUN_*`) created in staging; no prod PII |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 10. Staging isolation readiness

| Field | Content |
|-------|---------|
| Evidence required | Completed checklist sign-off against `C2C_STAGING_ISOLATION_CHARTER.md` with key fingerprints recorded |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 11. Production freeze confirmation

| Field | Content |
|-------|---------|
| Evidence required | Link or screenshot to active `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md` acknowledgment; deploy pipeline shows prod not targeted |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## 12. Emergency stop readiness

| Field | Content |
|-------|---------|
| Evidence required | Runbook URL + dry-run kill switch location + who can execute; test: flag off → zero mock “send” spans for 15 minutes |
| Blocker severity | **P0** |
| Must-pass? | **Y** |

---

## Final decision line (fill at review)

| Decision | GO / NO-GO |
|----------|------------|
| Date | |
| Approvers | |
| Waivers (if any) | |

---

## Cross-links

- `C2C_FIRST_STAGING_DRYRUN_PILOT.md`
- `C2C_STAGING_ISOLATION_CHARTER.md`
- `C2C_DRYRUN_OBSERVABILITY_SPEC.md`
- `C2C_REAL_WRITE_BLOCKERS_AFTER_DRYRUN.md`
