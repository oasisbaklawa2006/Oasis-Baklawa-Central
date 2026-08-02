# Unified App-Verse — First Frontend Tranche Acceptance Gates

Date: 2026-08-02
Scope: shell/navigation foundation only

The first implementation tranche is accepted only when all of the following are true.

## Functional

- Existing Central routes continue to resolve.
- Existing role guards continue to deny unauthorized destinations.
- A new workspace registry maps current routes into the seven canonical workspaces.
- Desktop navigation exposes at most seven permanent workspace entries.
- Mobile navigation exposes at most five permanent entries per role.
- Role Home can render a different module composition for Admin, Sales, Finance, Operations, Product/Catalogue and Dispatch/Trace roles.
- Deep-link entry directly to an existing route still works.
- Browser refresh on nested routes still works.
- Logout/session-expiry behavior is unchanged.

## Visual

- Base background token: `#EFEFE9`.
- Warm card token: `#F1ECDC`.
- Neutral card token: `#F8F8F8`.
- Gold is an accent/state token rather than a dominant surface color.
- One icon family is used consistently.
- Operational typography remains highly legible at desktop, tablet and handheld densities.

## Safety

- No database migration.
- No Edge Function deployment.
- No role/permission expansion.
- No auth-provider change.
- No service-role material in frontend code.
- No existing route deletion.
- No backend write-authority change.

## Quality

- Typecheck passes.
- Existing automated tests pass.
- Production build passes.
- Repository ownership-boundary checks pass.
- Release Quality Gate passes.
- Unauthorized-route tests remain green.
- Keyboard navigation works for global/workspace navigation.
- Mobile navigation is usable at narrow widths without horizontal overflow.

## UAT scenarios

1. Admin signs in and lands on Executive Home with all authorized workspaces.
2. Sales user sees Customers & Sales and Orders, but not restricted Governance/Operations actions.
3. Finance user lands on finance-oriented Home and can reach release/payment queues directly.
4. Production/HOD user lands on My Work and is not presented with unrelated system administration.
5. Product/Catalogue user can move from Central product context to AI Studio product authority through a clearly labelled deep link.
6. Dispatch/Trace user can move from Central order/carton context to the canonical Trace surface.
7. TV role renders a dedicated board without general application navigation.
8. Direct legacy URLs still render during the transition.

## Stop condition

Do not begin page-by-page visual reconstruction until this shell tranche is accepted. The purpose of this tranche is to validate the information architecture and role experience while keeping the existing operational screens intact behind it.
