# WhatsApp WA-03A — Sender identity in operator inbox (read-only)

**PR:** WA-03A — Wire sender identity into WhatsApp Inbox  
**Date:** 2026-06-02

---

## Summary

Operator inbox now displays **read-only sender identity** for the selected packet by invoking **`whatsapp-identify-sender`** (TOOL 2). No ownership, order, or customer mutations are performed from this UI.

---

## Function wired

| Slug | Classification | Writes |
|------|----------------|--------|
| `whatsapp-identify-sender` | Employee / customer / spam / unknown | **None** — `users` and `whatsapp_contacts` SELECT only |

Optional follow-up (still read-only): PostgREST `select` on `users` when Edge returns `user_id` for employee name/department display.

---

## UI location

**Route:** `/admin/operator-inbox` or `/admin/whatsapp`  
**Panel:** Selected packet header → green “Contact / sender” card → **Sender identity** card below packet badges.

Shows:

- Category badge (Internal employee / Customer / contact / Unknown / Suspicious)
- Confidence when returned
- Employee: name, role, department, “Order Creator candidate”
- Customer: contact/company, “Direct customer message”
- Unknown: “needs clarification” — **no auto-create**

Loading and error states included. Label: **read-only · not persisted**.

---

## Not in scope (unchanged)

- `companies.account_manager_id` writes (frozen by WA-02B)
- Pipeline C auto-order
- Order Creator / Handler / Approver persistence
- Outbound reply (`whatsapp-operator-reply`) — pre-existing write path

---

## Files

- `src/lib/wa-governance/fetchSenderIdentity.ts`
- `src/lib/wa-governance/senderIdentityDisplay.ts`
- `src/components/whatsapp/useOperatorInboxSenderIdentity.ts`
- `src/components/whatsapp/OperatorInboxSenderIdentityPanel.tsx`
- `src/components/WhatsAppInbox.tsx` (wiring only)

---

*End of WA-03A note.*
