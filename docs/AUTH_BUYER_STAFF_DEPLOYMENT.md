# Buyer / Staff authentication deployment gate

This document records production requirements for the split Buyer and Staff authentication surfaces introduced by PR #572.

## Mobile Buyer OTP

- `/buyer/login` uses MSG91 custom UI with `exposeMethods: true`.
- MSG91 verification must complete before the browser invokes the server-authoritative `msg91-otp` Edge Function.
- The Edge Function must return a canonical Supabase `token_hash` and Auth user identity.
- Supabase token-hash verification must run the approved-B2B claim hook before Buyer membership resolution.
- Buyer authorization remains fail-closed and requires Buyer membership.
- Physical production UAT must prove a fresh `SEND_OTP` event and successful approved-B2B claim before AUTH-01 is closed.

## Email Buyer OTP

Email OTP must **not** be declared production-certified until Core #298 and the production email template are both deployed and verified.

`BuyerLogin` passes `emailRedirectTo: resolveBuyerEmailOtpRedirectUrl()` so Supabase magic-link / confirm URLs stay on the **current Central deployment origin** (`window.location.origin`, e.g. `https://oasis-baklawa-central.vercel.app` or the canonical `https://oasisbaklawa.com` buyer host) — **not** `https://b2b.oasisbaklawa.com`.

Supabase Auth dashboard (production) must allow those Central origins in **Redirect URLs** and must not rely on the legacy B2B Site URL for Buyer email OTP.

The Supabase email template used by `signInWithOtp` must render the numeric OTP with:

```text
{{ .Token }}
```

A template that renders only `{{ .ConfirmationURL }}` produces a magic link and is incompatible with the six-digit `verifyOtp({ type: "email" })` UI in `BuyerLogin.tsx`.

Before enabling/certifying email OTP in production, verify all of the following:

1. Core #298 is merged and its migration/Edge release is deployed.
2. Required email-provider/runtime secrets are configured through the approved secrets process.
3. The Supabase email template renders `{{ .Token }}`.
4. A first-login approved Buyer receives the six-digit code.
5. Mobile and email converge on the same canonical Auth/Public Buyer UUID and company membership.
6. Wrong-surface and unapproved identities remain fail-closed.

Until those gates pass, mobile OTP may be released independently but email OTP remains an uncertified path.

## Staff login

- `/staff/login` remains email + password only for normal sign-in.
- Staff invite/magic-link restoration must remove access and refresh tokens from the browser URL before calling `setSession`.
- Buyer membership must never infer Staff authority and Staff membership must never infer Buyer authority.
