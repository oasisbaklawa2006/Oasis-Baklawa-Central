import type { OutboxDeliveryRecord } from "./contract";
import { outboxDeliveryLabel, projectOutboxDelivery } from "./deliveryState";

type OutboxRow = {
  id: string;
  event_type: string | null;
  message_body: string;
  recipient_email: string | null;
  recipient_phone: string | null;
  priority: string | null;
  status: string | null;
  sent_at: string | null;
  error_log: string | null;
  created_at: string | null;
};

export function projectOutboxRows(rows: OutboxRow[]): OutboxDeliveryRecord[] {
  return rows.map(projectOutboxDelivery);
}

export { outboxDeliveryLabel, projectOutboxDelivery };
