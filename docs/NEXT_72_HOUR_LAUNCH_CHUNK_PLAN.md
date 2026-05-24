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
- CMD communication pulse

---

## Remaining launch modules

1. Retail/store coordination
2. Inventory / ready goods visibility
3. Barcode / label flow
4. AI order intake draft flow
5. Notification center
6. Media/document vault
7. Customer timeline
8. Approval/ticket feed builders
9. Production allocation closure
10. Executive dashboard launch view

---

## Recommended build order

1. Retail/store coordination
2. Inventory/ready goods
3. Barcode labels
4. Notifications
5. Media vault
6. Customer timeline
7. AI order intake

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
