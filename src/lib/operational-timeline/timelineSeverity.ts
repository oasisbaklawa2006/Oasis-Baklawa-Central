import type { OperationalSeverity } from "@/lib/entity-graph/entityEscalation";

export interface TimelineEventSeverity {
  operational: OperationalSeverity;
  /** Customer-safe events cap at medium for display tone. */
  customerSafeCap: OperationalSeverity;
}

export function capSeverityForCustomerSafe(severity: OperationalSeverity): OperationalSeverity {
  if (severity === "critical" || severity === "high") return "medium";
  return severity;
}

export function projectTimelineSeverity(
  severity: OperationalSeverity,
  customerSafe: boolean,
): TimelineEventSeverity {
  return {
    operational: severity,
    customerSafeCap: customerSafe ? capSeverityForCustomerSafe(severity) : severity,
  };
}
