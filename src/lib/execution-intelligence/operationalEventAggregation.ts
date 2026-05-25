import { isSuppressedInternalLabel } from "@/lib/customer-safe/customerSafeStatus";
import type { ExecutionIntelligenceInput, OperationalEventStreamItem } from "./executionIntelligenceTypes";

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  urgent: 1,
  warning: 2,
  info: 3,
};

export function aggregateOperationalEventStream(
  input: ExecutionIntelligenceInput,
  limit = 80,
): OperationalEventStreamItem[] {
  return input.events
    .map((ev) => {
      const label = `${ev.title} ${ev.message ?? ""} ${ev.reasonText ?? ""}`;
      const staffOnly = isSuppressedInternalLabel(label);
      return {
        id: ev.id,
        eventType: ev.eventType,
        title: staffOnly ? "[Staff] Operational update" : ev.title,
        severity: ev.severity,
        entityType: ev.entityType,
        entityId: ev.entityId,
        orderId: ev.orderId,
        createdAt: ev.createdAt,
        staffOnly,
      };
    })
    .sort((a, b) => {
      const sev = (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
      if (sev !== 0) return sev;
      return b.createdAt.localeCompare(a.createdAt);
    })
    .slice(0, limit);
}

export function filterEventStreamBySeverity(
  items: OperationalEventStreamItem[],
  severity: string,
): OperationalEventStreamItem[] {
  return items.filter((i) => i.severity === severity);
}
