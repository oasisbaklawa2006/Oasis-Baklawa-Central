import type { OperationalSeverity } from "./entityEscalation";

export type EntityPriorityBand = "routine" | "elevated" | "urgent" | "critical";

export interface EntityPriorityInput {
  severity?: OperationalSeverity;
  customerImpact?: boolean;
  agingHours?: number;
  financeBlocked?: boolean;
  dispatchPanic?: boolean;
}

export function deriveEntityPriority(input: EntityPriorityInput): EntityPriorityBand {
  if (input.dispatchPanic || input.severity === "critical") return "critical";
  if (input.financeBlocked && input.customerImpact) return "urgent";
  if (input.severity === "high" || (input.agingHours ?? 0) >= 48) return "urgent";
  if (input.severity === "medium" || input.customerImpact) return "elevated";
  return "routine";
}

export function priorityScore(band: EntityPriorityBand): number {
  switch (band) {
    case "critical":
      return 100;
    case "urgent":
      return 75;
    case "elevated":
      return 50;
    case "routine":
    default:
      return 25;
  }
}
