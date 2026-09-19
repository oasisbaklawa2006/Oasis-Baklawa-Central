# Task 2 — Oasis Display Android TV Shell

**Repository:** `oasisbaklawa2006/Oasis-Baklawa-Central`  
**Build authority:** `android-tv/`  
**Applies to:** Task 2 Trace/device finalisation (display shell contract)  

---

## Certification states

| Gate | State |
|------|-------|
| **TV SHELL SOFTWARE** | **NOT CERTIFIED** until exact-head `android-tv-ci` is green on merge candidate |
| **ANDROID TV PHYSICAL UAT** | **PENDING** — requires real Android TV hardware (`oasis-trace/docs/TASK2_ANDROID_TV_UAT.md`) |
| Release APK signing | **OWNER GATE** — CI produces unsigned release only (`android-tv/RELEASE_SIGNING.md`) |
| Remote assignment API | **TASK 4** — client polls; server not implemented here |
| Display-device credential | **TASK 4** — Core/Central; no staff password in APK |

Browser URL entry or desktop WebView testing does **not** satisfy physical UAT.

---

## Delivered in this change set

- Unified Oasis Display APK v2.0.0 (`com.oasisbaklawa.centraltv`)
- First-launch enrollment (device ID, code, QR)
- Governed surface catalog (Central + Trace routes)
- Assignment via `oasis_display_assignment` intent + Display Management UI
- Remote config client stub (Task 4 bootstrap URL)
- Multi-origin HTTPS allowlist (Central + Trace)
- Kiosk behaviour preserved (immersive, boot receiver, crash recovery, reconnect overlay)
- Expanded diagnostics
- Shared contract: `src/lib/displayDevice/displayAssignmentContract.ts`
- CI unsigned release artifact: `oasis-tv-unsigned-release`

---

## Task 4 dependencies (Central/Core — do not implement shadow backend in Trace)

1. `GET /v1/devices/{deviceId}/assignment` with display-device read token
2. Display Management device registry (TV, location, assigned view, status, last seen, APK version)
3. Revocable read-only display credential (fail closed on revocation)

Trace participation: route catalog + read-only `/tv/gate`, `/tv/dispatch` web surfaces only.
