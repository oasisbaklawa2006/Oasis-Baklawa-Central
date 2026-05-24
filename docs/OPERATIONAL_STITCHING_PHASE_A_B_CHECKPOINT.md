# Operational stitching — Phase A / B checkpoint (post-merge)

**Merged:** PR #93 (`feat(operational): WhatsApp + order trace operational stitching`) — merge commit on `main` as of 2026-05-24.  
**Companion narrative:** `docs/OPERATIONAL_STITCHING_SPRINT_REPORT.md`

---

## 1. What shipped

| Area | Outcome |
|------|---------|
| **Operational event model** | `src/lib/operational-events/` — shared types, `OperationalEventKind` / `WhatsAppOperationalEventKind`, severity, actor, entity refs, dedupe + sort (`normalizeWhatsAppEvents`, `mergeOperationalEventFeeds`). |
| **WhatsApp projections** | `buildWhatsAppOperationalFeed` — read-only rows from packet + messages (in/out, stale, waiting, escalation heuristics, attachment rollup); no model authority. |
| **Order trace unified timeline** | `OrderTraceSheet` + `OperationalTimeline` — order-derived feed + optional `wamid` correlation hint; category filters; day grouping. |
| **Inbox operational context panel** | `OperatorInboxOperationalContextPanel` in insights aside — health, SLA bucket, text-only order hints, embedded timeline. |
| **CMD communication pulse** | `CmdOperationalCommPulse` on War Room — open vs stale open packets (read `whatsapp_message_packets`), finance-wait and dispatch-panic counts from existing orders; links to inbox / orders. |

---

## 2. What remains

- **Real order ↔ packet SQL join** — beyond `orders.wamid` hint and inbound text token extraction.
- **Approvals / tickets / invoices** — dedicated feed builders merged into the same timeline vocabulary.
- **Media vault** — true previews, signed URLs, and entity-linked vault (current work stops at heuristics + chips).
- **Notification engine** — deduped, acknowledgeable alerts mapped from the same event kinds.
- **Retail / store events** — store-scoped projections for reservations and floor coordination.

---

## 3. Safety (guardrails honored in this slice)

- **No new automation** — timelines are projections; no auto-send, auto-route, or auto-escalate.
- **No new writes** in the stitching layer — `operational-events` is pure TS; PR diff does not add `insert` / `update` / `delete` / `rpc` in touched stitching paths. (`CMDWarRoom` still contains pre-existing order `update` flows unrelated to the pulse read path.)
- **No new Edge functions** — none added; `WhatsAppInbox` retains only existing `functions.invoke` calls (reply, classify, route).
- **No migrations** — schema unchanged.
- **Read-only projection layer** — client-side rebuild of feeds; not a persisted audit log.

---

## 4. Next recommended module

Pick one:

1. **Cross-module timeline expansion** — wire approvals / tickets / finance events into `mergeOperationalEventFeeds` + `OperationalTimeline` on order detail and CMD.  
2. **Retail / store coordination** — store event kinds + surface in a thin dashboard using the same primitives.

---

## 5. Current readiness

- **Communication visibility** improved for operators (inbox context + trace + CMD pulse) without changing who controls execution.
- **Execution remains human-controlled** — C2C / autonomous execution posture unchanged; stitching is visibility and context only.
