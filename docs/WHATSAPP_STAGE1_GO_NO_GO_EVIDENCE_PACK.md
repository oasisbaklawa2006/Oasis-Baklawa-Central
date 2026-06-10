# WhatsApp Stage-1 GO/NO-GO Evidence Pack

**Phase:** WA Stage-1 — GO/NO-GO evidence + write-path readiness audit (pre–live send / order-write automation)  
**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Scope:** WhatsApp / operator inbox module only (`src/components/WhatsAppInbox.tsx`, `src/components/whatsapp/*`, `src/lib/wa-governance/*`, inbox-invoked Edge Functions)  
**Date:** 2026-06-02 (finalization update 2026-06-04)  
**Out of scope:** War Room, Central Order Pool, finance flows, order save, quotation, PI, migrations, live send automation implementation

**Finalization sprint (2026-06-04):** See `docs/evidence/stage1/STAGE1_FINAL_READINESS_REPORT.md` and `STAGE1_EXECUTIVE_SUMMARY.md`.  
**Recommendation:** **GO WITH CONDITIONS** (read-only staging pilot). Production NOT touched.

**Related docs:**
- `docs/WHATSAPP_READ_ONLY_GUARDRAIL_AUDIT.md` — post–PR #66 read/write guardrails
- `docs/WHATSAPP_COMPLETE_MODULE_BUILD_AUDIT.md` — WA-01B module inventory
- `docs/WHATSAPP_WA02B_GOVERNANCE_HARDENING.md` — webhook auto-order flag gating
- `docs/WHATSAPP_WA03A` … `WA06A` — resolution stack (read-only)
- `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md` — manual browser smoke checklist
- `docs/evidence/stage1/staging-evidence-runbook.md` — open staging evidence execution map (E1–E20)

**Static evidence artifacts (complete):**
- `docs/evidence/stage1/ci-readonly-guard.log` — wa-governance test suite (137/137)
- `docs/evidence/stage1/idempotency-reply-gap.md` — operator reply idempotency NO-GO (static)
- `docs/evidence/stage1/rbac-url-access.md` — RBAC URL note (static; E10 nav screenshot pending)

**Staging evidence artifacts (partial — finalization sprint):**
- `docs/evidence/stage1/queue-disabled-governance-bar.png` — E4
- `docs/evidence/stage1/audit-readonly-label.png` — E5
- `docs/evidence/stage1/visibility-full-inbox-with-packets.png` — E12
- `docs/evidence/stage1/audit-override-log-count.txt` — E6
- `docs/evidence/stage1/audit-suggestions-log-count.txt` — E20
- `docs/evidence/stage1/webhook-auto-order-env.txt` — E18 (partial)
- `docs/evidence/stage1/wa_stage1_rls_post_apply_verification.md` — RLS verified staging
- `docs/evidence/stage1/pr69-smoke-checklist-final.md` — E14 partial (4 PASS, 10 BLOCKED)
- `docs/evidence/stage1/e3-no-failed-row-available.md` — E3 blocked
- `docs/evidence/stage1/e17-realtime-refresh-blocked.md` — E17 blocked

---

## Executive summary

| Pilot mode | Stage-1 verdict | Rationale |
|------------|-----------------|-----------|
| **Read-only observation** (packets, thread, resolution panels, TOOL 3/4 suggestions) | **GO WITH CONDITIONS** | AST guards pass; RLS Option A verified staging; E4/E5/E6/E12/E20 captured; E1/E2/E8/E10/E14 items remain open/blocked |
| **Operator reply send** (TOOL 1) | **NO-GO** | `whatsapp-operator-reply` writes DB + provider send; `verify_jwt = false`; no idempotency key; no override audit table writes |
| **Order / draft creation from inbox** | **GO (blocked by design)** | No order/draft write path in inbox UI; local draft preview is client-only |
| **Live send / order-write automation pilot** | **NO-GO** | Write-path guardrails incomplete; see blockers §8 |

**Stage-1 status:** Static guards **complete**; staging RLS **verified**; core visibility/governance/audit SQL **captured**. **GO WITH CONDITIONS** for read-only staging pilot. Full operational sign-off pending E1/E2/E8/E10/E13/E14 blocked rows and human sign-off. **Not** safe to expand into governed send or order-write automation without closing blockers in §2.6.

---

## 1. GO/NO-GO evidence checklist

Each row lists **what to prove**, **how to prove it**, **pass criteria**, and **evidence placeholder**.

### 1.1 Alert proof

| Item | Proof method | Pass | Fail |
|------|--------------|------|------|
| Load failures surface to operator | Open inbox with broken Supabase URL or revoke anon key temporarily | Red `role="alert"` banner with error text; no silent blank list | Blank screen or empty list with no message |
| Reply validation alerts | Select packet with invalid phone; attempt send | Browser `alert()` with phone validation message | Send proceeds or fails silently |
| Reply send failure alerts | Invoke reply with provider down / invalid payload | `alert()` with failure message; failed row visible in read-only failed panel | Success toast with no DB row or silent drop |
| Suggestion failures | Break classify/route Edge (staging) | Amber/red error in suggestions area (`suggestionsError`) | Stale success shown |
| Observability partial errors | Simulate one count query failure | Amber partial-errors banner in observability strip | Strip hides failure |
| Realtime refresh status | Trigger packet update | Refreshing banner / status when silent reload runs | Stale data with no indication |

**Commands (static / unit):**
```bash
npm run typecheck
npm run build
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts
```

**Evidence placeholders:**
- [ ] Screenshot: load error banner (`<!-- EVIDENCE: alert-load-error.png -->`)
- [ ] Screenshot: reply validation alert (`<!-- EVIDENCE: alert-reply-validation.png -->`)
- [ ] Screenshot: failed delivery read-only panel (`<!-- EVIDENCE: alert-failed-msgs-panel.png -->`)

---

### 1.2 Queue-disabled proof

The operator inbox module does **not** enqueue work to `customer_support_queue` or any server-side execution queue. Automation and governed actions are **UI-disabled**.

| Item | Proof method | Pass | Fail |
|------|--------------|------|------|
| Send Automation disabled | Open inbox governance bar | "Send Automation" shows lock + tooltip; `aria-disabled="true"`; click does nothing | Click triggers invoke or navigation |
| Approve Draft disabled | Same bar | "Approve Draft" disabled with governance tooltip | Draft persisted server-side |
| Reassign disabled | Same bar | "Reassign" disabled | Owner mutation triggered |
| Failed-msg retry disabled | Failed delivery panel | Retry control absent or disabled | Retry invokes send |
| No inbox queue RPC | AST guard test | Zero `rpc(` PostgREST call expressions in inbox write scan paths (see §3) | Any queue enqueue from inbox |

**Commands:**
```bash
rg 'DisabledGovernanceAction|Send Automation|Approve Draft' src/components/whatsapp/OperatorInboxReadOnlyPanels.tsx
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts -t "governance"
```

**Evidence placeholders:**
- [x] Screenshot: governance bar with three disabled actions — [`queue-disabled-governance-bar.png`](../evidence/stage1/queue-disabled-governance-bar.png) (E4)

---

### 1.3 Audit proof

| Item | Proof method | Pass | Fail |
|------|--------------|------|------|
| Resolution panels not persisted | Inspect panel chrome | Labels: "read-only · not persisted" on WA-03A–06A panels | Server tables updated on resolve |
| Operator reply audit | Check Edge + DB after manual reply | Row in `whatsapp_messages` with `provider: operator_reply` | No row or wrong provider |
| Override / suggestion audit tables | Query staging `whatsapp_override_log`, `whatsapp_suggestions_log` | **Expected today:** zero inbox-driven writes (tables may exist from migrations) | Inbox writes without governance review |
| Webhook debug trail | Inbound message on staging | Row in `debug_webhooks` (background pipeline, not inbox UI) | N/A for inbox-only pilot |

**Commands:**
```bash
rg 'not persisted|read-only' src/components/whatsapp/*ResolutionPanel.tsx
rg 'whatsapp_override_log|whatsapp_suggestions_log' src/components src/lib/wa-governance
```

**Evidence placeholders:**
- [x] Screenshot: resolution panel "not persisted" label — [`audit-readonly-label.png`](../evidence/stage1/audit-readonly-label.png) (E5)
- [x] SQL snapshot: override log count — [`audit-override-log-count.txt`](../evidence/stage1/audit-override-log-count.txt) (E6)

---

### 1.4 Replay / idempotency proof

| Path | Idempotency | Proof |
|------|-------------|-------|
| Inbox packet reload | Generation counter (`inboxLoadGenerationRef`) drops stale async results | Unit: lifecycle tests for quantity resolution request-key guards |
| Realtime silent reload | Same load function; cancelled on unmount | Manual: switch packets rapidly — no cross-thread bleed |
| Resolution in-memory cache | Per logical `requestKey`; warm-cache prefix scan (WA-06A) | `quantityResolutionLifecycle.test.ts` |
| Operator reply | **None** — each send inserts new `whatsapp_messages` row | **NO-GO item** for send pilot |
| Webhook WAMID dedup | Background only (`whatsapp-webhook`) | Log line `[WAMID_DEDUP]` on duplicate; not inbox-invoked |

**Commands:**
```bash
npx vitest run src/lib/wa-governance/tests/quantityResolutionLifecycle.test.ts
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts -t "invoke"
```

**Evidence placeholders:**
- [x] Note: operator reply idempotency NO-GO (static) — [`docs/evidence/stage1/idempotency-reply-gap.md`](../evidence/stage1/idempotency-reply-gap.md). Staging duplicate-click proof still **pending**.

---

### 1.5 Failure-path proof

| Failure | Expected behavior | Pass |
|---------|-------------------|------|
| Partial message batch load | `messagesBatchWarnings` surfaced; packet still selectable | Warning visible |
| Classify/route Edge error | `suggestionsError` set; prior suggestion cleared or marked stale | Error text shown |
| Reply provider failure | `whatsapp_messages.status = failed`; read-only panel lists row | Failed panel entry |
| Resolution upstream not ready | Panel shows loading until client/product identity ready | No fake "ready" with empty data |
| Quantity resolution error | Panel `status: error` with message | No infinite loading |

**Commands:**
```bash
npx vitest run src/lib/wa-governance/tests/quantityResolution*.test.ts
npx vitest run src/lib/operational-events/__tests__/operational-stitching.test.ts
```

**Evidence placeholders:**
- [ ] Screenshot: suggestions error state (`<!-- EVIDENCE: failure-suggestions-error.png -->`)

---

### 1.6 Read-only proof

| Surface | Mechanism | Verified by |
|---------|-----------|-------------|
| `src/components/WhatsAppInbox.tsx` | No forbidden PostgREST write call expressions | AST guard test |
| `src/components/whatsapp/*` | No forbidden PostgREST write call expressions | AST guard test |
| `src/lib/wa-governance/*` | SELECT-only fetch engines | AST guard test |
| `WhatsAppInbox.tsx` PostgREST | `.select` + Realtime subscribe only | AST guard test + manual review |
| localStorage features | UI state, notes, saved views — no server sync | `operatorInboxLocalNotes.ts`, `operatorInboxUiPersistence.ts` |
| TOOL 3/4 Edge | SELECT-only handlers | Edge grep (no writes in classify/route) |
| WA-03A–06A resolution | In-memory cache; optional SELECT on catalogue | Integration tests |

**Commands:**
```bash
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts
npx vitest run src/lib/wa-governance/tests/stage1InvokeScan.test.ts
npx vitest run src/lib/wa-governance/tests/stage1PostgrestWriteScan.test.ts
```

**Evidence placeholders:**
- [x] CI log: guard test green — [`docs/evidence/stage1/ci-readonly-guard.log`](../evidence/stage1/ci-readonly-guard.log) (137/137 pass)

---

### 1.7 RBAC proof

| Layer | Mechanism | Gap |
|-------|-----------|-----|
| Route | `/admin/operator-inbox`, `/admin/whatsapp` under `ProtectedRoute` + `RoleProtectedRoute allowedRoles={ADMIN_STAFF_ROLES}` | OK for staff gating |
| Nav | `AdminLayout` `moduleKey: "support"` — link hidden for roles without support module | URL still reachable if role is admin-staff |
| Edge | All WA functions `verify_jwt = false` in `supabase/config.toml` | **Any holder of anon key can invoke reply Edge** |
| Reply payload | `operator_id` passed from session — logged only, not enforced | **NO-GO for send pilot** |

**Commands:**
```bash
rg 'operator-inbox|ADMIN_STAFF_ROLES' src/App.tsx src/components/AdminLayout.tsx
rg 'verify_jwt' supabase/config.toml | rg whatsapp
```

**Evidence placeholders:**
- [ ] Screenshot: non-support role cannot see nav link (`<!-- EVIDENCE: rbac-nav-hidden.png -->`) — **staging pending**
- [x] Note: RBAC direct URL access (static audit only) — [`docs/evidence/stage1/rbac-url-access.md`](../evidence/stage1/rbac-url-access.md). Does **not** claim pass; multi-role staging test **pending**.

---

### 1.8 Operator visibility proof

| Signal | Location |
|--------|----------|
| Packet health / age / intent | List row badges (`operatorInboxUtils`) |
| Thread direction counts | Packet badges panel |
| Failed outbound messages | `OperatorInboxFailedMessagesReadOnlyPanel` |
| Observability strip | Counts + capped samples |
| Sender / client / product / quantity resolution | Right insights column |
| Operational context | `OperatorInboxOperationalContextPanel` |
| Governance notice | Amber governance bar |

**Manual smoke:** `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md`

**Evidence placeholders:**
- [x] Screenshot: full inbox with insights column — [`visibility-full-inbox-with-packets.png`](../evidence/stage1/visibility-full-inbox-with-packets.png) (E12)

---

### 1.9 No silent-send proof

| Check | Pass criteria |
|-------|---------------|
| Reply requires explicit click | Send button + non-empty trimmed text |
| No auto-reply on packet select | Selecting packet does not invoke `whatsapp-operator-reply` |
| No cron/automation from inbox | No `send-whatsapp-automation` invoke in inbox tree |
| Disabled automation control | Governance bar blocks "Send Automation" |

**Commands:**
```bash
rg 'whatsapp-operator-reply|send-whatsapp' src/components/WhatsAppInbox.tsx src/components/whatsapp
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts -t "silent"
```

---

### 1.10 No silent-order-create proof

| Check | Pass criteria |
|-------|---------------|
| No order insert from inbox UI | Zero `from("orders")` writes in inbox tree |
| Local draft preview | `OperatorInboxLocalDraftPreview` — in-memory hints only |
| Approve Draft disabled | No server draft promotion |
| Webhook auto-order flag | `isWaWebhookAutoOrderWritesEnabled()` defaults **false** |

**Commands:**
```bash
npx vitest run src/lib/wa-governance/__tests__/waFlags.test.ts
rg 'from\("orders"\)|from\(' src/components/WhatsAppInbox.tsx src/components/whatsapp
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts -t "order"
```

---

## 2. Write-path readiness audit

### 2.1 Read-only paths (safe for Stage-1 observation)

| Path | Entry | Data access |
|------|-------|-------------|
| Packet list | `WhatsAppInbox.loadPackets` | `whatsapp_message_packets.select` (open, limit 1000) |
| Message batch | `fetchMessagesForPacketIdsBatch` | Paginated `whatsapp_messages.select` |
| Realtime | `postgres_changes` on packets | Triggers silent reload (read) |
| Observability | `useOperatorInboxObservability` | Count + capped sample selects |
| Sender identity | `fetchSenderIdentity` → `whatsapp-identify-sender` | Edge SELECT |
| Client resolution | `fetchClientResolution` | SELECT companies, users, orders, … |
| Product resolution | `fetchProductResolution` | SELECT products, product_aliases |
| Quantity resolution | `resolveQuantityCandidates` | Parse + optional SELECT products |
| Classify intent | `handleClassifyIntent` → `whatsapp-classify-intent` | Edge SELECT; JSON return |
| Route packet | `handleSuggestRoute` → `whatsapp-route-packet` | Edge SELECT; JSON return |
| Local features | UI persistence, notes, saved views, CSV | localStorage / download only |
| Operational feed | `buildWhatsAppOperationalFeed` | Pure projection |

### 2.2 Write-capable paths (in scope awareness)

| Path | Writes | Stage-1 posture |
|------|--------|-----------------|
| **Operator reply** | `WhatsAppInbox.handleSendReply` → `whatsapp-operator-reply` → `whatsapp_messages.insert/update` + `send-whatsapp` | **Live but NO-GO for pilot expansion** |
| **Background webhook** | `whatsapp-webhook` (not inbox UI) | Flag-gated; default off for auto-order |
| **Background stitcher** | `whatsapp-message-stitcher` | Not inbox-triggered |

### 2.3 Provider send / reply paths

| Function | Called from inbox? | Provider |
|----------|-------------------|----------|
| `whatsapp-operator-reply` | **Yes** (explicit send) | Delegates to `send-whatsapp` |
| `send-whatsapp` | Indirect via operator-reply | Click2API / MSG91 |
| `send-whatsapp-automation` | **No** inbox invoker | N/A for Stage-1 |

### 2.4 Order / draft creation paths

| Path | From inbox? |
|------|-------------|
| `orders` / `order_items` insert | **No** |
| `admin-create-draft` invoke | **No** |
| Local draft hints | Yes — **not persisted** |
| Webhook Pipeline C | Background only; flag **off** by default |

### 2.5 Hidden mutation risks

| Risk | Severity | Mitigation today |
|------|----------|------------------|
| Anon-key Edge invoke for reply | **High** | Staff-only route; not sufficient alone for send pilot |
| localStorage notes/views | **Low** | Device-local only; documented |
| Realtime reload race | **Low** | Generation counter + packet ref guards |
| Resolution cache stale catalogue | **Medium** | Composite cache key + warm-cache ambiguity → async refetch |
| Direct URL without nav module filter | **Medium** | Accept for read-only; tighten before send pilot |

### 2.6 Missing guardrails before send/write pilot

1. Enable `verify_jwt` + role check on `whatsapp-operator-reply` (and classify/route if exposed publicly)
2. Idempotency key on operator reply (client + server)
3. Wire `whatsapp_override_log` / `whatsapp_suggestions_log` for governed actions
4. Staging proof that `ENABLE_WA_WEBHOOK_AUTO_ORDER_WRITES` is unset/false
5. Explicit pilot feature flag to disable reply composer in read-only mode
6. Browser smoke + staging evidence placeholders filled (§1)

---

## 3. PostgREST write guard scan paths

The Stage-1 guard uses **TypeScript AST scanners** (not regex) via:

- `src/lib/wa-governance/stage1PostgrestWriteScan.ts` — forbidden `.insert(`, `.update(`, `.upsert(`, `.delete(`, `.rpc(` call expressions
- `src/lib/wa-governance/stage1InvokeScan.ts` — `*.functions.invoke("slug", …)` call expressions

Tests: `stage1PostgrestWriteScan.test.ts`, `stage1InvokeScan.test.ts`, and `operatorInboxStage1Guard.test.ts`.

| Scan root | Coverage |
|-----------|----------|
| `src/components/WhatsAppInbox.tsx` | Main inbox shell (packet load, reply invoke, suggestions) |
| `src/components/whatsapp/**` | Hooks, panels, utils (excludes `*.test.ts`) |
| `src/lib/wa-governance/**` | Resolution fetch engines (excludes `tests/` and `__tests__/`) |

---

## 4. Validation commands (run before GO sign-off)

```bash
# Required CI-equivalent
npm run typecheck
npm run build

# Stage-1 guard + WA governance suite
npx vitest run src/lib/wa-governance/tests/operatorInboxStage1Guard.test.ts
npx vitest run src/lib/wa-governance/tests/stage1InvokeScan.test.ts
npx vitest run src/lib/wa-governance/tests/stage1PostgrestWriteScan.test.ts
npx vitest run src/lib/wa-governance/tests/quantityResolution*.test.ts
npx vitest run src/lib/wa-governance/__tests__/waFlags.test.ts
npx vitest run src/lib/operational-events/__tests__/operational-stitching.test.ts

# Optional manual spot-check (AST tests are authoritative)
rg '\.(insert|update|delete|upsert|rpc)\(' src/components/WhatsAppInbox.tsx src/components/whatsapp src/lib/wa-governance

# Inbox invoke allowlist (AST-tested in operatorInboxStage1Guard.test.ts)
rg 'functions\.invoke\("whatsapp-' src/components/WhatsAppInbox.tsx
```

**Expected results:**
- typecheck + build: exit 0
- vitest: all tests pass (AST scanners are authoritative for write/invoke guards)
- optional write grep: no matches in scoped dirs
- optional invoke grep: `whatsapp-operator-reply`, `whatsapp-classify-intent`, `whatsapp-route-packet` only

**Manual (staging):** complete `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md` and attach screenshots to §1 placeholders. Execution map: [`docs/evidence/stage1/staging-evidence-runbook.md`](../evidence/stage1/staging-evidence-runbook.md).

**Static evidence (complete):** E7, E9, E11 — see `docs/evidence/stage1/`.  
**Staging evidence (complete):** E4, E5, E6, E12, E20; RLS post-apply verification.  
**Staging evidence (partial):** E14 (4/14 PASS), E18 (code default only).  
**Staging evidence (open):** E1, E2, E8, E10, E15, E16, E19.  
**Staging evidence (blocked):** E3, E13, E17 — see blocker docs in `docs/evidence/stage1/`.

---

## 5. Final GO/NO-GO decision table

| Capability | Evidence status | Decision | Owner action |
|------------|---------------|----------|--------------|
| Read-only packet/thread observation | Static + RLS + E12/E14 partial | **GO WITH CONDITIONS** | Complete E14 blocked rows; E1/E2/E8 |
| Resolution panels (WA-03A–06A) | SELECT-only (static); E5 captured | **GO WITH CONDITIONS** | — |
| TOOL 3/4 suggestions | Edge SELECT-only (static); error UI open | **Conditional** | Capture E8 on staging |
| Governance disabled actions | AST guard pass; E4 captured | **GO WITH CONDITIONS** | — |
| Webhook auto-order writes | Code default false; E18 partial | **Conditional** | Confirm secret in Supabase Dashboard |
| Operator reply send | Idempotency NO-GO documented (static) | **NO-GO** | Do not include in send pilot; see `idempotency-reply-gap.md` |
| Order/draft creation from inbox | No path (static) | **GO (N/A)** | Keep Approve Draft disabled |
| Full live send/order-write automation | Multiple blockers §2.6 | **NO-GO** | Complete WA-02B hardening + reply replacement plan |

**Overall Stage-1 recommendation:** **GO WITH CONDITIONS** for read-only staging observation pilot. Operator reply send and full operational sign-off remain **NO-GO** / pending until E13 and open alert/smoke items close. See `docs/evidence/stage1/STAGE1_FINAL_READINESS_REPORT.md`.

---

## 6. Sign-off

| Role | Name | Date | Decision |
|------|------|------|----------|
| Engineering | | | |
| Operations | | | |
| Security / governance | | | |

---

*End of Stage-1 evidence pack.*
