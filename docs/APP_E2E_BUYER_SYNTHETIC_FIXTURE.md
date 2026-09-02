# APP-E2E Buyer synthetic fixture

This document describes the disposable, non-production fixture used by the
authenticated Buyer golden-path certification.

## Safety boundary

The fixture is created only in an isolated local Supabase replay. It must never
use a real customer identity or write to production.

## Fixture identity

- Email: `synthetic.buyer.cert@oasis-disposable.test`
- Buyer ID: `30000000-0000-4000-8000-000000000010`
- Company: `SYNTHETIC BUYER CERTIFICATION CO`
- Product SKU: `CERT-BUYER-GOLDEN-001`
- Pre-seeded SO: `SO-CERT-PRESEED-001`

Credentials are exported to `/tmp/oasis-buyer-certification.env` with mode
`0600`, masked in CI, and removed by teardown.

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
npm run preview -- --host 127.0.0.1 --port 4173 >/tmp/buyer-central-preview.log 2>&1 &
ready=false
for _ in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:4173/login >/dev/null; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "${ready}" != "true" ]]; then
  echo "Preview did not become ready at http://127.0.0.1:4173/login" >&2
  exit 1
fi
npx playwright test tests/app-e2e-buyer-golden-path.cert.spec.ts -c playwright.buyer-cert.config.ts
kill "$(lsof -t -i:4173)" 2>/dev/null || true
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
