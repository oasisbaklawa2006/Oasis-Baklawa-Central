# Oasis Central TV (Android)

A dedicated, installable Android TV / Google TV application for the owner's
six-TV production/RGS estate (Central issue #368). This is **not** a PWA and
**not** a general browser pointed at Central — it is a single-purpose kiosk
app: one WebView, one allowlisted origin, one assigned department per
device, fullscreen immersive, auto-launch on boot, fail-closed on auth or
network failure.

Core remains the backend authority for every number shown. Trace remains
the label/barcode/printer authority — this app never talks to a printer.
Central (this WebView's content) supplies only the display UI; the app adds
no write capability beyond what the loaded web page itself allows a
read-scoped TV session to do.

## Structure

```
android-tv/
  app/
    src/main/java/com/oasisbaklawa/centraltv/
      OasisTvApplication.kt     — installs crash-recovery handler
      ui/MainActivity.kt        — the kiosk: WebView, immersive mode, retry/backoff, network state
      ui/DiagnosticsActivity.kt — on-site troubleshooting screen (hidden 5x-BACK gesture)
      net/AllowlistPolicy.kt    — HTTPS-only, single-origin navigation allowlist
      net/NetworkStateMonitor.kt— Wi-Fi / connectivity flow
      session/DeviceConfig.kt   — per-device department assignment + device id
      util/BootReceiver.kt      — auto-launch after boot/power recovery
      util/CrashRecoveryHandler.kt — process-level crash -> scheduled restart
  DEPARTMENTS.md   — how to provision a device to one of the six TVs
  RELEASE_SIGNING.md — why CI only builds unsigned, and what signing requires
```

## Building

Requires a local Android SDK (not present in this session's environment —
see the root Lane 1 report for what that means for verification). With one
installed:

```sh
cd android-tv
./gradlew :app:assembleDebug
./gradlew :app:lintRelease :app:testDebugUnitTest
```

The `./gradlew` wrapper script is checked in, but its wrapper JAR is not
(binary files aren't hand-authored) — run `gradle wrapper --gradle-version
8.7` once locally to regenerate it, or let CI provision Gradle directly (see
`.github/workflows/android-tv-ci.yml`, which uses
`gradle/actions/setup-gradle` and does not depend on the wrapper jar being
present).

## What is PHYSICAL-DEVICE-ONLY

Everything about compiling, lint-checking, and reasoning about this app's
behavior is done in software and covered above. What cannot be verified
without the actual hardware:

- installing the APK on the selected TV / Android HDMI player and
  confirming it boots into the kiosk view;
- manufacturer-specific autostart/boot behaviour (some OEM Android TV
  builds restrict `RECEIVE_BOOT_COMPLETED` further than stock AOSP);
- real remote-control navigation and the 5x-BACK diagnostics gesture on
  actual remote hardware;
- Device Owner / lock-task provisioning via MDM or `dpm set-device-owner`
  (a physical/ADB step per unit, not something CI can do);
- factory Wi-Fi recovery timing, power-failure/reboot behaviour, and
  long-duration burn-in;
- actual TV resolution/overscan rendering of the existing web `/tv/*`
  layouts (those layouts were built and tested for browsers, not
  necessarily audited yet for real TV overscan — flagged as a follow-up in
  the Lane 1 report, not silently assumed fine).
