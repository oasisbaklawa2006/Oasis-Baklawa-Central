# Post-merge PR #66 — operator inbox smoke test checklist

**Purpose:** Manual verification after **PR #66** (C2B read-only observability and operator inbox hardening) on **`/admin/operator-inbox`**. **Documentation only.**

**Code map:** `src/pages/OperatorInbox.tsx` → `WhatsAppInbox`; route `path="operator-inbox"` under admin in `src/App.tsx`; sidebar **WhatsApp Inbox** in `src/components/AdminLayout.tsx`.

---

## 1. Route to test

- **URL:** [`/admin/operator-inbox`](https://your-app.example/admin/operator-inbox) (staff role; use a test account that can open admin).

---

## 2. Browser checks

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | **Inbox loads** | Page renders without infinite spinner; packet list or empty state appears. |
| 2 | **Packets render** | Rows show contact/meta; virtualized list scrolls if many packets. |
| 3 | **Packet click opens detail** | Selecting a row shows thread, header badges, and right-column panels. |
| 4 | **Observability strip renders** | `OperatorInboxObservabilityPanel` shows counts/samples (or graceful empty if no data). |
| 5 | **Filters work** | Text filter, bulk filters, and list refocus behave without breaking selection. |
| 6 | **Local pin works** | Pin toggles persist across refresh (localStorage via `operatorInboxUiPersistence`). |
| 7 | **Unanswered filter works** | “Unanswered only” narrows list; clearing restores broader set. |
| 8 | **Local draft hints render** | `OperatorInboxLocalDraftPreview` shows derived hints from loaded messages. |
| 9 | **Local AI cards render** | `OperatorInboxLocalAiPreviewPanel` / explanation cards show in-memory summaries. |
| 10 | **Governance buttons remain no-op** | `OperatorInboxGovernanceBar` actions (e.g. Reassign, Approve Draft, Send Automation) do **not** call network writes or new invokes. |

---

## 3. Console / network checks

| # | Check | Pass criteria |
|---|--------|----------------|
| 1 | **No PostgREST 400 / 406** | DevTools Network: `whatsapp_message_packets` and `whatsapp_messages` requests succeed or fail with documented partial handling — not systematic 400/406 on every load. |
| 2 | **No select errors for `wa_contact_id` / `status` / `provider`** | If schema lags docs, PostgREST may reject unknown columns — see **§4** fallback. |
| 3 | **No repeated full-page loading flicker** | Initial shell may show once; silent refresh should not blank the entire page on a timer. |

---

## 4. Safe fallback (select field errors)

If the browser console or Network tab shows a **PostgREST / PGRST** error naming a missing or forbidden column:

1. **Identify the failing query** — packet embed (`whatsapp_contacts`) vs batched messages (`operatorInboxMessagesBatch.ts`).
2. **Trim only the offending field** from the `.select(...)` string (e.g. drop `wa_contact_id` from the embed, or `status` / `provider` from the messages select) in a **follow-up read-only PR** — **no** migrations or Edge edits from this checklist.
3. **Re-run** §2 and §3 after the trim.

**Current select hotspots (for triage):**

- Packets: `whatsapp_message_packets` with embed `whatsapp_contacts(phone_number, customer_name, wa_contact_id)`.
- Messages batch: `id, content, message_type, direction, created_at, packet_sequence, status, provider, packet_id`.

---

## 5. Do-not-touch list (this sprint)

- **Migrations** — frozen; do not add or apply.
- **Edge functions** — frozen for this slice; no edits or new deploys from smoke fixes.
- **Policies / RLS** — out of scope; no remote DDL.
- **Write paths** — no new `insert` / `update` / `delete` / `rpc` / `functions.invoke` for observability; **TOOL 5** writes remain untouched.

---

*End of checklist.*
