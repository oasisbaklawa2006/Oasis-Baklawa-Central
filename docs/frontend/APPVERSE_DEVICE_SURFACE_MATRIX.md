# App-Verse Device Surface Matrix

Purpose: define which information density and interaction style belongs on desktop, mobile/handheld and TV before implementation begins.

## Desktop / laptop

Best for:
- management command views
- finance review
- multi-column customer/WhatsApp context
- deep order detail
- audit/evidence drill-down
- administration and governance

Design rules:
- left workspace navigation
- dense but readable tables only where comparison is required
- detail drawers to avoid unnecessary page changes
- keyboard/search friendly
- support large monitors without creating empty KPI walls

## Mobile (phone)

Best for:
- manager quick review on the move
- WhatsApp/support operator continuation
- short approvals with minimal context
- lightweight queue monitoring

Design rules:
- one task per screen
- touch target minimum suitable for fast operational use
- no desktop table shrunk to mobile
- queue -> detail -> action flow
- bottom navigation where appropriate
- camera actions available but secondary to queue/action flow

## Handheld (scanner / shop-floor device)

Best for:
- production execution
- stores actions
- packing and dispatch
- barcode/QR interactions
- evidence capture at point of work

Design rules:
- one task per screen
- touch target minimum suitable for gloved/fast operational use
- no desktop table shrunk to handheld
- queue -> detail -> action flow
- persistent contextual action dock where appropriate
- camera/scanner actions visually dominant where the workflow requires them
- show evidence capture immediately after the action that requires it

## TV / operational display

Existing registered surfaces include:
- Arabic Sweets line
- Chocolate line
- Dragees line
- Fusion Sweets line
- Bakery line
- Nuts line
- Assembly TV
- Ready Goods TV
- Dispatch TV

TV purpose:
- ambient awareness
- current workload
- priority sequence
- blockers
- due/overdue status
- output/progress where backend truth exists

TV must not behave as a stretched desktop dashboard.

TV design rules:
- read from distance
- very limited text
- large numerals/status labels
- no hover dependence
- no modal dialogs
- no dense table pagination
- auto-refresh only from authoritative data
- clearly indicate stale/offline data
- display station/department identity permanently
- use color as secondary reinforcement, never the only status signal

## Surface-by-role matrix

| Role family | Desktop | Mobile (phone) | Handheld (scanner) | TV |
|---|---|---|---|---|
| CMD / executive | Primary command + deep drill | Compact exception/approval view | Limited | Optional enterprise summary only |
| Finance | Primary | Approval/verification companion | Limited | Not default |
| Operations manager | Primary | Strong companion | Execution companion | Department/plant summary |
| Production HOD | Strong | Monitoring companion | Primary execution companion | Primary ambient board |
| Shop-floor production | Limited | Limited | Primary | Primary ambient board |
| Stores | Strong | Monitoring companion | Primary execution | Ready-goods/material status where useful |
| Packing | Strong | Limited | Primary execution | Packing/dispatch readiness |
| Dispatch | Strong | Limited | Primary execution | Primary dispatch wall |
| Gate/security | Limited | Limited | Primary | Optional gate status |
| WhatsApp/support operator | Primary | Strong companion | Limited | Not default |
| Support manager | Primary | Compact monitoring | Limited | Optional SLA board |
| Catalogue contributor | Primary | Secondary | Limited | Not default |
| Governance/admin | Primary | Limited | Limited | Not default |

## Responsive implementation rule

Responsive does not mean the same information rearranged at smaller widths. Each surface may intentionally expose a different subset of the same backend truth because the user goal changes with device context.

## Offline / stale-state requirement

Operational handheld and TV surfaces must visibly distinguish:
- live
- reconnecting
- stale data
- offline

No execution control should imply success solely because the UI accepted a tap; write success must come from the authoritative backend response.

## Implementation dependency

This matrix can be finalized independently. Actual App-Verse mobile navigation and role-specific surface integration should begin only after PR #319 is merged/rebased because those components own the canonical role/workspace presentation layer.
