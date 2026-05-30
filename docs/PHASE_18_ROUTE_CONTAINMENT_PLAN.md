# PHASE 18 — Route containment plan (no code changes)

**Purpose:** Operational containment for Class **A** and **B** routes during production pilot and initial cutover.  
**Source:** `PHASE_17_LEGACY_WRITE_LOCKDOWN.md`  
**Method:** Access policy, communication, bookmarks, role discipline — **not** application code changes in Phase 18.

**Pilot coordinator** verifies containment briefings completed before first 4B.

---

## Containment methods (legend)

| Method | Description |
|--------|-------------|
| **Disable** | Remove access: revoke nav bookmarks, verbal “do not open,” optional Supabase/Vercel role restriction to URL (if org uses gateway) |
| **Redirect** | If operator lands on route, send to governed board (link card / supervisor) |
| **Communicate** | Slack/email + 5-min standup script + laminated one-pager |
| **Rollback (containment)** | Re-allow route access if pilot halted (not schema rollback) |

---

## Class A routes — disable immediately

### A1 — `/admin/finance-board` (`FinanceReleaseBoard`)

| Field | Detail |
|-------|--------|
| **Owner** | Finance head |
| **Risk** | Direct `orders.update` — payment_status, finance fields without `finance_review_evidence` |
| **Disable** | Remove from team bookmarks; email “do not use during pilot”; finance staff use `/admin/finance-governance` only |
| **Redirect** | Link: `https://<prod-domain>/admin/finance-governance` |
| **Communicate** | Message: “Finance release board is read-only for inquiry; all releases via Finance Governance.” |
| **Rollback (containment)** | Finance head may re-enable for **non-pilot** orders only after pilot PASS |

---

### A2 — `/admin/finance` (`AdminFinance`)

| Field | Detail |
|-------|--------|
| **Owner** | Finance head |
| **Risk** | Direct order payment/status/manufacturing mutations |
| **Disable** | Same as A1; supervisors monitor login analytics if available |
| **Redirect** | `/admin/finance-governance` for pilot orders |
| **Communicate** | Include in finance standup; list pilot SO numbers that must not appear here |
| **Rollback (containment)** | Non-pilot orders only after sign-off |

---

### A3 — Edge: `whatsapp-webhook` (Supabase function)

| Field | Detail |
|-------|--------|
| **Owner** | Engineering owner + Ops (WhatsApp) |
| **Risk** | `orders.update` cancel/dispute/status from automation |
| **Disable** | Ops: do not trigger cancel flows on pilot SOs; Eng: document pilot UUID list in war room (optional: feature flag only if already exists — **no new code in Phase 18**) |
| **Redirect** | Human handling via governance for pilot orders |
| **Communicate** | WhatsApp team: “Pilot orders — manual status only.” |
| **Rollback (containment)** | Restore normal automation when pilot ends |

---

### A4 — Edge: `banyan-central-parser` (Supabase function)

| Field | Detail |
|-------|--------|
| **Owner** | Engineering owner |
| **Risk** | Order updates from parser |
| **Disable** | Pause parser jobs affecting pilot order IDs if operator-controlled; otherwise watch list |
| **Redirect** | Manual order handling |
| **Communicate** | Eng war room note with pilot UUIDs |
| **Rollback (containment)** | Resume parser post-pilot |

---

### A5 — `factory_inventory` writes (floor / production)

| Route / surface | Owner |
|-----------------|-------|
| `/admin/operations` (`AdminOperations`) | Operations manager |
| `/admin/production` (PHH tabs) | Production HOD |
| `/operations-controller` | Production HOD |
| `/admin/ready-goods` (`StockCheckEngine`) | RGS lead |
| Embedded: `FloorTablet`, `phh/QuickEntryTab`, `phh/JobExecutionTab` | Floor supervisor |

| Field | Detail |
|-------|--------|
| **Risk** | Mutates `factory_inventory` — not `inventory_stock_balances`; breaks pilot stock truth |
| **Disable** | Email + floor brief: **no qty adjustments** on pilot SKUs for 5 orders |
| **Redirect** | Inventory issues → inventory lead + `/admin/stock-finalization` (post-4E) |
| **Communicate** | List pilot SKUs on warehouse whiteboard |
| **Rollback (containment)** | Lift SKU freeze per SKU after order completes 4G |

---

## Class B routes — redirect to governance

For each route: **prep allowed**; **order closure** must use 4B→4G. **Do not** set `dispatched` except via 4E.

### B1 — `/admin/order-management`

| Field | Detail |
|-------|--------|
| **Owner** | Operations manager |
| **Disable** | Partial — no disable; restrict **pilot order IDs** |
| **Redirect** | Status changes → golden chain; `dispatched` already blocked in UI |
| **Communicate** | “Pipeline for prep only; pilot orders follow 4B–4G card.” |
| **Rollback** | Normal use for non-pilot orders |

---

### B2 — `/admin/orders`

| Field | Detail |
|-------|--------|
| **Owner** | Operations manager |
| **Redirect** | Same as B1; dispatched advance blocked (toast) |
| **Communicate** | Supervisors watch pilot SOs |
| **Rollback** | Normal for non-pilot |

---

### B3 — `/admin/accounts-release`

| Field | Detail |
|-------|--------|
| **Owner** | Finance head |
| **Redirect** | Gate pass data OK; order close → `/admin/dispatch-finalization` |
| **Communicate** | “Gate pass does not dispatch order during pilot.” |
| **Rollback** | Non-pilot orders |

---

### B4 — `/admin/packing-dispatch`, `/admin/dispatch`

| Field | Detail |
|-------|--------|
| **Owner** | Dispatch head |
| **Redirect** | Partial legs only; full close → 4E |
| **Communicate** | Banner + finalization link (in-app) |
| **Rollback** | Non-pilot dispatch ops |

---

### B5 — `/admin/dispatch-mgmt`

| Field | Detail |
|-------|--------|
| **Owner** | Dispatch head |
| **Redirect** | Pack/DPL only; not `dispatched` |
| **Communicate** | Pair with 4B–4E training |
| **Rollback** | Normal |

---

### B6 — `/admin/ready-goods`

| Field | Detail |
|-------|--------|
| **Owner** | RGS lead |
| **Redirect** | No `packed_ready` jump on pilot orders without ops approval |
| **Communicate** | Pilot SO list at RGS desk |
| **Rollback** | Per order after 4G |

---

### B7 — `/admin/production`

| Field | Detail |
|-------|--------|
| **Owner** | Production HOD |
| **Redirect** | Production prep only; no pilot status/inventory side effects |
| **Communicate** | PHH tab discipline |
| **Rollback** | Normal |

---

### B8 — `/admin/operations`

| Field | Detail |
|-------|--------|
| **Owner** | Operations manager |
| **Redirect** | Smart split — no pilot SKU `factory_inventory` changes |
| **Communicate** | Cross-ref A5 SKU list |
| **Rollback** | Normal |

---

### B9 — `/operations-controller`

| Field | Detail |
|-------|--------|
| **Owner** | Production HOD |
| **Redirect** | Same as B7/B8 |
| **Communicate** | Handheld briefing |
| **Rollback** | Normal |

---

### B10 — `/admin/cmd-war-room`

| Field | Detail |
|-------|--------|
| **Owner** | CMD / ops lead |
| **Redirect** | Draft/submit only; no pilot order closure |
| **Communicate** | CMD is not dispatch authority during pilot |
| **Rollback** | Normal |

---

### B11 — `/admin/3pcs-store`

| Field | Detail |
|-------|--------|
| **Owner** | Store lead (3PC) |
| **Redirect** | Do not mutate pilot orders |
| **Communicate** | Pilot list shared |
| **Rollback** | Normal |

---

### B12 — `/admin/inventory` (factory stock admin)

| Field | Detail |
|-------|--------|
| **Owner** | Inventory manager |
| **Redirect** | Governed stock via 4F/4G for pilot SKUs |
| **Communicate** | Dual-system awareness |
| **Rollback** | Normal |

---

### B13 — `/admin/reservation-board` (staging seed only)

| Field | Detail |
|-------|--------|
| **Owner** | Inventory lead |
| **Redirect** | Seed buttons **only** when UI shows blockers; document in matrix |
| **Communicate** | Not a legacy bypass — governed panel is write path |
| **Rollback** | N/A |

---

## Class C routes — no containment (reference)

Use for golden chain only:

- `/admin/dispatch-readiness` (4B)
- `/admin/finance-governance` (4C)
- `/admin/dispatch-completion` (4D)
- `/admin/dispatch-finalization` (4E)
- `/admin/reservation-board` (4F)
- `/admin/stock-finalization` (4G)
- `/security-gate` (carton only — not order dispatched)

---

## Containment sign-off (before first 4B)

| Role | A routes briefed | B routes briefed | Signature | Date |
|------|------------------|------------------|-----------|------|
| Finance head | ☐ | ☐ | | |
| Dispatch head | ☐ | ☐ | | |
| Inventory lead | ☐ | ☐ | | |
| Operations manager | ☐ | ☐ | | |
| Pilot coordinator | ☐ | ☐ | | |

---

*End of route containment plan.*
