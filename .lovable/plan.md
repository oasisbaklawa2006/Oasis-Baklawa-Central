

## Fix: Replace `.single()` with `.maybeSingle()` in role-fetch queries

### Problem
The `resolveRedirect` function in `Login.tsx` and the `RootGate` in `App.tsx` use `.single()` for fetching user roles. If no row is found (missing user record or RLS block), Supabase throws a 406 error, crashing the app and causing redirect loops.

### Changes

**1. `src/pages/Login.tsx` — `resolveRedirect` function**
- Remove the 1-second delay and retry loop
- Change `.single()` to `.maybeSingle()`
- If `userData` is null/undefined, log `console.warn('No user record found for this auth ID')` and fallback to `navigate("/", { replace: true })`

**2. `src/App.tsx` — `RootGate` component**
- Change `.single()` to `.maybeSingle()` in the role fetch query
- If `data` is null, treat as customer (set redirect to null, rendering Index)

### Technical detail
`.maybeSingle()` returns `null` for zero rows without throwing, while `.single()` throws on zero or multiple rows. No other logic changes needed — just swap the method and handle null gracefully.

