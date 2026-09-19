# Oasis Display (Android TV)

One installable Android TV / Google TV application hosts **all** governed Oasis
operational display surfaces (Central production lines, RGS, 3PGS, Trace gate/dispatch,
and future CMD surfaces). This is **not** a browser URL entry workflow and **not**
a separate APK per screen.

Core remains the backend authority for every number shown. Trace remains the
label/barcode/printer authority — this app never talks to a printer. Central
(Display Management + web `/tv/*` routes) supplies display UI; the APK adds kiosk
behaviour, device enrollment, and origin allowlisting only.

## Architecture

```
Oasis Display APK (com.oasisbaklawa.centraltv)
  → stable device ID + enrollment code (first launch)
  → Central Display Management assignment (admin)
  → governed surface key → resolved HTTPS route
  → fullscreen read-only kiosk WebView
  → optional remote config poll (Task 4 API)
```

Changing RGS TV → Dispatch TV is a **configuration change**, not an APK reinstall.

## Structure

```
android-tv/
  app/src/main/java/com/oasisbaklawa/centraltv/
    ui/MainActivity.kt           — kiosk WebView, enrollment, config refresh
    ui/DiagnosticsActivity.kt    — admin diagnostics (5× BACK gesture)
    session/DisplaySurfaceRegistry.kt — unified surface catalog
    session/DisplayAssignment.kt      — v1 assignment JSON contract
    session/DisplayConfigClient.kt      — remote assignment poll (Task 4)
    session/DeviceConfig.kt             — device id, enrollment, assignment
    net/AllowlistPolicy.kt              — HTTPS Central + Trace allowlist
    net/NetworkStateMonitor.kt
    util/BootReceiver.kt
    util/CrashRecoveryHandler.kt
    util/EnrollmentQrEncoder.kt
  DEPARTMENTS.md        — enrollment + assignment (v2)
  RELEASE_SIGNING.md    — owner keystore; CI builds unsigned release only
```

## Build config

| Field | Purpose |
|-------|---------|
| `CENTRAL_WEB_ORIGIN` | Central web host (default production) |
| `TRACE_WEB_ORIGIN` | Trace web host for `/tv/gate`, `/tv/dispatch` |
| `DISPLAY_CONFIG_BOOTSTRAP_URL` | Optional Task 4 assignment API base |

Set via Gradle property, env var at build time, or CI workflow env.

## Building

Requires Android SDK + Gradle 8.7. CI uses `gradle/actions/setup-gradle` and does
not require a committed wrapper JAR.

```sh
cd android-tv
gradle :app:lintRelease :app:testDebugUnitTest :app:assembleRelease
```

Artifact: `app/build/outputs/apk/release/app-release-unsigned.apk` (rename to
`Oasis-TV-2.0.0-unsigned.apk` in CI). Owner signing per `RELEASE_SIGNING.md`.

## What is PHYSICAL-DEVICE-ONLY

- Installing APK on Android TV hardware and confirming kiosk boot
- OEM-specific autostart / lock-task behaviour
- Real remote-control navigation and 5× BACK diagnostics
- TV resolution/overscan rendering of web layouts
- Physical UAT matrix: `oasis-trace/docs/TASK2_ANDROID_TV_UAT.md`

Browser emulation does **not** satisfy Android TV physical certification.

## Task 4 dependencies (not in this client)

- Remote assignment API persistence (`GET …/v1/devices/{deviceId}/assignment`)
- Display-device read-only credential (Core/Central — no staff password in APK)
- Display Management device registry (last seen, health, remote reassignment)

See `src/lib/displayDevice/displayAssignmentContract.ts` for the shared contract.
