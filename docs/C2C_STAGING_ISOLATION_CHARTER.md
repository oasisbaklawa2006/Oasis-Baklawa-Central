# C2C — Staging isolation charter

**Purpose:** Define **non-negotiable** isolation rules so a staging dry-run pilot cannot harm production customers, production money movement, or production messaging. **Design / governance doc only.**

---

## 1. Why staging isolation matters

A single leaked **production service role key**, **shared queue**, or **provider credential** in staging can cause **real sends**, **real money effects**, or **data exfiltration**. Dry-run pilots are only safe when isolation is **provable**, not assumed.

---

## 2. What must NEVER touch production

| Class | Rule |
|-------|------|
| Supabase **URL / anon / service role** keys | Staging keys must **only** authenticate to staging project |
| Edge function **invoke URLs** | Staging builds must target staging-only function hosts |
| Provider API keys (WhatsApp, email, SMS) | Staging uses **mock** or **sandbox** credentials — never production billing / production sender IDs for pilot |
| Customer PII payloads | No production DB snapshots in staging for pilot exercises |
| **Cron** or **webhooks** that hit staging must not **fan out** to prod callbacks |

---

## 3. Environment separation requirements

- Distinct **Supabase project** (recommended) **or** formally reviewed alternative with cryptographically distinct keys and network egress controls.
- Distinct **frontend environment** variables (`VITE_*` or equivalent) verified by a **human-readable staging banner** at runtime (implementation phase).
- CI/CD: staging deploy pipeline **cannot** promote to production without a separate manual gate (process-level).

---

## 4. Queue separation requirements

- Simulated dry-run queue **must not** share consumer groups, table names without prefix, or Redis DB index with production.
- Dead-letter queues for staging **must** be staging-prefixed (`dryrun_dlq_*`).

---

## 5. Credential separation requirements

- **Rotation:** Rotating staging credentials must never require touching production secrets in the same change request.
- **Storage:** Staging secrets in a separate vault path / GitHub environment.
- **Local dev:** Developer laptops must not default to production keys when running “staging dry-run” scripts.

---

## 6. Audit separation requirements

- Simulated audit tables or streams are **staging-only**; export formats must be labeled `STAGING — NOT LEGAL EVIDENCE FOR PROD`.
- No replication job from staging audit → production audit.

---

## 7. Replay isolation requirements

- Replay keys and idempotency stores are **staging-local**; never sync to prod.
- Load tests against staging must not use production idempotency key namespace.

---

## 8. Operator isolation requirements

- Staging operator accounts are **not** production admin accounts (separate IdP user or clearly separated role mapping).
- Training: operators use **only** staging URLs during dry-run exercises.

---

## 9. Finance isolation requirements

- Dry-run code paths **must not** import or call finance modules, RPCs, or tables (`wallet_*`, `commission_*`, `order_payments`, etc.) — **static allowlist** in future CI for pilot package.
- No “simulate finance” in v1 pilot — **excluded** by design.

---

## 10. Test-data requirements

- Synthetic companies, orders, and contacts created **in staging only** with naming prefix `DRYRUN_`.
- Phone numbers: use **non-routable** test patterns agreed with compliance (e.g. reserved ranges) — **not** real customer numbers.

---

## 11. Rollback isolation requirements

- Rollback drills affect **only** staging dry-run aggregate tables / feature flags.
- Kill switch for dry-run must not disable unrelated production features (separate flag namespace: `dryrun.*`).

---

## 12. Emergency shutdown principles

1. **First action:** disable dry-run feature flag or worker in **staging** (not prod).
2. **Verify:** egress logs show **zero** provider calls after shutdown.
3. **Preserve:** staging logs for post-mortem.
4. **Communicate:** internal incident channel; **no** customer comms required if isolation holds.
5. **Re-open:** only after root cause and checklist updates in `C2C_PRE_PILOT_GO_NO_GO_CHECKLIST.md`.

---

## Cross-links

- `C2C_FIRST_STAGING_DRYRUN_PILOT.md`
- `C2C_DRYRUN_OBSERVABILITY_SPEC.md`
- `C2C_PRODUCTION_WRITE_FREEZE_CHARTER.md`
