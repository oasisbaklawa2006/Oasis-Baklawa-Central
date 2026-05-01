# Oasis Baklawa B2B Portal

## Cursor Cloud specific instructions

### Architecture overview
Single React SPA (Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui). The entire backend is hosted Supabase (database, auth, storage, edge functions, realtime) — no local backend services needed. Environment variables for Supabase are committed in `.env`.

### Standard commands
See `package.json` scripts:
- **Dev server**: `npm run dev` — starts Vite on port 8080
- **Lint**: `npm run lint` (ESLint, flat config in `eslint.config.js`)
- **Test**: `npm run test` (Vitest, 4 test files, ~26 tests)
- **Build**: `npm run build` (production) or `npm run build:dev` (development mode)

### Non-obvious caveats
- The project has both `package-lock.json` and `bun.lockb`; use **npm** as the canonical package manager (matches README instructions and lockfile recency).
- Vite dev server binds to `::` (IPv6 all interfaces) on port **8080**, not the default 5173.
- ESLint reports ~500 pre-existing errors (mostly `no-explicit-any`). These are not regressions.
- Playwright is in devDependencies but no E2E test files exist yet.
- The 85 SQL migrations under `supabase/migrations/` and 15 edge functions under `supabase/functions/` are deployed to the hosted Supabase instance — they are not run locally.
- Node.js >= 18 is required. The VM update script installs Node 20 via nvm if not already present.
