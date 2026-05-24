# Next 72-hour launch chunk plan

Purpose: map remaining launch work into **module-by-module closures** so each chunk ships with clear boundaries, verification, and no scope creep.

---

## Current completed foundations

- UX audit and closure framework
- finance / dispatch / approvals / mobile UX hardening
- C2C governance freeze
- operational event spine
- WhatsApp communication projection
- order trace stitched timeline
- CMD communication pulse (+ read-only **factory_inventory** row count strip — not shelf stock)
- **Retail store coordination** (B1 route + B2 visibility + **read-only factory_inventory snapshot** + B5 store + inventory operational projections)

---

## Retail / store coordination — next required

**Done (partial):** B1 shell, B2 outlet / reservation / factory **UI + honest placeholders**, B5 **projection feeds** + merged timeline + unit tests, **read-only `factory_inventory` visibility** (factory-row level; not shelf truth).

**Still required for “real” coordination:**

- **Shelf-level** inventory / ready goods read (barcode or POS-backed) wired to cards (still no fake qty)
- Reservation **persistence** and conflict rules (operator-gated writes, separate approval)
- Factory follow-up **persistence** and linkage to production jobs / WhatsApp hints (read-first)
- Optional: dedicated **retail** timeline filter chip (currently uses existing `OperationalTimeline` categories only)

---

## Remaining launch modules

1. Retail/store coordination (shelf-level stock truth — see `docs/INVENTORY_READY_GOODS_VISIBILITY_STATUS.md`)
2. Barcode / label flow
3. AI order intake draft flow
4. Notification center
5. Media/document vault
6. Customer timeline
7. Approval/ticket feed builders
8. Production allocation closure
9. Executive dashboard launch view

---

## Recommended build order

1. Retail/store coordination (shelf-level inventory still open — see `docs/INVENTORY_READY_GOODS_VISIBILITY_STATUS.md`)
2. Barcode / label flow (receiving truth)
3. Notifications
4. Media vault
5. Customer timeline
6. AI order intake

Later passes can fold in **approval/ticket feed builders**, **production allocation closure**, and **executive dashboard launch view** once the above surfaces stabilize.

---

## 3-day launch realistic target

**Pilot-ready internal operations**, not full autonomous automation. Favor: one module per branch, read-only or explicitly gated writes, typecheck + build (+ targeted tests) per merge.

---

## Hard deferrals

- autonomous WhatsApp send
- production C2C writes
- unsupervised AI order placement
- deep analytics
- full event persistence store

These stay out of the 72-hour closure path unless product explicitly reopens them with separate risk review.
