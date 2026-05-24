# Notification Center — foundation status

Last updated: 2026-05-24

## Scope

First **visibility-only** notification layer for staff. **Not** a send engine: no SMS, WhatsApp, email, push, outbox, retries, scheduling, or persistence.

## Delivered

| Path | Purpose |
|------|---------|
| `src/lib/notifications/notificationTypes.ts` | Projection topics, source filters, backend status labels |
| `src/lib/notifications/notificationSeverity.ts` | Topic → display severity (for UI / feed only) |
| `src/lib/notifications/notificationProjection.ts` | Deterministic catalog + filters |
| `src/lib/operational-events/notificationFeed.ts` | `buildNotificationOperationalFeed` → `OperationalEventRecord[]`, `occurredAt: null` |
| `src/pages/admin/NotificationCenter.tsx` | Admin UI: cards, severity/source filters, projection timeline |
| `/admin/notification-center` | Route + sidebar (moduleKey `orders`) |

## Operational kinds (read-only)

See `NotificationOperationalEventKind` in `src/lib/operational-events/types.ts` (`notification.*` namespace).

## What is real

- Pure projection builders and Vitest coverage for catalog + feed (`src/lib/notifications/__tests__/`, `notification-media-feed.test.ts`).
- CMD War Room passes **bounded** finance / dispatch / WhatsApp stale signals into the feed to enrich copy — still not delivery.

## What is shell / pending backend

- Unified notification **outbox**, channel credentials, templates, user preferences, and audit of sends.
- Binding individual cards to live per-user unread state.

## Safety

- No outbound notifications.
- No `functions.invoke` for delivery.
- No DB writes from this module.
- No automation.

## Next backend work (separate PRs)

- Reviewed notification service + audit log.
- Channel adapters (WhatsApp Business API already used elsewhere for **manual** operator paths — do not auto-bridge from this screen).
