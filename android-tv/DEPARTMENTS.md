# Oasis Central TV — department provisioning

One physical Android TV device runs one instance of this app, assigned to
exactly one of the owner's six TVs (Central issue #368). The department is
set once per device and persisted locally; it is **not** derived from a
human login.

| `oasis_tv_department` value | Route loaded | Covers |
|---|---|---|
| `ARABIC_SWEETS` | `/tv/arabic-sweets` | Arabic sweets, frozen, semi-finished, semi-prepared |
| `CHOCOLATES_CONFECTIONERY` | `/tv/chocolate` | Chocolates & confectionery, dragees |
| `FUSION_SWEETS` | `/tv/fusion` | Fusion sweets, dates |
| `SEASONED_NUTS_MIXES` | `/tv/nuts` | Seasoned nuts & mixes |
| `BAKERY` | `/tv/bakery` | Bakery only |
| `RGS` | `/tv/rgs` | Ready Goods Store |

## Provisioning a new device

Over USB/ADB, once, before mounting the TV:

```sh
adb shell am start -n com.oasisbaklawa.centraltv/.ui.MainActivity \
  --es oasis_tv_department RGS
```

The app persists the assignment to local `SharedPreferences` on first
launch with that extra present. Subsequent boots (including after power
loss, via `BootReceiver`) come back on the same department automatically —
no extra needs to be passed again unless the device is being reassigned.

To confirm what a device is currently assigned to without re-provisioning
it, use the on-device diagnostics screen (five BACK presses within three
seconds from the kiosk view).

## Known upstream gaps this app inherits (tracked, not silently worked around)

- **Dedicated read-only TV identity**: the web routes this app loads
  (`/tv/*`) are currently gated by `RoleProtectedRoute` against ordinary
  staff roles (e.g. `HOD_ARABIC`, `PROD_ARABIC`) that also carry production
  *write* authority elsewhere in Central. There is no TV-specific,
  read-only role/session family yet. Until Core ships one (a new `TV_*`
  role class + RLS, out of scope for this Android client), a device's
  session is provisioned using a staff account scoped as tightly as the
  existing role system allows, and the app never performs a write action
  regardless of what the underlying account could do server-side.
- **`CENTRAL_WEB_ORIGIN`** is a Gradle property, not hardcoded — see
  `app/build.gradle.kts`. Set it per environment via
  `-PCENTRAL_WEB_ORIGIN=https://...` or the `CENTRAL_WEB_ORIGIN` env var at
  build time.
