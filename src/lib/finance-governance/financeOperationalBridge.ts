import type { FinanceOperationalEventRecord } from "./financeGovernanceTypes";
import type { OperationalEventRecord } from "@/lib/operational-events/types";

export function financeEventsToOperational(
  records: FinanceOperationalEventRecord[],
): OperationalEventRecord[] {
  return records.map((e, i) => ({
    id: e.id,
    kind: e.eventType,
    category: "financial",
    severity: e.eventType === "finance_risk_escalated" ? "urgent" : "info",
    title: e.title,
    detail: e.message,
    occurredAt: e.occurredAt,
    sortKey: i,
    source: "manual",
    actor: { role: "finance", displayLabel: "Finance governance" },
    entities: [{ entityType: "order", id: e.orderId }],
  }));
}
