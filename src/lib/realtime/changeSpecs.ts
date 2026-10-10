import type { PostgresChangeSpec } from "./types";

/** Frozen postgres change specs — stable references for hook dependency arrays. */
export const ORDERS_ALL_CHANGES: PostgresChangeSpec[] = [
  { event: "*", schema: "public", table: "orders" },
];

export const B2B_APPLICATIONS_INSERT_CHANGES: PostgresChangeSpec[] = [
  { event: "INSERT", schema: "public", table: "b2b_applications" },
];

export const B2B_APPLICATIONS_INSERT_UPDATE_CHANGES: PostgresChangeSpec[] = [
  { event: "INSERT", schema: "public", table: "b2b_applications" },
  { event: "UPDATE", schema: "public", table: "b2b_applications" },
];

export const COMPANIES_ALL_CHANGES: PostgresChangeSpec[] = [
  { event: "*", schema: "public", table: "companies" },
];

export const ORDER_ITEMS_ALL_CHANGES: PostgresChangeSpec[] = [
  { event: "*", schema: "public", table: "order_items" },
];

export const SUGGESTED_ORDERS_ALL_CHANGES: PostgresChangeSpec[] = [
  { event: "*", schema: "public", table: "suggested_orders" },
];

export const PRODUCTS_UPDATE_CHANGES: PostgresChangeSpec[] = [
  { event: "UPDATE", schema: "public", table: "products" },
];

export const DEBUG_WEBHOOKS_INSERT_UPDATE_CHANGES: PostgresChangeSpec[] = [
  { event: "INSERT", schema: "public", table: "debug_webhooks" },
  { event: "UPDATE", schema: "public", table: "debug_webhooks" },
];

export const WHATSAPP_PACKETS_ALL_CHANGES: PostgresChangeSpec[] = [
  { event: "*", schema: "public", table: "whatsapp_message_packets" },
];

export const GOVERNANCE_DASHBOARD_CHANGES: PostgresChangeSpec[] = [
  { event: "*", schema: "public", table: "orders" },
  { event: "*", schema: "public", table: "b2b_applications" },
  { event: "*", schema: "public", table: "audit_logs" },
  { event: "*", schema: "public", table: "factory_inventory" },
];

export const ORDERS_INSERT_CHANGES: PostgresChangeSpec[] = [
  { event: "INSERT", schema: "public", table: "orders" },
];
