# Sprint C2B — next safe read-only WhatsApp implementation slice (plan)

**Purpose:** Plan the **next** slice of work limited to **read-only** operator WhatsApp UX and documentation alignment with `docs/SPRINT_C2B_EXECUTION_CHECKLIST.md` §3 and `docs/SPRINT_C2B_UNBLOCK_DECISION_MEMO.md`. This file is **planning only** — it does not change code, migrations, or infrastructure.

**Inspected (this pass):** `src/components/WhatsAppInbox.tsx`, `src/pages/OperatorInbox.tsx`, `src/App.tsx` (admin routes), `src/components/AdminLayout.tsx` (nav), `supabase/functions/whatsapp-message-stitcher/index.ts`, `supabase/functions/whatsapp-operator-reply/index.ts`.

**Related WhatsApp surfaces (not primary inbox):** Other admin pages call `send-whatsapp` or `whatsapp_config` (for example `AdminSettings.tsx`, `OrderManagement.tsx`, war room tabs). They are **out of scope** for this slice unless explicitly expanded; this plan focuses on **`/admin/operator-inbox`**.

---

## 1. Current WhatsApp UI capability

The **Operator Inbox** is implemented as a **full-viewport** experience:

| Capability | Behavior |
|------------|----------|
| **Entry** | Admin nav label **“WhatsApp Inbox”** → `AdminLayout` route **`/admin/operator-inbox`** → lazy `OperatorInbox` → `WhatsAppInbox`. |
| **Auth** | Wrapped in `ProtectedRoute` + `RoleProtectedRoute` with **`ADMIN_STAFF_ROLES`** (same as rest of `/admin`). |
| **Conversation list** | Up to **50** `whatsapp_message_packets` with **`status = 'open'`**, ordered by **`last_message_at` desc**; shows contact name, phone, preview summary, fragment count, relative time. |
| **Detail pane** | Selected packet: header, **Classify Intent** / **Suggest Route** buttons (TOOL 3/4), read-only suggestion cards, threaded **messages** by `packet_sequence`. |
| **Reply composer** | Text input + **Send** invokes **`whatsapp-operator-reply`** (writes DB + provider send — **not** read-only; see §3). |
| **Realtime** | Supabase channel **`whatsapp-inbox-packets`**: `postgres_changes` on **`public.whatsapp_message_packets`** (`event: "*"`) triggers **`loadPackets()`** refresh. |

---

## 2. Existing read paths

All of the following are **SELECT-only** on the client (PostgREST with the logged-in user’s JWT):

| Step | Source | Target |
|------|--------|--------|
| **Packets** | `supabase.from("whatsapp_message_packets")` (cast `as any`) | Columns: `id`, `contact_id`, `fragment_count`, `status`, `first_message_at`, `last_message_at`, `stitched_content`, nested **`whatsapp_contacts(phone_number, customer_name)`**. |
| **Messages per packet** | `supabase.from("whatsapp_messages")` (cast `as any`) | Columns: `id`, `content`, `message_type`, `direction`, `created_at`, `packet_sequence` filtered by **`packet_id`**. |
| **Suggestions** | `supabase.functions.invoke("whatsapp-classify-intent")` | Body: `packet_id`, `contact_id`. Intended **return-only** JSON (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md` §1). |
| **Routing hint** | `supabase.functions.invoke("whatsapp-route-packet")` | Body: `packet_id`, `contact_id`, optional `intent`. Intended **return-only**. |
| **Realtime subscription** | `supabase.channel(...).on("postgres_changes", { table: "whatsapp_message_packets" })` | Drives **re-fetch** of lists; no direct client `insert`/`update`/`delete`. |

**Note:** Generated `Database` types still omit some `whatsapp_*` tables; the component uses **`as any`** and local interfaces — relevant for §7 typecheck expectations if types are tightened later (out of scope for read-only polish unless done without widening writes).

---

## 3. Existing write paths to avoid (in a read-only slice)

| Path | Mechanism | Effect |
|------|-----------|--------|
| **Operator reply** | `handleSendReply` → `supabase.functions.invoke("whatsapp-operator-reply", { body: { packet_id, contact_id, phone_number, message, operator_id } })` | Edge uses **service role**: **INSERT** + **UPDATE** on **`whatsapp_messages`**, then **POST** to **`send-whatsapp`** (`whatsapp-operator-reply/index.ts`). |
| **Indirect DB writes from inbox** | None other than the reply flow and whatever Edge does for classify/route (grep: classify/route have **no** `.insert`/`.update`/`.delete` in typical TOOL 3/4 implementations — treat as **read-only** unless a future code audit finds otherwise). |

**`whatsapp-message-stitcher`:** Not invoked from `WhatsAppInbox.tsx`. It **POST**s to Edge and uses service role to **INSERT** `whatsapp_message_packets` and **UPDATE** `whatsapp_messages`. A read-only UI slice must **not** add client calls to the stitcher; ops/cron remain separate.

**Avoid in this slice:** Any new `insert`/`update`/`delete` from the browser on `whatsapp_message_packets`, `whatsapp_messages`, `whatsapp_override_log`, `whatsapp_suggestions_log`, or “apply suggestion / apply route” persistence. Do not add TOOL 5 controls.

---

## 4. Safe read-only UI improvements

Candidates that stay within **C2B read-only** governance (no new persistence, no TOOL 5, no migration, no deploy requirement for **docs-only** work; for **future UI PRs**, each item should satisfy `docs/SPRINT_C2B_EXECUTION_CHECKLIST.md` §3):

| Theme | Examples |
|-------|----------|
| **Presentation** | Clearer empty / error states; consistent typography; show **full stitched text** (`stitched_content.text`) in a scrollable read-only panel when object-shaped. |
| **Suggestion UX** | Loading/disabled copy for classify/route; **explicit “suggestion only — not saved”** microcopy (aligns with TOOL 6 default in governance). |
| **Accessibility** | Focus order, `aria-live` for errors/suggestions, keyboard behavior for conversation list (partially present via `role="button"` + key handlers). |
| **Performance / perceived perf** | Debounce or coalesce realtime-driven **reloads** (many `*` events) **without** changing data semantics; optional “last updated” indicator. |
| **Read-only filters** | Client-side only: e.g. highlight packets with failed outbound in loaded messages — **if** data already fetched (no new columns/migrations). |
| **Documentation in UI** | Inline help linking to internal runbook for “what Stitcher does” vs operator inbox (copy only). |

**Boundary:** Improving the **reply** area’s **UX** (placeholders, validation messages) is safe **only** if it does not add new server writes beyond the existing single reply invoke. **Removing or gating** Send belongs to a **product decision** (could be a separate “read-only mode” epic); flag as optional, not required for this slice.

---

## 5. Files likely involved

| File | Role |
|------|------|
| `src/components/WhatsAppInbox.tsx` | Primary surface for read-path and suggestion UI changes. |
| `src/pages/OperatorInbox.tsx` | Thin wrapper; may gain layout props, page title, or error boundary wrapper. |
| `src/components/AdminLayout.tsx` | Nav label/active route for operator inbox only if nav copy changes. |
| `src/App.tsx` | Only if route metadata or lazy chunk boundaries change (unlikely). |
| `docs/SPRINT_C2B_EXECUTION_CHECKLIST.md` | Reference for pre-merge §3 checks when opening a UI PR. |

**Not in default slice:** `supabase/functions/*` (no changes for read-only UI), `src/utils/whatsapp.ts` (other flows), `AdminSettings` / war room (different WhatsApp capabilities).

---

## 6. Acceptance criteria

When a future PR implements this slice, it should be mergeable only if:

1. **No new DB mutations from the browser** beyond what already exists today (single **`whatsapp-operator-reply`** path unchanged in **behavior** unless product explicitly removes it in a separate decision).
2. **No new `insert`/`update`/`delete`** on governed WhatsApp tables from `WhatsAppInbox.tsx`.
3. **TOOL 3/4** remain **non-persisting**: no writes to `whatsapp_suggestions_log` or packet columns from suggestion buttons.
4. **No TOOL 5** UI or API hooks.
5. **Checklist §3** (`SPRINT_C2B_EXECUTION_CHECKLIST.md`) items checked for the PR description or review notes.
6. **Regression:** Packet list still loads `status = 'open'`; message thread still orders by `packet_sequence`; realtime refresh still works or is intentionally debounced with documented behavior.

---

## 7. Typecheck / build expectations

Project scripts (`package.json`):

- **`npm run typecheck`** — `tsc -p tsconfig.app.json --noEmit`
- **`npm run build`** — `vite build`
- **`npm run lint`** — `eslint .`

**Expectation for a read-only UI PR:** **No new TypeScript errors** vs baseline; **`as any`** on `whatsapp_*` may remain until generated types include those tables (separate effort). **Build** must succeed for CI parity. If only **documentation** is merged (this plan + checklists), typecheck/build should match **unchanged** repo baseline.

---

## 8. Explicit non-goals

| Non-goal | Notes |
|----------|--------|
| **No TOOL 5** | No manual override UI, no packet patch persistence, no `whatsapp_override_log` client writes (`SPRINT_C2_MANUAL_CONTROL_AUDIT_GOVERNANCE.md`). |
| **No DB writes** | No new Supabase `.insert`/`.update`/`.delete` from the inbox for this slice; do not expand Edge write surface from the inbox. |
| **No migration** | No `supabase/migrations/*`, no RLS/policy DDL. |
| **No deploy** | No production or preview deploy requirement for planning deliverables; Edge/config unchanged in this slice. |
| **No stitcher changes** | `whatsapp-message-stitcher` stays out of scope for inbox read-only polish. |
| **No governance bypass** | Do not use `operator_id` from the client for any new trust decision; document-only reminder for future TOOL 5 work (`SPRINT_C2B_POLICY_GOVERNANCE_RECONCILIATION_PACK.md`). |

---

*End of plan.*
