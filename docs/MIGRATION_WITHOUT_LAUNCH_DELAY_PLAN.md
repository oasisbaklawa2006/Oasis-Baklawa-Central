# Migration Without Launch Delay Plan

**Date:** 2026-06-13  
**Question:** Can we consolidate product architecture without blocking Batch001 / B2B launch?

**Answer:** **Launch is not delayed** if migration runs as a **parallel track** with a Central feature freeze on new PIM capabilities — not a big-bang cutover.

---

## Will this delay launch?

### **NO** — provided:

1. Central bug fixes continue (product edit reliability, `production_department`, Factory TV matching — PRs #197–#198).  
2. Batch001 pilot completes using **current** Central `products` + manual visibility flip — no wait for full PIM consolidation.  
3. AI Studio blank screen fixed independently (1-line deploy) — does not block Central launch.  
4. Snapshot automation is **Phase 2+**; manual JSON sync already works for pilot.  
5. New PIM features ship in AI Studio **without** removing Central paths until snapshot ingest is proven.

### **YES (delayed)** only if:

- Team attempts big-bang "turn off AdminProducts" before snapshot ingest works  
- AI Studio deploy remains broken during pilot media upload window  
- Forced migration of 300+ SKUs before readiness gates exist  

---

## Phase 4 — Stepwise migration (detailed)

### Step 1 — Freeze Central advanced product development

**Start:** Immediately  
**Duration:** Until AI Studio PIM MVP sign-off

| Continue in Central | Stop in Central |
|---------------------|-----------------|
| Bug fixes (edit UX, numerics, dept) | New tabs/fields on AdminProducts |
| Buyer catalogue display fixes | New AI generators on master |
| Factory TV / dispatch routing | Duplicate channel pricing UI |
| Catalogue sync **import** path | War Room direct alias writes (govern) |
| Batch001 visibility + image upload | New BOM/variant features |

**AI Studio:** May continue building master UX.

---

### Step 2 — Fix AI Studio access

**Blocker:** Production blank screen (`COMPLIANCE_APPROVER` ReferenceError)  
**Action:** Merge permissions fix; verify Vercel env vars; confirm `/auth` loads  
**Launch impact:** None on Central; unlocks internal team testing

---

### Step 3 — Build AI Studio master schema/UX (best of both)

**Consolidate into AI Studio:**

- ProductEdit tab model (breadth)  
- Central unit math + production_department canonical values  
- Central alias blocklist rules  
- Central nutrition QA warning pattern  
- AI Studio media + channel rules + drafts  

**Deliverable:** Product Truth panel mounted on ProductEdit; compliance AI on compliance tab.

**No Central removal yet.**

---

### Step 4 — Snapshot export model

Implement 4 slices per `docs/PRODUCT_SYNC_SNAPSHOT_STRATEGY.md`:

- `central_product_snapshot`  
- `label_product_snapshot`  
- `b2c_product_snapshot` (schema only)  
- `whatsapp_resolver_snapshot`  

Store in `catalogue_versions`; manual export file for Central ingest.

---

### Step 5 — Central imports approved B2B snapshot only

Extend existing `catalogue-connector` to accept enriched snapshot (unit math, visibility, canonical dept).  
Pilot: Batch001 first-5 SKUs via AI Studio publish → Central sync.

---

### Step 6 — Central editing becomes limited override

`/admin/products`:

- Default: read-only detail + link to AI Studio  
- Override drawer: `is_active`, `visible_in_catalog`, emergency price  
- Audit log required before GA

Full edit panel hidden behind `SUPER_ADMIN` feature flag during transition.

---

### Step 7 — Gradual sync enablement

| Week | Mode |
|------|------|
| 1 | Read-only preview diff in Central |
| 2 | Dry-run diff + manual approve |
| 3 | Auto-sync non-price fields |
| 4 | Auto-sync all B2B fields + WA alias slice |

---

## What can continue in Central during migration?

- All order, finance, dispatch, WhatsApp **sends**  
- Buyer catalogue (reads existing `products`)  
- Batch001 image upload to `product-images` / `image_url`  
- Factory TV, RGS, department boards  
- Label command center **preview** (until label snapshot wired)  
- Product intelligence **lab** (read-only)  
- Merchandising sort order  

---

## What should stop immediately?

| Action | Reason |
|--------|--------|
| New master product fields only in Central | Prevents further drift |
| War Room ungoverned alias writes to production | Bypasses approval |
| Treating AI Studio nutrition/compliance AI as approved truth | Regulatory risk |
| Building second multi-image UI in Central | `product_media` exists in shared DB |
| Duplicate catalogue approval inboxes | Confusion |

---

## What moves to AI Studio later?

| Feature | Timing |
|---------|--------|
| Master product create/edit | After Step 3 |
| Multi-image media | After Step 3 (already partial) |
| Channel MOQ/pricing rules | Step 3 |
| Alias/language term authoring | Step 3–4 |
| Catalogue collections / Builder publish | Step 4 |
| Label data master | Step 4–5 |
| Import Category 1 | Already in Studio |

---

## Temporary Central edit allowance

| Field | Until when |
|-------|------------|
| `image_url` (hero) | Until media snapshot ingest proven (Batch001) |
| `visible_in_catalog` | Until publish workflow gates automate |
| `wholesale_price` | Until finance signs off on snapshot-only pricing |
| `production_department` | Until AI Studio publish includes canonical dept (near-term) |
| `grams_per_piece`, `weight_per_box_kg` | Until snapshot includes unit math |

Document each override in ops runbook; reconcile weekly with AI Studio version.

---

## Risk register

| Risk | Severity | Mitigation |
|------|----------|------------|
| Dual master edits | **High** | Freeze + snapshot authority |
| AI Studio down | **High** | Fix blank screen; Central fallback |
| Schema drift (types vs prod) | **Medium** | Regenerate types from Central |
| Stub approve RPCs | **Medium** | Verify PR06B deployment checklist |
| Batch001 blocked on images | **Medium** | Continue Central hero upload path |
| Launch team waits for AI Studio | **Low** | Parallel tracks explicit |

---

## Recommended next actions (ordered)

1. **Merge** Central PRs #197 (production_department) and #198 (edit UX) — unblocks trustworthy Central editing during transition.  
2. **Merge** AI Studio `permissions.ts` fix — restore Studio access.  
3. **Ratify** this architecture with owner (1-page sign-off).  
4. **Pilot** 5 SKUs in AI Studio ProductEdit + export manual snapshot → Central sync.  
5. **Mount** Product Truth + Compliance panels on AI Studio ProductEdit.  
6. **Disable** War Room direct alias promote (flag) after WA snapshot ingest tested.  
7. **Schedule** Central AdminProducts read-only mode (feature flag) after pilot success.

---

## Launch verdict

| Question | Answer |
|----------|--------|
| Does consolidation delay B2B launch? | **NO** (parallel tracks) |
| Does AI Studio blank screen delay launch? | **NO** for Central; **YES** for Studio-first workflow |
| Earliest safe Central edit freeze? | After PR #197/#198 merge + Batch001 hero upload complete |
| Earliest AI Studio as sole master? | After Step 5 pilot (5 SKUs) succeeds |
