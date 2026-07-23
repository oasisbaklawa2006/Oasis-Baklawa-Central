# App-Verse Point 3 — Exposed Secret Verification and Remediation

**Date:** 2026-07-23  
**Status:** BLOCKED — repository cleanup complete; secret rotation/revocation and GitHub alert closure not yet evidenced  
**Scope:** All five authoritative App-Verse repositories

## 1. Confirmed exposure

GitHub history confirms that a Resend API key was previously hardcoded in Oasis-Baklawa-Central frontend code.

Evidence from commit `fd64aebc1303d52ff232220a24cc5049b29e3afb` shows removal of the exposed bearer key from:

- `src/pages/admin/AdminUsers.tsx`
- the frontend notification gateway/service that previously stored a `RESEND_CONFIG.apiKey`

The same commit moved email delivery to the `send-email` Supabase Edge Function using `Deno.env.get("RESEND_API_KEY")`.

The exposed key value is intentionally not reproduced in this report.

## 2. Current Central code state

Confirmed:

- no current tracked `.env` file exists on `main`;
- current Resend usage reads `RESEND_API_KEY` from the environment;
- current code search returns only environment-variable references and `.env.example` documentation;
- no hardcoded Resend key remains in current indexed source;
- `.env`, `.env.local`, `.env.production` and `.env.*.local` are ignored;
- `.env.example` contains placeholders only;
- the formerly tracked Central `.env` contained Supabase project URL, project ID and publishable/anon keys only;
- no service-role key was present in the removed `.env` evidence;
- no Resend key was present in the removed `.env` evidence.

Commit `25d38ad7b5e48a062a46e20ff01766bec2e542a2` removed the tracked `.env`, added `.env.example`, and added environment-file ignore rules.

## 3. Cross-repository current-file verification

No tracked root `.env` file exists on the current default branches of:

- Oasis-Baklawa-Central
- oasis-ai-studio
- oasis-trace
- oasis-baklawa
- oasis-supabase-core

Environment ignore rules are present in:

- Central
- AI Studio
- Trace
- Supabase Core
- the active Expo customer-app branch `feat/mobile-expo-foundation`

The customer repository default `main` is only an initial scaffold and does not yet contain the active branch's `.gitignore`.

## 4. Trace historical `.env`

Trace PR #1 previously removed a committed `.env` from tracking and added environment-file ignore rules. The current Trace default branch contains no tracked `.env`.

The prior Trace audit explicitly advised rotation if any secret in that historical file was sensitive. Current GitHub evidence available in this execution does not prove whether all historical Trace credentials were rotated.

## 5. Remaining mandatory remediation

Point 3 cannot be completed until all of the following are evidenced:

1. Revoke or rotate the historically exposed Resend API key in Resend.
2. Confirm the currently configured Supabase Edge secret uses the replacement key, not the exposed key.
3. Test the `send-email` Edge Function with the replacement key.
4. Resolve/close GitHub Secret Scanning alert #1 with the correct reason: revoked/rotated.
5. Verify no other active secret-scanning alerts remain in all five repositories.
6. Confirm whether historical Trace credentials required rotation and record the result.
7. Add a repository-wide secret scanning/pre-commit or CI guard where not already enforced.

## 6. History-rewrite decision

A full Git history rewrite is not presently recommended as the first remediation action because:

- the key has already been removed from current code;
- rotation/revocation is the actual security boundary;
- history rewriting affects branches, PR references, deployments and collaborator clones;
- the exposed value may still exist in forks, caches or external logs even after rewrite.

History rewrite may be considered later only after rotation, impact review and a controlled repository-wide plan.

## 7. Point 3 execution record

| Subpoint | Requirement | Status |
|---|---|---|
| 3a | Confirm exposed secret and affected code path | COMPLETE |
| 3b | Confirm current code no longer hardcodes the key | COMPLETE |
| 3c | Confirm tracked `.env` removal and ignore rules | COMPLETE |
| 3d | Verify current root `.env` absence across five repositories | COMPLETE |
| 3e | Classify removed Central `.env` contents | COMPLETE |
| 3f | Verify Resend key rotation/revocation | BLOCKED — external provider evidence required |
| 3g | Verify replacement Edge secret and runtime email test | BLOCKED — Supabase/Resend operator evidence required |
| 3h | Close GitHub Secret Scanning alert | BLOCKED — alert-management access/evidence required |
| 3i | Confirm Trace historical credential rotation | BLOCKED — provider/project evidence required |
| 3j | Add/verify cross-repo secret CI guard | PENDING |

## 8. Completion rule

Point 3 must remain `BLOCKED` and programme progress remains `2/100` until 3f–3j are complete and the formal declaration is issued:

> **POINT 3 — COMPLETE**
