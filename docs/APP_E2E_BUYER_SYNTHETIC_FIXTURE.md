# APP-E2E Tranche 5 — Synthetic Buyer certification fixture

This document describes the **disposable, non-production** Buyer fixture used for
authenticated golden-path certification in Central PRs. It must never be created
in production or bound to real customer identities.

## Fixture identity

| Field | Value |
| --- | --- |
| Email | `synthetic.buyer.cert@oasis-disposable.test` |
| Auth user id | `30000000-0000-4000-8000-000000000010` |
| Company | `SYNTHETIC BUYER CERTIFICATION CO` |
| Company id | `30000000-0000-4000-8000-000000000001` |
| Catalogue SKU | `CERT-BUYER-GOLDEN-001` |
| Pre-seeded SO | `SO-CERT-PRESEED-001` |

Passwords are generated per run and written only to `/tmp/oasis-buyer-certification.env`
with mode `0600`. They are masked in GitHub Actions logs.

## Environment boundary

- Schema authority: canonical `oasis-supabase-core` replayed with `supabase start` +
  `supabase db reset --local`.
- Frontend target: `http://127.0.0.1:4173` preview build wired to the local anon key.
- Production Supabase (`tcxvcatsqqertcnycuop.supabase.co`) is never mutated.
- No service-role key is exposed to Playwright or retained in artifacts.

## Required Playwright / CI variables

| Variable | Source |
| --- | --- |
| `TEST_PREVIEW_URL` | `http://127.0.0.1:4173` in disposable CI; repository secret for manual preview runs |
| `TEST_BUYER_EMAIL` | Generated credential export or repository secret |
| `TEST_BUYER_PASSWORD` | Generated credential export or repository secret (masked in CI) |
| `BUYER_CERT_SUPABASE_URL` | Local API URL from `supabase status` |
| `BUYER_CERT_SUPABASE_ANON_KEY` | Local anon key from `supabase status` |
| `BUYER_CERT_ENVIRONMENT_ID` | `buyer-cert-gha-<run>-<attempt>` in CI |

Optional manual preview override:

- `BUYER_CERT_ALLOW_REMOTE_PREVIEW=true` with `TEST_PREVIEW_URL=https://<branch>.vercel.app`
  only when using **separate** non-production credentials supplied through repository
  secrets. Never reuse production Buyer accounts.

## Local bootstrap

```bash
export BUYER_CERT_CORE_REPO=/absolute/path/to/oasis-supabase-core
export BUYER_CERT_ALLOW_LOCAL_RESET=true
bash scripts/buyer-certification/start-ephemeral.sh
set -a && source /tmp/oasis-buyer-certification.env && set +a
export TEST_PREVIEW_URL=http://127.0.0.1:4173
export VITE_SUPABASE_URL="$BUYER_CERT_SUPABASE_URL"
export VITE_SUPABASE_PUBLISHABLE_KEY="$BUYER_CERT_SUPABASE_ANON_KEY"
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
npx playwright test tests/app-e2e-buyer-golden-path.cert.spec.ts -c playwright.buyer-cert.config.ts
bash scripts/buyer-certification/stop-ephemeral.sh
```

## Golden path under certification

At viewport widths **375**, **390**, and **430**:

login → dashboard → catalogue → product detail → cart → submit order → order detail →
documents/statement → logout.

Evidence artifacts:

- `buyer-golden-path-results.json`
- `buyer-golden-path-evidence-mobile-*.json`
- `buyer-certification-artifacts/*.png`
