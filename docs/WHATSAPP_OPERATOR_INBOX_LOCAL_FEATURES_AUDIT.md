# WhatsApp operator inbox — local features audit (post–PR #69)

**Scope:** `src/components/WhatsAppInbox.tsx` and `src/components/whatsapp/*` related to the read-only operator inbox, saved views, local notes, CSV export, and read-only panels.

**Frozen (global policy):** No migrations, no Supabase CLI, no manual deploy, no Edge edits, no new `functions.invoke`, no `insert` / `update` / `delete` / `rpc` from this surface, no TOOL 5 writes.

## Feature → storage / behavior

| Feature | Persistence | Server writes |
|--------|-------------|----------------|
| **Saved views** | **localStorage only** (`operatorInboxSavedViews.ts`) — named presets for filters + display toggles + pins. | None from this module. |
| **Local notes** | **localStorage only** (`operatorInboxLocalNotes.ts`) — per-packet text map. | None from this module. |
| **CSV export** | N/A (download) | **Uses already-loaded / visible `orderedPackets` only** (`operatorInboxCsvExport.ts`); no extra fetch for export. |
| **Failed-message panel** | N/A | **Read-only** display derived from in-memory packet messages (`selectFailedMessagesForReadOnlyPanel` in `operatorInboxUtils.ts`); no panel-driven mutations. |

## Guardrail grep (post–PR #69)

Command:

```bash
grep -R "\.insert\|\.update\|\.delete\|rpc(\|functions.invoke\|supabase.functions.invoke" -n \
  src/components/WhatsAppInbox.tsx src/components/whatsapp || true
```

**Recorded output:**

```
src/components/WhatsAppInbox.tsx:357:      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-operator-reply", {
src/components/WhatsAppInbox.tsx:394:      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-classify-intent", {
src/components/WhatsAppInbox.tsx:426:      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-route-packet", {
src/components/whatsapp/operatorInboxLocalNotes.ts:22:      const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : new Date(0).toISOString();
```

### Interpretation

- **`supabase.functions.invoke`:** Exactly **three** call sites, all in `WhatsAppInbox.tsx` — **pre-existing** reply / classify / route paths. PR #69 did **not** add new invokes.
- **`operatorInboxLocalNotes.ts:22`:** **False positive** — the pattern matches the property name **`updatedAt`** (contains the substring `.update`), not a Supabase `.update()` call.
- **No** `.insert`, `.delete`, or `rpc(` hits in the grepped paths.

## Conclusions

1. **No new DB writes** from the local-feature modules; inbox still uses normal reads for list/detail as before.
2. **No new Edge invokes** from saved views, notes, CSV, or read-only panels.
3. **Existing invokes unchanged** in count and purpose (three named functions above).

Re-run the grep after any future inbox edit to keep this audit current.
