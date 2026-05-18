# Sprint C1 — WhatsApp Intelligence: deployment & test checklist

This document defines **prerequisites**, the **exact order** in which handoff files must be copied into this repository (when replacing or adding artifacts from your Sprint C1 bundle), and **gates** between steps.  
Execution is **sequential**; wait for explicit confirmation before the next step.

---

## Global rules (do not violate)

- Do **not** refactor existing app code outside the listed targets.
- Do **not** change database schema unless a step explicitly says to run a migration / SQL.
- Do **not** rename routes, tables, columns, or Supabase Edge Function **names** / paths.
- Copy handoff files **verbatim** to the **exact target paths** below (byte-for-byte unless a step explicitly allows a merge).
- If a target file **already exists** in the repo, **show a diff** (handoff vs current) and get approval before replacing.
- Run **`npm run typecheck`** / **`npm run build`** only when a step instructs you to.
- After each step: report **status** (what changed, what was skipped) and **stop for confirmation**.

---

## Prerequisites (before any copy/deploy)

| # | Prerequisite | Notes |
|---|----------------|--------|
| P1 | **Sprint C1 handoff bundle** | Directory or archive containing the exact files to copy (referred to below as `<BUNDLE>/`). Paths under `<BUNDLE>/` must match your packager’s layout; adjust only the left-hand side if your tree differs—**never** change the repo target paths in the right column. |
| P2 | **Git** | Clean working tree or intentional branch; know which branch receives Sprint C1 (e.g. `main` or release branch). |
| P3 | **Supabase project** | Project ref `tcxvcatsqqertcnycuop` (from `supabase/config.toml`) linked for CLI if you deploy from local machine. |
| P4 | **Supabase CLI** | Installed; `supabase login` or `SUPABASE_ACCESS_TOKEN` for non-interactive deploys. |
| P5 | **Remote secrets** | Edge functions assume env vars already set in Supabase (e.g. `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, Click2API / MSG91 keys as required by `send-whatsapp` and webhooks). Operator reply **invokes** `send-whatsapp` with the service role. |
| P6 | **Dependencies** | `send-whatsapp` must be deployed and working before `whatsapp-operator-reply`. Stitcher assumes `whatsapp_messages` / `whatsapp_message_packets` (and RLS/policies) already match your environment. |

---

## STEP 1 — Exact file copy order (targets in repo)

Copy **in this order** so downstream pieces exist before dependents. Sources are placeholders: replace `<BUNDLE>/...` with your actual handoff paths.

| Order | Copy from (handoff) | Copy to (repo target) | Purpose |
|------:|---------------------|-------------------------|---------|
| 1 | `<BUNDLE>/supabase/config.toml` **snippets only** | Merge into `supabase/config.toml` | Function blocks such as `[functions.whatsapp-message-stitcher]`, `[functions.whatsapp-identify-sender]`, `[functions.whatsapp-operator-reply]` with `verify_jwt = false` (and any other **new** function entries). **Do not** rename existing entries. Prefer manual merge over blind overwrite if the repo file has other functions. |
| 2 | `<BUNDLE>/supabase/functions/whatsapp-message-stitcher/index.ts` | `supabase/functions/whatsapp-message-stitcher/index.ts` | **TOOL 0** — stitch inbound raw messages into packets. |
| 3 | `<BUNDLE>/supabase/functions/whatsapp-identify-sender/index.ts` | `supabase/functions/whatsapp-identify-sender/index.ts` | **TOOL 2** — sender classification. |
| 4 | `<BUNDLE>/supabase/functions/whatsapp-operator-reply/index.ts` | `supabase/functions/whatsapp-operator-reply/index.ts` | **TOOL 1 Phase 2** — operator reply; depends on `send-whatsapp`. |
| 5 | `<BUNDLE>/src/components/WhatsAppInbox.tsx` | `src/components/WhatsAppInbox.tsx` | **TOOL 1** — inbox UI. |
| 6 | `<BUNDLE>/src/pages/OperatorInbox.tsx` | `src/pages/OperatorInbox.tsx` | **TOOL 1** — operator page shell. |
| 7 | `<BUNDLE>/src/App.tsx` (only if handoff includes route wiring) | `src/App.tsx` | Lazy import + `<Route path="operator-inbox" … />` under `/admin`. **If repo already has this route, skip unless diff approved.** |
| 8 | `<BUNDLE>/src/components/AdminLayout.tsx` (only if handoff includes nav) | `src/components/AdminLayout.tsx` | Sidebar link to `/admin/operator-inbox`. **If already present, skip unless diff approved.** |
| 9 | `<BUNDLE>/test-whatsapp.sh` (optional) | `test-whatsapp.sh` (repo root) | Local curl smoke tests against `send-whatsapp` / `send-whatsapp-automation`. |

**Not copied by this checklist (already product code — deploy only, do not rename):**

- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/send-whatsapp-automation/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`

---

## Suggested deploy order (Supabase CLI, after copies are committed)

1. `whatsapp-message-stitcher`  
2. `whatsapp-identify-sender`  
3. `whatsapp-operator-reply`  

(Re-deploy `send-whatsapp` / `whatsapp-webhook` only if your checklist or release notes say so.)

---

## After STEP 1 (this document)

- **You:** Confirm the bundle paths, approve merge strategy for `config.toml`, and say whether `App.tsx` / `AdminLayout.tsx` are in scope for this sprint.  
- **Then:** Proceed to the next checklist step (e.g. copy execution + diff review per file) only when you instruct.

---

## Status — STEP 1 (checklist authoring)

| Item | Status |
|------|--------|
| `DEPLOYMENT_AND_TEST_CHECKLIST.md` | **Created** at repo root (no prior file → **no diff**). |
| File copy order | **Documented** in table above. |
| Prerequisites | **Documented** in prerequisites table. |

**Stopped here per your instructions.** Confirm to proceed to the next step (e.g. run copies from `<BUNDLE>/` or adjust the table paths to match your packager).
