import { ExceptionGovernanceError } from "./exceptionGovernanceTypes";

export type ShadowWriteSurface =
  | "factory_inventory"
  | "inventory_adjustments"
  | "orders.is_waste"
  | "daily_production_logs"
  | "production_jobs";

const FORBIDDEN_SURFACES: Record<ShadowWriteSurface, string> = {
  "factory_inventory": "Wastage/rejection/shortage must use governed Core RPCs — factory_inventory is legacy reference only",
  "inventory_adjustments": "Direct inventory_adjustments inserts bypass governed exception authority",
  "orders.is_waste": "Order soft-reject must not substitute for governed production/inventory exception",
  "daily_production_logs": "Production logging must use record_production_output / quick_log_production_to_rgs",
  "production_jobs": "Job state mutations must use governed production lifecycle RPCs",
};

export function assertNotShadowWrite(surface: ShadowWriteSurface, context?: string): void {
  const detail = FORBIDDEN_SURFACES[surface];
  const suffix = context ? ` (${context})` : "";
  throw new ExceptionGovernanceError("shadow_write_blocked", `${detail}${suffix}`);
}

export function isShadowWriteSurface(surface: string): surface is ShadowWriteSurface {
  return surface in FORBIDDEN_SURFACES;
}

export function describeShadowWritePolicy(surface: ShadowWriteSurface): string {
  return FORBIDDEN_SURFACES[surface];
}
