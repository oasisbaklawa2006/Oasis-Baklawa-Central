# Oasis Central — Operational UX workflow review

**Purpose:** Translate **crawl evidence** (screenshots + per-viewport `.webm` journeys) into workflow friction. **MOVE 3** review focuses on routes with dense operational UI; refs use `audit-artifacts/screenshots/<project>__<slug>.png` and `audit-artifacts/videos/ux-audit-Mobile-first-full-UX-audit-all-viewports--<project>.webm`.

**Method:** Scroll each full-page capture; note hierarchy, hidden actions, and thumb reach on **iphone-14-pro** first, then **iphone-se** stress.

---

## Finance board (`/admin/finance`, `/admin/finance-board`)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Open board → filter → open row → verify / reject / credit | `iphone-14-pro__admin_finance.png`, `iphone-14-pro__admin_finance-board.png`, videos | Row scan on small width | Many columns compete | Filter + row + modal = 4+ taps | Reject/credit must keep reason capture | Table feels “desktop shrunk” | Mis-tap adjacent row actions | **Read mode** vs **Act mode**; sticky row context; widen min tap row height |

---

## Operator inbox (`/admin/operator-inbox`, `/admin/whatsapp`)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Pick thread → read metadata → compose → send / template | `iphone-14-pro__admin_operator-inbox.png`, `iphone-14-pro__admin_whatsapp.png`, videos | Thread + sidebar + composer visible together | Metadata vs message body fight for attention | Switch thread loses draft if unsaved | Send should confirm when leaving thread with draft | Composer near thumb but metadata scrolls away | Send/attach too close | **Composer dock**; **metadata collapse**; destructive spacing |

---

## Dispatch (`/admin/dispatch`, `/admin/dispatch-mgmt`, `/admin/packing-dispatch`)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Lane view → pick order → pack / label | `iphone-14-pro__admin_dispatch.png`, `...dispatch-mgmt.png`, `...packing-dispatch.png`, videos | Scanning list while walking | Too many status chips | Open detail then back | Partial ship needs explicit confirm | Portrait phone too narrow for two-pane | Wrong lane tap | **Single-column scan**; **haptic-sized** primary; tablet default |

---

## Quick order (`/quick-order`)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| SKU search → qty → add row → submit | `iphone-14-pro__quick-order.png`, videos | Dense grid | Many simultaneous fields | Per-line expand | Clear cart needs confirm | Steppers small | Accidental qty | **Row accordion**; **sticky order summary** |

---

## Approvals (`/admin/approvals`, `/approval-pending`)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Queue → detail → approve / deny | `iphone-14-pro__admin_approvals.png`, `iphone-14-pro__approval-pending.png`, videos | Wide table on phone | Reason + attachments | List → detail → modal | Deny must capture reason | Thumb reach to top toolbar | Approve/deny adjacent | **Card queue**; **sticky decision bar** |

---

## Order details (`/orders/1`, `/admin/orders`)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Timeline → receipt → status actions | `iphone-14-pro__orders_1.png`, `iphone-14-pro__admin_orders.png`, videos | Long vertical narrative | Parallel timelines rare but heavy when present | Expand each block | State-changing actions need modal | Receipt iframe/scroll | Accidental status | **Timeline accordion**; **primary CTA dock** |

---

## Mobile tables (cross-cutting)

| Workflow steps | Screenshot refs | Bottlenecks | Cognitive overload | Excessive clicks | Missing confirmations | Mobile pain points | Dangerous actions | Recommended simplifications |
|----------------|-----------------|-------------|---------------------|------------------|------------------------|--------------------|-------------------|----------------------------|
| Any admin list | finance, orders, clients, inventory shots | Horizontal scan | Column overload | Horizontal scroll inside table only | — | Mis-align tap column | Sort vs row open | **Contained scroll** + **row zoom** pattern |

---

## Fatigue & operator confusion (summary)

| Risk | Surfaces | Mitigation theme |
|------|----------|------------------|
| Visual fatigue | Finance, inbox, dispatch | Reduce simultaneous chrome; calmer typography |
| Decision fatigue | Approvals, finance | Progressive disclosure; default safe sort |
| Thumb fatigue | Mobile admin shell | Move primary actions low; reduce top-heavy toolbars |

---

## Related

- Triage board: `docs/UX_TRIAGE_MASTER_BOARD.md`  
- Failure library: `docs/UX_FAILURE_STATE_LIBRARY.md`  
- Video plan: `docs/UX_PER_PAGE_VIDEO_CAPTURE_PLAN.md`
