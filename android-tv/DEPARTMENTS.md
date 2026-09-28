# Oasis Display — device enrollment and assignment

**One APK, many surfaces.** A physical Android TV runs one instance of the Oasis
Display app. The assigned surface (RGS, Trace Gate, production line, etc.) is
governed configuration — not a separate install and not manual URL entry.

## First launch (enrollment)

1. App generates a stable **device ID** (e.g. `FACTORY-RGS-TV-01` pattern set by admin friendly name later).
2. App shows **enrollment code** + QR payload `{ deviceId, enrollCode }`.
3. Administrator opens **Display Management** in Central, enters the code, selects a surface, copies the provisioning command.
4. Administrator applies assignment via ADB (interim) or future remote API (Task 4).
5. App enters fullscreen kiosk on the assigned route.

No operator types URLs, bookmarks routes, or selects hostnames.

## Assignment payload (v1)

```json
{
  "v": 1,
  "surfaceKey": "ready-goods",
  "friendlyName": "FACTORY-RGS-TV-01",
  "location": "Ready Goods Store",
  "configVersion": 1730000000000,
  "assignedAtEpochMs": 1730000000000
}
```

### Interim provisioning (ADB)

```sh
adb shell am start -n com.oasisbaklawa.centraltv/.ui.MainActivity \
  --es oasis_display_assignment '{"v":1,"surfaceKey":"ready-goods","friendlyName":"FACTORY-RGS-TV-01","configVersion":1,"assignedAtEpochMs":1730000000000}'
```

Use **Display Management → TV enrollment** to generate the exact command.

### Legacy department extra (migration only)

```sh
adb shell am start -n com.oasisbaklawa.centraltv/.ui.MainActivity \
  --es oasis_tv_department RGS
```

Maps to surface key via `DisplaySurfaceRegistry` legacy codes.

## Surface catalog

| Surface key | Route | Origin | Production-certified |
|-------------|-------|--------|----------------------|
| `arabic-sweets` | `/tv/arabic-sweets` | Central | Yes |
| `chocolate` | `/tv/chocolate` | Central | Yes |
| `fusion` | `/tv/fusion` | Central | Yes |
| `nuts` | `/tv/nuts` | Central | Yes |
| `bakery` | `/tv/bakery` | Central | Yes |
| `ready-goods` | `/tv/rgs` | Central | Yes |
| `third-party` | `/tv/3pgs` | Central | Yes |
| `assembly` | `/admin/assembly-tv` | Central | **Preview only** |
| `dispatch-central` | `/admin/dispatch-tv` | Central | **Preview only** |
| `trace-gate` | `/tv/gate` | Trace | Yes (Trace software) |
| `trace-dispatch` | `/tv/dispatch` | Trace | Yes (Trace software) |

Preview surfaces may load in the shell but must **not** be certified as production-ready.

Canonical catalog sync:

- `src/lib/displayDevice/displayAssignmentContract.ts`
- `android-tv/.../DisplaySurfaceRegistry.kt`
- `oasis-trace/src/lib/tvDisplaySurfaces.ts`

## Remote configuration (Task 4)

When `DISPLAY_CONFIG_BOOTSTRAP_URL` is set at build time, the APK polls:

```
GET {BOOTSTRAP}/v1/devices/{deviceId}/assignment
```

every 5 minutes. Server-side persistence and display-device auth are **Central/Core Task 4** — not implemented in this client-only PR.

## Diagnostics

From the kiosk view: press **BACK five times within three seconds** to open the
diagnostics screen (APK version, device ID, assignment, hosts, network, last refresh).

## Known upstream gaps (tracked, not worked around in APK)

- **Dedicated read-only TV credential**: web routes still use staff-role sessions until Core ships display-device tokens (Task 4). The APK must never cache staff username/password.
- **Display Management registry**: enrollment UI exists; persistent device registry + last-seen heartbeat server-side is Task 4.
