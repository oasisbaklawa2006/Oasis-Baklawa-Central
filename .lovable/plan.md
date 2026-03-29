
Goal: eliminate the root-loop and restore a clean entry architecture where `/` is real customer home, `/splash` owns the timer, and auth state decides initial landing correctly.

1) Rewire root routing in `src/App.tsx`
- Import `Index` (customer home) and stop rendering `Splash` on `/`.
- Replace current `RootEntry` behavior with an auth-aware gate component:
  - If auth is loading: show loader.
  - If not authenticated: redirect to `/splash`.
  - If authenticated: fetch role from `users`, normalize with `toUpperCase()`, then:
    - Admin roles (`SUPER_ADMIN`, `ADMIN`, `FINANCE_HEAD`, `DISPATCH_HEAD`, `PRODUCTION_MANAGER`) → `/admin`
    - Sales role (`SALES_EXECUTIVE`) → `/sales/dashboard` (preserve existing role map)
    - Otherwise → render `<Index />` on `/`
- Keep explicit route `path="/splash"` for splash page.

2) Isolate splash behavior in `src/pages/Splash.tsx`
- Keep the 2.5s timer only here.
- After delay, navigate to `/intro` with `replace: true`.
- Confirm no splash timer logic exists anywhere else (especially not root/home).

3) Verify intro handoff in `src/pages/CompanyIntro.tsx`
- Ensure primary CTA (“Get Started” on final slide / continue flow) calls `navigate("/login", { replace: true })`.
- Keep “Skip to Login” behavior aligned.
- No auto-skip from intro to home.

4) Keep login redirect fallback aligned in `src/pages/Login.tsx`
- Preserve existing role-normalized redirect logic.
- Confirm customer/unknown fallback remains `navigate("/")` (now correct because `/` is real customer home).

5) Validation checklist (must pass before sign-off)
- Unauthenticated user opens `/`:
  - redirected to `/splash` → waits ~2.5s → `/intro` → CTA → `/login`.
- Authenticated customer opens `/`:
  - lands on customer home (`Index`) with no redirect loop.
- Authenticated super/admin opens `/`:
  - redirected straight to `/admin` (never customer home).
- Authenticated sales executive opens `/`:
  - redirected to `/sales/dashboard`.
- Post-login customer redirect to `/` shows home directly (no splash bounce).

Technical details / anti-loop guard
- Root gate should use one-time role fetch with explicit loading state before deciding redirect/render.
- Use normalized role comparisons everywhere root-entry decisions are made.
- Use `replace: true` on automatic redirects to prevent back-stack bounce loops.
