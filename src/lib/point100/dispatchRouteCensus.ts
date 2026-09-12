import { CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX } from "../appverse/centralAdminModuleAuthorityMatrix";
import { MACRO_DISPATCH_MANAGER_HOME, MACRO_ORDER_DISPATCH_JOURNEY } from "../macro-order-dispatch/macroOrderDispatchJourney";

const CENTRAL_ROUTE_BINDINGS = new Set(
  CENTRAL_ADMIN_MODULE_AUTHORITY_MATRIX.map((entry) => entry.route),
);

/** #556 dispatch workflow routes required for Point100 certification census. */
export function macro556DispatchRoutesPresent(): { ok: boolean; detail: string } {
  const required = [
    MACRO_DISPATCH_MANAGER_HOME,
    ...MACRO_ORDER_DISPATCH_JOURNEY.filter((stage) =>
      ["dispatch_readiness", "packing_dpl", "golden_chain", "security_gate"].includes(stage.key),
    ).map((stage) => stage.route),
    "/admin/dispatch-completion",
    "/admin/dispatch-finalization",
  ];
  const missing = required.filter((route) => !CENTRAL_ROUTE_BINDINGS.has(route));
  if (missing.length > 0) {
    return { ok: false, detail: `Missing #556 dispatch routes: ${missing.join(", ")}` };
  }
  return { ok: true, detail: `#556 routes present: ${required.join(", ")}` };
}
