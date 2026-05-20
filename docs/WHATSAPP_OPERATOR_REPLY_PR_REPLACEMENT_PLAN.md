# WhatsApp operator-reply — replacement PR plan

**Purpose:** Replace the stalled **draft PR chain #59 / #60 / #61** with a **single, coherent** implementation path rebased on **current `main`**, without merging conflicted branches as-is.  
**Scope:** Documentation and process only. **No** code edits in this task, **no** PR merges/closes, **no** push/deploy, **no** Supabase CLI.

---

## 1. Current PR status (#59, #60, #61)

| PR | Title (short) | Branch | Draft | Merge vs `main` | Files (from triage) |
|----|---------------|--------|-------|-----------------|---------------------|
| **#59** | Add `whatsapp-operator-reply` edge function | `cursor/whatsapp-operator-reply-e26c` | Yes | **CONFLICTING** (`DIRTY`) | `supabase/functions/whatsapp-operator-reply/index.ts`, `supabase/config.toml` |
| **#60** | Wire inbox reply UI to `whatsapp-operator-reply` | `cursor/whatsapp-inbox-reply-send-e26c` | Yes | **CONFLICTING** (`DIRTY`) | `src/components/WhatsAppInbox.tsx` |
| **#61** | Simplify `whatsapp-operator-reply` (sent/failed, provider) | `cursor/whatsapp-operator-reply-simplify-e26c` | Yes | **MERGEABLE** (`CLEAN`) | `supabase/functions/whatsapp-operator-reply/index.ts` |

**Context:** `main` already contains baseline **`whatsapp-operator-reply`**, **`WhatsAppInbox`**, and related integration commits; these PRs predate or diverge from that line and **no longer merge cleanly** as a stack.

---

## 2. Why #59 and #60 should be **superseded** (not merged as-is)

1. **Merge machinery:** Both are **draft** and **GitHub-reported conflicts** with current `main` (`CONFLICTING` / `DIRTY`). Merging without a clean rebase wastes review time and risks silent overwrite of already-shipped behavior.  
2. **Baseline already on `main`:** The **same files** exist on `main` with operator reply and inbox work landed in later commits. #59/#60 are **alternate or incremental** deltas, not net-new files from zero—merging blind duplicates `config.toml` / function entries or fights current inbox logic.  
3. **Traceability:** A **fresh branch from `main`** with a **single squashed or linear** commit series produces one diff reviewers can trust against **today’s** tree; keeping #59/#60 open as merge targets invites partial application.

**Conclusion:** Treat **#59** and **#60** as **historical carriers of intent**; **supersede** them with a **replacement PR** (or two small PRs) whose diff is explicitly computed from **`main...replacement`**.

---

## 3. Why #61 should **not** be merged alone

1. **Incomplete story:** #61 only edits **`whatsapp-operator-reply/index.ts`**. It does **not** carry the reconciled **inbox** contract from #60 or the **config** delta from #59 if those still matter after rebase.  
2. **Ordering risk:** Merging #61 first can make **follow-up inbox** or **config** fixes harder if reviewers assumed #61’s API shape is final while #60’s UI still targets an older contract.  
3. **Intended stack:** The **simplification** in #61 is meant as a **polish** on the **full** operator-reply + inbox design—not a standalone release.

**Conclusion:** Apply #61’s **simplification ideas** **after** (or **inside**) the replacement branch that already matches **`main`** for backend + inbox, then open **one** focused PR or fold into the same replacement PR.

---

## 4. Desired final behavior — `whatsapp-operator-reply` (Edge)

- **Role:** Trusted **server-side** handler for **operator-initiated** WhatsApp replies linked to a **packet** / conversation context (aligned with inbox UI).  
- **Contract:** Accept a **minimal, validated** payload (e.g. `packet_id`, message body, identity fields required by DB) and return a **clear** outcome: **sent vs failed** with a safe error surface (no internal stack traces to clients).  
- **Persistence:** Perform only the **necessary** `insert` / `update` paths already implied by product design (e.g. outbound message row, packet linkage); stay **idempotent** where duplicate submits are possible.  
- **Provider:** Use the **configured WhatsApp provider** path consistently (avoid dead “pending” states where product expects real send).  
- **Auth:** Honor the project’s **JWT / service-role** model documented in `config.toml`; any `verify_jwt = false` choice must be paired with **strict** payload and caller checks (see §6).

---

## 5. Desired final behavior — `WhatsAppInbox` reply UI

- **Role:** Let authorized operators **compose** and **send** a reply from the stitched **packet** view, calling **`whatsapp-operator-reply`** (or the agreed API route) with the **same** identifiers the backend validates.  
- **UX:** Show **progress**, **success**, and **failure** states; disable double-submit; surface **actionable** errors (rate limit, validation, provider failure).  
- **Consistency:** Field names and endpoint contract **match** the reconciled Edge function on `main` (no drift between “simplified” backend and older UI branch).  
- **RBAC:** Only users who are allowed to use the operator tool in **UI** should see/send; backend remains the **source of truth** for authorization on write.

---

## 6. Security concerns — `verify_jwt = false` **writer**

- **Exposure:** With **`verify_jwt = false`**, Supabase does **not** require a JWT at the Edge ingress; **any** caller who can hit the URL can **attempt** to invoke the function. Security must move to **application logic** (shared secrets, HMAC headers, internal-only network, or strict payload + role checks) **inside** the function.  
- **Privilege:** Operator-reply typically uses a **service role** or broad DB client → **high blast radius** (impersonation, spam, arbitrary message injection if validation fails).  
- **Review checklist:** Rate limiting, payload schema validation, **packet/contact ownership** checks, audit logging, **no** echo of secrets, and **alignment** with how the **inbox** authenticates (cookies/session vs service key).  
- **Operational:** Logs must not leak PII/keys; failures should be **typed**, not raw DB errors to clients.

---

## 7. Recommended **replacement branch** plan (from latest `main`)

1. **`git fetch origin` && `git checkout -b cursor/whatsapp-operator-reply-reconcile-<suffix>`** from **`origin/main`** (use your naming convention; example only—**do not** run here as part of this doc task).  
2. **Manually port** (cherry-pick with conflict resolution **or** copy hunks with attribution):  
   - From **#59:** any **`config.toml`** entries still **missing** on `main` vs intended design; function behavior only if **not** already equivalent on `main`.  
   - From **#60:** inbox reply wiring **on top of** current `WhatsAppInbox.tsx` (resolve conflicts by hand against `main`).  
   - From **#61:** simplification (**sent/failed**, provider handling) **applied last** on the reconciled function body.  
3. **Produce one Git diff** (or **PR1** backend + **PR2** UI if separation helps review) where **`git diff origin/main...HEAD`** is **conflict-free** and **small enough** to review in one sitting.  
4. **Open a new PR** with title like **“feat(whatsapp): reconcile operator-reply + inbox (supersedes #59–#61)”** and **link** #59/#60/#61 in the description as **superseded** (human closes or updates after merge—**out of scope** for this file).  
5. **CI:** Run unit/Edge tests and any **Playwright** that applies **without** production URLs (see non-goals §8).

---

## 8. Exact **non-goals**

| Non-goal | Rationale |
|----------|-----------|
| **No C2 manual override** | Out of scope for this replacement; do not bundle unrelated C2 write-path or manual DB override tooling. |
| **No new DB migrations** | Reconciliation is **Edge + UI** against existing schema; schema changes belong to a **separate**, migration-approved track. |
| **No** `migration repair` / **`db push`** / **`db pull`** | Migration drift work is **separate**; this plan must not trigger Supabase history or apply pipelines. |
| **No production deploy** until reviewed | Replacement PR(s) require **full** security + behavior review before any **prod** Edge deploy or **prod**-targeted E2E. |

---

## 9. Separate handling — **#57**, **#55**, **#51**

| PR | Handling |
|----|----------|
| **#57** (`whatsapp-message-stitcher` hardening) | **Independent** of the operator-reply replacement. **Keep** draft; **review after** operator-reply reconciliation merges (or is explicitly deferred) to avoid overlapping writer-path churn. Still **mergeable** vs `main` at time of triage—re-verify before merge. |
| **#55** (post-merge Playwright regression) | **Keep** as **draft test PR**. **Do not** run against **production** (or production-like hosts) without **explicit env approval** and pinned preview URLs. |
| **#51** (Sprint A Playwright + helpers) | Same as **#55**: **draft**, **mergeable** test-only scope; **no prod** runs without approval; consider **rebasing** after `golden-pipeline-qa.spec.ts` churn on `main` settles. |

---

*End of replacement plan.*
