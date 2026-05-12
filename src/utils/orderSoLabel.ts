/**
 * Display label for a sales order: prefer persisted order_number (SO-YYYY-NNNNNN),
 * fall back to legacy UUID fragment when missing (e.g. pre-migration or replication lag).
 */
export function formatSalesOrderLabel(order: { id: string; order_number?: string | null }): string {
  const on = order.order_number?.trim();
  if (on) return on;
  return `SO-${order.id.slice(0, 8).toUpperCase()}`;
}
