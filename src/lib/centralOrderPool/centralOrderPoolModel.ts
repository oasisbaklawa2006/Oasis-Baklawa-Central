export type CentralOrderPoolRecentOrder = {
  id: string;
  order_number: string | null;
  status: string;
  created_at: string | null;
  company_name: string | null;
};

export type CentralOrderPoolSnapshot = {
  intakePending: number;
  intakeClarification: number;
  pipelineSubmitted: number;
  pipelineConfirmed: number;
  productionActive: number;
  packingActive: number;
  recentOrders: CentralOrderPoolRecentOrder[];
};

export const EMPTY_CENTRAL_ORDER_POOL_SNAPSHOT: CentralOrderPoolSnapshot = {
  intakePending: 0,
  intakeClarification: 0,
  pipelineSubmitted: 0,
  pipelineConfirmed: 0,
  productionActive: 0,
  packingActive: 0,
  recentOrders: [],
};

const PRODUCTION_STATUSES = new Set(["confirmed", "manufacturing", "in_production", "assembled"]);
const PACKING_STATUSES = new Set([
  "packing",
  "packed_ready",
  "awaiting_final_payment",
  "cleared_for_dispatch",
  "dispatched",
]);

export function centralOrderPoolMetrics(snapshot: CentralOrderPoolSnapshot) {
  return {
    intakeOpen: snapshot.intakePending + snapshot.intakeClarification,
    pipelineOpen: snapshot.pipelineSubmitted + snapshot.pipelineConfirmed,
    productionOpen: snapshot.productionActive,
    packingOpen: snapshot.packingActive,
  };
}

export function isProductionStatus(status: string): boolean {
  return PRODUCTION_STATUSES.has(status);
}

export function isPackingStatus(status: string): boolean {
  return PACKING_STATUSES.has(status);
}
