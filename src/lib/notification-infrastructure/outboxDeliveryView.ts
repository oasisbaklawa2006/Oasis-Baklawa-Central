import type { OutboxDeliveryRecord } from "./contract";
import { outboxDeliveryLabel, projectOutboxDelivery, type OutboxRow } from "./deliveryState";

export function projectOutboxRows(rows: OutboxRow[]): OutboxDeliveryRecord[] {
  return rows.map(projectOutboxDelivery);
}

export { outboxDeliveryLabel, projectOutboxDelivery };
