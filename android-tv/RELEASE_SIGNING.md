# Android TV signing gates

No keystore or signing secret is committed to this repository.

CI always validates the Android TV project with an **unsigned release build**. That artifact proves build/lint/test integrity, but Android TV cannot install an unsigned APK.

## Physical UAT signing — non-production key

Physical UAT must use an **installable APK signed with a controlled non-production UAT/test key**.

The UAT key:
- must stay outside version control;
- must not be the owner production keystore;
- should be kept stable for the duration of UAT so upgrade/install-over tests use the same signer;
- may be discarded after UAT is complete.

Example one-time UAT key creation on the controlled test machine:

```sh
keytool -genkeypair -v \
  -keystore oasis-central-tv-uat.keystore \
  -alias oasis-central-tv-uat \
  -keyalg RSA -keysize 2048 -validity 365
```

Build the release variant using the production-like origins:

```sh
./gradlew :app:assembleRelease \
  -PCENTRAL_WEB_ORIGIN=https://app.oasisbaklawacentral.com \
  -PTRACE_WEB_ORIGIN=https://trace.oasisbaklawa.com
```

Then align/sign the unsigned release APK with Android build tools using the UAT key. Record:
- APK SHA-256;
- package/version;
- signer certificate fingerprint;
- test-device model/OS;
- installation result.

This UAT-signed APK is for physical certification only and is **not** the production-distribution artifact.

## Production distribution signing — owner gate

Production sideload/distribution requires a long-lived owner-controlled release keystore.

Generate it once, offline, and store it outside version control in an owner-controlled password manager/secrets vault:

```sh
keytool -genkeypair -v \
  -keystore oasis-central-tv-release.keystore \
  -alias oasis-central-tv \
  -keyalg RSA -keysize 2048 -validity 10000
```

If automated production signing is later approved, use protected CI secrets such as:
- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

The current CI workflow intentionally does not require these owner secrets, so ordinary PR validation remains non-production and secret-free.

**Never commit either the UAT key or owner production keystore to this repository.**
