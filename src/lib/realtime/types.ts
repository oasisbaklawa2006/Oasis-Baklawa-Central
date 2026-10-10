/** Central Point23 transport domains — not business truth (Point20 owns events). */
export type RealtimeDomain =
  | "orders"
  | "companies"
  | "order_items"
  | "b2b_applications"
  | "notifications"
  | "notification_outbox"
  | "whatsapp_packets"
  | "products"
  | "suggested_orders"
  | "audit_logs"
  | "factory_inventory"
  | "debug_webhooks"
  | "postgres_table";

export type RealtimeScopeType = "global_staff" | "company" | "user" | "order";

export type RealtimeScope = {
  type: RealtimeScopeType;
  companyId?: string;
  userId?: string;
  orderId?: string;
  /** Required when domain is postgres_table — names the physical table being mirrored. */
  tableName?: string;
};

export type RealtimeTransportStatus =
  | "idle"
  | "snapshot_loading"
  | "snapshot_ready"
  | "connecting"
  | "subscribed"
  | "degraded"
  | "unavailable";

export type RealtimeDeltaMode = "refetch" | "invalidate" | "patch";

export type PostgresChangeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

export type PostgresChangeSpec = {
  event: PostgresChangeEvent;
  schema: string;
  table: string;
  filter?: string;
};

export type RealtimeDeltaPayload = {
  eventId: string;
  version: number;
  table: string;
  entityId?: string;
  occurredAt?: string;
  changeEvent?: PostgresChangeEvent;
  raw?: unknown;
};

export type RealtimeSubscriptionConfig = {
  domain: RealtimeDomain;
  scope: RealtimeScope;
  changes: PostgresChangeSpec[];
  mode: RealtimeDeltaMode;
  snapshot: () => Promise<void>;
  onDelta?: (payload: RealtimeDeltaPayload) => void;
  onStatusChange?: (status: RealtimeTransportStatus) => void;
  maxReconnectAttempts?: number;
  reconnectBackoffMs?: number;
  pollingFallbackMs?: number;
};

export type RealtimeScopeGuardResult =
  | { allowed: true; channelName: string }
  | { allowed: false; reason: string };
