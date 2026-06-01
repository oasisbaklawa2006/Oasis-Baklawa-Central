# Environment Setup

## Quick Start

```bash
cp .env.example .env
# Fill in values from Supabase Dashboard > Settings > API
```

## Required Variables

| Variable | Source | Notes |
|----------|--------|-------|
| `VITE_SUPABASE_URL` | Supabase > Settings > API > Project URL | e.g. `https://xxxxx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase > Settings > API > anon public | Safe for frontend |

## Which Supabase Project

This app connects to the **Oasis Central** Supabase project.

- Staging ref: `aruyieslaxjhnamlstpx`
- Production ref: `tcxvcatsqqertcnycuop`

Use staging URL for local development. Use production URL in Vercel production environment.

Do NOT create a separate Supabase project. Do NOT use a Lovable Cloud database.

## Vercel Setup

In Vercel Dashboard > Project > Settings > Environment Variables, set:
- `VITE_SUPABASE_URL` — for Production, Preview, Development
- `VITE_SUPABASE_PUBLISHABLE_KEY` — for Production, Preview, Development

## Security Rules

- **Never** commit `.env` to Git
- **Never** use `service_role` key in frontend code
- **Never** share key values in chat, issues, or PRs
- Only the `anon` / `publishable` key belongs in `VITE_*` variables
- `service_role` key is for server-side Edge Functions only

## Key Rotation

If a key is exposed:
1. Supabase Dashboard > Settings > API > Regenerate
2. Update local `.env`
3. Update Vercel environment variables
4. Redeploy production

## Troubleshooting

- **Build fails with missing env var:** Create `.env` from `.env.example`
- **"Invalid Supabase URL":** Must be `https://xxx.supabase.co` format
- **Auth not working:** Verify you are using `anon` key, not `service_role`
