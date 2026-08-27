/**
 * Factory-route exceptions discovered from App.tsx that are intentionally not
 * part of FACTORY_OPERATIONS_ROUTES.
 *
 * These entries make the source census fail-closed: a route that looks
 * Factory-related must either live in the typed registry or be explicitly
 * classified here with a reason.
 */

export type FactoryRouteException = {
  kind: "REDIRECT_ALIAS" | "FACTORY_RELATED_BUT_OUT_OF_SCOPE";
  reason: string;
  expectedTarget?: string;
};

export const FACTORY_ROUTE_EXCEPTIONS: Record<string, FactoryRouteException> = {
  "/tv/dragees": {
    kind: "REDIRECT_ALIAS",
    expectedTarget: "/tv/chocolate",
    reason: "Legacy standalone Dragees TV bookmark; the six-TV estate folds Dragees into the Chocolate & Confectionery TV.",
  },
  "/admin/assembly": {
    kind: "REDIRECT_ALIAS",
    expectedTarget: "/admin/assembly-tasks",
    reason: "Legacy Assembly bookmark retained for compatibility; canonical governed P&A work lives at /admin/assembly-tasks.",
  },
  "/admin/production": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Broad legacy/admin Production screen; governed floor execution is classified separately at /operations-controller and the canonical production TVs.",
  },
  "/admin/operations": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Broad admin Operations screen, not a single governed factory execution authority.",
  },
  "/admin/inventory": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Broad admin Inventory screen; the specialized inventory command/receiving/reservation/risk/trace surfaces are classified separately.",
  },
  "/admin/logistics": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Broad Logistics admin screen spanning concerns beyond the Factory Operations execution estate.",
  },
  "/admin/packing-dispatch": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Combined legacy packing/dispatch admin screen; governed P&A and Dispatch lifecycle surfaces are classified separately.",
  },
  "/admin/dispatch": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Alias of the broad AdminPackingDispatch screen, not the canonical governed Dispatch lifecycle surface.",
  },
  "/admin/order-management": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Cross-department order-management workflow upstream of Factory execution; not a Factory floor/store execution surface.",
  },
  "/admin/target-vs-actual": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Cross-functional performance/reporting dashboard, not a governed Factory execution authority.",
  },
  "/admin/operational-search": {
    kind: "FACTORY_RELATED_BUT_OUT_OF_SCOPE",
    reason: "Cross-department operational search surface; useful to Factory users but not a Factory execution workflow.",
  },
  "/admin/verification": {
    kind: "REDIRECT_ALIAS",
    expectedTarget: "/admin/execution-command-center",
    reason: "Legacy verification bookmark that redirects to the execution command center; classified as an alias rather than a certifiable current Factory surface.",
  },
};

export const getFactoryRouteException = (route: string) => FACTORY_ROUTE_EXCEPTIONS[route];
