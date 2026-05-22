# Sprint C2B — next safe slice after local inbox features

**Context:** PR #69 merged. Read-only/client/localStorage capabilities are in place: saved views, per-packet notes, CSV from visible rows, stricter failed-message panel, keyboard and insights UX hardening.

**Constraints for the next slice:** Same global rules — **no migrations**, **no Supabase CLI**, **no manual deploy**, **no Edge edits**, **no new `functions.invoke`**, **no insert/update/delete/rpc** from inbox work, **no TOOL 5 writes**. Prefer **browser-only** fixes and polish.

## Recommended next work (in order of safety)

1. **Browser smoke fixes only**  
   Address issues found while running `docs/POST_MERGE_PR69_OPERATOR_INBOX_SMOKE.md` (focus traps, edge-case shortcuts, empty states, copy).

2. **Responsive polish**  
   Fine-tune breakpoints, spacing, and scroll containment on small screens without changing data flow.

3. **Accessibility polish**  
   Labels, live regions, listbox/roving tabindex, contrast, and keyboard order — still read-only.

4. **Optional read-only route alias**  
   If product wants a second URL (e.g. `/admin/whatsapp`), add a **duplicate route** to the same inbox component with **no** new loaders or server behavior — routing-only change.

## Explicitly out of scope until policy changes

- Database migrations or RLS changes  
- New or altered Edge Functions  
- New `supabase.functions.invoke` or direct writes  
- Broadening CSV to server-side or paged full exports  

## Definition of done (next PR)

- Typecheck + build green  
- Guardrail grep clean per policy (or documented false positives only)  
- Smoke doc updated if checklist items or routes change  
