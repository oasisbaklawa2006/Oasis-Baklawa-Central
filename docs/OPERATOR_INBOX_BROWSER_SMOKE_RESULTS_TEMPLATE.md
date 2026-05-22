# Operator Inbox — browser smoke results (template)

Copy this file per run (e.g. append `_2026-01-15_staging`) or duplicate the table into your release notes. Fill every row during manual QA.

## Session metadata

| Field | Value |
|--------|--------|
| **Date / time (UTC)** | |
| **Tester** | |
| **Environment** | (e.g. staging preview, production) |
| **App build / git SHA** | |
| **Browser + version** | |
| **OS / device** | (e.g. macOS Safari, Windows Chrome, iPhone Safari) |
| **Viewport** | (e.g. 390×844 mobile, 1280×720 desktop) |
| **Login role** | (e.g. ADMIN, SUPPORT_EXECUTIVE — must be allowed by `AdminLayout`) |

## Routes

| Route | Tested? (Y/N) | Notes |
|--------|----------------|--------|
| **Primary:** `/admin/operator-inbox` | | |
| **Optional alias:** `/admin/whatsapp` (same lazy page as primary) | | |

## Functional checks

| Check | Pass / Fail / N/A | Notes |
|--------|-------------------|--------|
| Page loads without blank screen or crash overlay | | |
| **Packet list:** rows render, virtualized scroll OK | | |
| **Detail:** selecting a packet opens thread + header | | |
| **Shortcuts:** `/` focuses search (when rules allow) | | |
| **Shortcuts:** `Esc` — clear search vs collapse insights per rules | | |
| **Shortcuts:** `j` / `k` move selection when not in interactive controls | | |
| **Shortcuts:** arrows / Home / End on focused list | | |
| **Saved views:** save → apply → delete; state matches | | |
| **Local notes:** type → refresh → text persists | | |
| **CSV export:** downloads; row count = visible filtered list only | | |
| **Failed panel:** read-only; outbound operator failed rows only | | |
| **Mobile layout:** list/detail stack; sticky areas usable | | |

## Edge write surfaces (unchanged behavior)

Confirm only existing behavior — no new `functions.invoke` from inbox work.

| Surface | Pass / Fail / N/A | Notes |
|---------|-------------------|--------|
| **Reply** → `whatsapp-operator-reply` | | |
| **Classify** → `whatsapp-classify-intent` | | |
| **Route** → `whatsapp-route-packet` | | |

## Diagnostics

| Check | Pass / Fail / N/A | Notes |
|--------|-------------------|--------|
| **Console:** no unexpected errors / red stacks | | |
| **Network:** no unexpected 5xx spikes | | |
| **PostgREST:** no recurring **400** / **406** on inbox-related requests | | |
| **Select shape:** no “missing column” / schema mismatch in devtools | | |

## Final sign-off

| Field | Value |
|--------|--------|
| **Overall result** | **PASS** / **FAIL** |
| **Blockers (if FAIL)** | |
| **Follow-ups filed?** | (links) |
