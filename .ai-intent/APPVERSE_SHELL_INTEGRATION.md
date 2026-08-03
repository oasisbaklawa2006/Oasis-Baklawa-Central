# App-Verse Shell Integration

## Intent

Mount the reviewed App-Verse navigation foundation into the existing Central Admin shell without changing backend authority, authentication, role permissions, route URLs, or operational state machines.

## Cutover rules

1. Seven App-Verse workspaces are presentation/navigation containers only; backend departments and schemas remain authoritative.
2. Existing detailed routes remain available under `All tools` during the compatibility phase.
3. Workspace visibility is filtered by the existing module-access model and must never expand permissions.
4. Mobile navigation exposes no more than five high-level destinations.
5. Quiet-Luxury theme tokens are scoped to `.appverse-shell`; existing global theme tokens remain untouched outside the shell.
6. Role-specific Home content remains presentation logic until corresponding backend schemas are finalized and reconciled.
7. No schema, Edge Function, auth, webhook, RLS, or production-authority changes belong in this tranche.

## Current implementation

- `AdminLayout` mounts `AppverseWorkspaceRail` as primary desktop navigation.
- Existing detailed navigation is retained behind an explicit `All tools` compatibility drawer.
- `AppverseMobileNav` is mounted for handheld/mobile layouts.
- `/admin` renders `AppverseAdminHome`: role-aware Home, Wave 1 launchpad, executive deep link, internal app registry, and role-filtered TV surfaces.
- Existing Panic Alert, help sidebar, onboarding overlay, language toggle, session logout, route guard, realtime toasts, and application badge behavior are preserved.

## Wave 1 completion (2026-08-03)

Wave 1 is **frozen** at commit `6b18bc68` (PR #324). See `.ai-intent/APPVERSE_WAVE1_BASELINE.md` for the authoritative baseline, validation record, protected manifest, and change policy.

Wave 1 delivers:

- Role-aware Home cards filtered by module authority (`roleHome.ts`).
- Wave 1 launchpad for Orders & Finance, Operations & Production, and WhatsApp & Support (`wave1.ts`).
- `/admin` composition via `AppverseAdminHome`.
- Invariant tests in `wave1Baseline.test.ts` — must remain green.

Wave 2 is blocked until Stores/Inventory backend contracts are reconciled (`docs/frontend/APPVERSE_WAVE2_STORES_INVENTORY_CONTRACT_RECONCILIATION.md`).

## Acceptance gate

This tranche may advance only when the normal Release Quality Gate, Repo Ownership Boundaries, Vercel preview, and automated review signals are green. Any backend-schema output that changes role ownership or state authority must be reconciled before the affected detailed frontend module is frozen.
