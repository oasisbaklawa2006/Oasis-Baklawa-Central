# Release signing — owner action required

No keystore or signing secret is committed to this repository (rule: never
commit signing material). CI produces an **unsigned** release build only,
to validate that the project compiles and lints cleanly.

To produce a distributable, installable release APK/AAB:

1. Generate a release keystore once, offline, and store it outside version
   control (a password manager / secrets vault, not this repo):
   ```sh
   keytool -genkeypair -v -keystore oasis-central-tv-release.keystore \
     -alias oasis-central-tv -keyalg RSA -keysize 2048 -validity 10000
   ```
2. Provide the following as CI secrets (GitHub Actions repository secrets)
   if automated signed builds are wanted later:
   `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. None of these exist yet —
   the current `android-tv-ci.yml` workflow intentionally does not reference
   them, so it keeps working (unsigned) whether or not they are ever added.
3. Until then, sign locally with a developer machine that holds the
   keystore:
   ```sh
   ./gradlew :app:assembleRelease \
     -PCENTRAL_WEB_ORIGIN=https://app.oasisbaklawacentral.com
   # then align + sign with apksigner using the keystore above
   ```

This is intentionally left as an explicit owner-side step rather than
something this session can complete — release signing key custody is a
security decision, not an engineering default.
