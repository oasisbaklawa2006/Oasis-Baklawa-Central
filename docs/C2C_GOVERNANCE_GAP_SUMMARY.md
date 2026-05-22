# C2C — Governance gap summary

**Audience:** Engineering + ops governance for C2C / WhatsApp operator readiness. **Docs only** — this file does not change runtime behavior.

---

## 1. What is already production-safe (relative statement)

- **Established B2B + admin PostgREST model** under current RLS and roles — operationally proven for the business, though not minimal from a C2C “write cone” perspective.
- **Read-heavy dashboards** with polling / realtime refreshes where mutations are not on the hot path.
- **Operator inbox read surfaces** (packets, messages, CSV export of visible data) when backed by correct RLS.

*“Production-safe” here means **acceptable under existing org risk acceptance** — not formally verified in this sprint.*

---

## 2. What is only read-only safe

- **Classify / route suggestions** that never persist automated routing decisions.
- **Local-only** inbox affordances: saved views, filters, notes in `localStorage`.
- **Observability panels** that aggregate counts without mutating authority state.

---

## 3. What is staging-safe only (requires controlled environment)

- **Any new** idempotency / correlation / lock implementation — must be proven under load and chaos in staging.
- **JWT posture changes** for Edge — validate no client regression and no accidental lockout of legitimate webhooks/cron.
- **Outbox worker** migration from browser to server — staging soak for duplicate-tab races.

---

## 4. What is explicitly unsafe today (from C2C hardening lens)

- **Operator reply** without idempotency + ingress JWT verification (`verify_jwt=false` in config) + service-role handler.
- **Client-processed outbox** for anything finance- or legally-sensitive.
- **Assuming UI double-submit prevention == server safety.**
- **Unsupervised automation** on WhatsApp send paths.

---

## 5. Biggest architectural gaps

- Lack of a **single “command bus”** for externally visible side effects (messages, money movement, dispatch) with uniform guards.
- **Split-brain** between Edge (service role) and client PostgREST (JWT + RLS) — two trust models to reason about.
- **No first-class correlation ID** standard across UI, Edge, and DB audit tables.

---

## 6. Biggest authority gaps

- **Actor proof** on Edge write paths with `verify_jwt=false`.
- **Packet / contact / phone coherence** enforcement for operator reply (must be server-side, not UI-only).
- **Separation of duties** not uniformly encoded for finance vs messaging vs dispatch.

---

## 7. Biggest replay / idempotency gaps

- No **Idempotency-Key** contract on `invoke` for sends.
- **Duplicate operator sends** still possible cross-tab / retry.
- **Webhook + cron** replay handling not uniformly documented per handler.

---

## 8. Biggest audit gaps

- **Asymmetric** audit: some failures logged; not all success paths have equal fidelity.
- **`operator_id` in JSON** is not equivalent to cryptographically verified identity at Edge gate.
- **debug_webhooks** volume vs signal — ops noise vs audit truth.

---

## 9. Biggest JWT gaps

- Broad **`verify_jwt = false`** entries in `supabase/config.toml` for sensitive adjacent surfaces.
- Potential mismatch: **client sends JWT**, Edge **ignores** it if not validated in handler code.

---

## 10. Why write freeze still exists

1. **Ingress trust** does not yet meet “staging pilot” bar for C2C-specific goals.
2. **Idempotency + dedupe** not proven for customer-visible sends.
3. **Outbox / queue** semantics are browser-centered for some paths.
4. **Finance + dispatch** races remain a class of issues any messaging expansion could exacerbate (coupled UX).
5. **TOOL 5** and other override tooling intentionally excluded from scope until authority model exists.

---

## 11. Exact prerequisites before any staging write pilot

| # | Prerequisite |
|---|----------------|
| P1 | Signed-off `C2C_REPO_WRITE_SURFACE_INVENTORY.md` + delta review after each merge |
| P2 | `C2C_JWT_AND_TRUST_BOUNDARY_AUDIT.md` remediation plan with per-function ingress decision |
| P3 | Idempotency + correlation design **implemented** (not only documented) for pilot scope |
| P4 | Packet lock / version design for pilot scope |
| P5 | Outbox worker strategy (no multi-tab client processor for pilot-class messages) |
| P6 | Observability: metrics + alerts on duplicate send rate, Edge 4xx/5xx, provider 429 |
| P7 | Failure tabletop (`C2C_FAILURE_SCENARIO_TABLETOP.md`) walkthrough with named approvers |
| P8 | Rollback / kill switch documented and tested in staging |

---

## 12. Exact prerequisites before any production write rollout

All staging prerequisites, plus:

| # | Prerequisite |
|---|----------------|
| R1 | Sustained staging soak (duration defined by org, not this doc) with no critical duplicates |
| R2 | RLS / policy review artifacts for every table touched by the rollout |
| R3 | Game-day: finance race + webhook replay + operator double-send |
| R4 | Legal / compliance sign-off if PII messaging policies apply |
| R5 | Post-incident runbook: revoke keys, disable Edge routes, customer comms template |

---

## Document map (this sprint)

| File | Role |
|------|------|
| `C2C_REPO_WRITE_SURFACE_INVENTORY.md` | Breadth of writes / invokes |
| `C2C_JWT_AND_TRUST_BOUNDARY_AUDIT.md` | Ingress and identity |
| `C2C_IDEMPOTENCY_AND_REPLAY_REVIEW.md` | Duplicate and replay classes |
| `C2C_AUTHORITY_ESCALATION_REVIEW.md` | Matrix of actions vs guards |
| `C2C_FAILURE_SCENARIO_TABLETOP.md` | Scenario pass/fail thinking |

---

## Explicit non-goals (this PR)

- No migrations, Supabase CLI, deploys, Edge edits, runtime behavior changes, new `invoke` sites, or DB writes as part of this documentation sprint.
