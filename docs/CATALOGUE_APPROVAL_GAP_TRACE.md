# Catalogue Approval Gap Trace

**Date:** 2026-06-09  
**Method:** Repo grep only. No code/SQL/migration changes.

---

## 1. Search results — 6 objects

| Object | Repo references (excluding prior audit docs) |
|--------|-----------------------------------------------|
| `catalogue_tag_drafts` | `src/lib/catalogue-approval/catalogueApprovalTypes.ts`, `catalogueApprovalService.ts` (`.from()`), `__tests__/catalogueApprovalService.test.ts`, `__tests__/catalogueApprovalRpc.test.ts`, `src/integrations/supabase/types.ts` |
| `catalogue_alias_drafts` | Same files as tag drafts |
| `approve_catalogue_tag_draft` | `catalogueApprovalService.ts` (`.rpc()`), `__tests__/catalogueApprovalService.test.ts`, `types.ts` |
| `approve_catalogue_alias_draft` | Same |
| `reject_catalogue_tag_draft` | `catalogueApprovalService.ts`, `types.ts` |
| `reject_catalogue_alias_draft` | `catalogueApprovalService.ts`, `types.ts` |

**Migration SQL in repo:** **None** for any of the six.  
**Docs claiming live on Central DB:** `docs/CENTRAL_CONNECTOR_AND_PR06C1B_CLOSEOUT_REPORT.md`, `docs/CENTRAL_FINAL_CATALOGUE_CONNECTOR_CLOSEOUT.md` (PR06C1a pre-existing on production, not re-applied from repo).

---

## 2. Call chain

```
AdminLayout nav → /admin/catalogue-approvals
App.tsx route → ApprovalInbox.tsx
  → createCatalogueApprovalService(supabase)
    → listPendingTagDrafts / listPendingAliasDrafts  → SELECT catalogue_tag_drafts | catalogue_alias_drafts
    → approveTagDraft / approveAliasDraft            → RPC approve_catalogue_*_draft
    → rejectTagDraft / rejectAliasDraft              → RPC reject_catalogue_*_draft
```

**Supporting lib (no direct table/RPC strings beyond service):**  
`parseCatalogueApprovalPayload.ts`, `parseCatalogueApprovalRpcResult.ts`, `catalogueApprovalTypes.ts`, `index.ts`, unit tests.

**No other screens/hooks** reference the six objects.

---

## 3. User visibility

| Surface | Visible? | Who |
|---------|----------|-----|
| Sidebar link “Catalogue approvals” | **YES** (if `products` module) | `SUPER_ADMIN`, `ADMIN` only (`adminModuleAccess.ts`) |
| Direct URL `/admin/catalogue-approvals` | **YES** | Any `ADMIN_STAFF_ROLES` user (no `AdminModuleRoute` on this route) |
| Customer / buyer app | **NO** | — |
| Approve / Reject buttons | **YES** on inbox when drafts load | Staff who open the page |
| Load failure | Error toast if `SELECT` fails (e.g. missing table) | Same |

**Risk:** Nav hidden for most roles, but URL is reachable; empty inbox is benign; **Approve/Reject fail at RPC** if objects missing on DB.

---

## 4. Festival pilot requirement

| Path | Uses approval objects? |
|------|------------------------|
| Customer festival browse (`FestivalRow` → `/catalogue?category=Gifting&festival=…`) | **NO** — reads `products` via `useProducts` |
| Cart / order submit | **NO** |
| Catalogue sync pilot (`/admin/catalogue-sync`, Phase 25C JSON intake) | **NO** — uses `catalogue_product_mappings` + connector sync |
| Admin product CRUD (`/admin/products`) | **NO** |

**Verdict:** Catalogue tag/alias **approval inbox is not required** for current festival/customer ordering pilot. It is only needed if operators run the **AI Catalogue Builder → draft → approve** workflow.

---

## 5. Recommendation

**B. Add missing migration later**

Export/reconcile PR06C1a SQL (`catalogue_tag_drafts`, `catalogue_alias_drafts`, four RPCs) into `supabase/migrations/` so repo matches production and drift reports stay truthful.

**Do not choose C** — references are active, tested, and merged (PR #152).  
**A (disable UI)** only if remote verification shows objects **absent** on the target environment; closeout docs indicate they exist on production Central DB.

**Festival pilot:** No blocker; optionally avoid training staff on `/admin/catalogue-approvals` until migration is in repo and verified on staging.

---

## 6. File index

| File | Role |
|------|------|
| `src/pages/admin/ApprovalInbox.tsx` | UI screen |
| `src/App.tsx` | Route registration |
| `src/components/AdminLayout.tsx` | Nav link |
| `src/lib/catalogue-approval/catalogueApprovalService.ts` | Table reads + RPC writes |
| `src/lib/catalogue-approval/catalogueApprovalTypes.ts` | Table name constants |
| `src/lib/catalogue-approval/parseCatalogueApprovalPayload.ts` | Draft parsing |
| `src/lib/catalogue-approval/parseCatalogueApprovalRpcResult.ts` | RPC result parsing |
| `src/lib/catalogue-approval/index.ts` | Exports |
| `src/lib/catalogue-approval/__tests__/*` | Tests |
| `src/integrations/supabase/types.ts` | Generated types |

---

*Trace complete. No code, SQL, or migrations modified.*
