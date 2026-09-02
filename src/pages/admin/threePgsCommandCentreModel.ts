export const THREE_PGS_STORE_CODE = "3PGS";
export const THREE_PGS_OPERATOR_QUEUE_ANCHOR = "three-pgs-operator-queue";

const CLOSED_PROCUREMENT_STATUSES = new Set(["received", "cancelled", "closed"]);
const OPEN_ASSEMBLY_STATUSES = new Set(["open", "partially_fulfilled"]);
const EXCLUDED_RECEIPT_STATUSES = new Set(["cancelled", "rejected"]);

export type Balance = {
  id: string;
  sku: string;
  location_code: string;
  available_qty: number;
  reserved_qty: number;
  picked_qty: number;
  damaged_qty: number;
  expired_qty: number;
  quarantine_qty: number;
};

export type PriorityDemand = {
  demand_id: string;
  demand_reference: string;
  demand_source_type: string;
  priority_rank: number;
  sku: string;
  location_code: string;
  outstanding_qty: number;
};

export type Procurement = {
  id: string;
  requirement_number: string;
  sku: string;
  destination_store_code: string;
  shortage_qty: number;
  fulfilled_qty: number;
  vendor_reference: string | null;
  expected_at: string | null;
  status: string;
};

export type AssemblyRequirement = {
  id: string;
  requirement_number: string;
  sku: string;
  source_store_code: string;
  requested_qty: number;
  fulfilled_qty: number;
  status: string;
  priority: string;
};

export type Receipt = {
  id: string;
  receipt_number: string;
  destination_store_code: string;
  status: string;
  created_at: string;
};

export type Grn = {
  id: string;
  grn_number: string;
  receipt_id: string;
  status: string;
  finalised_at: string | null;
};

export type Snapshot = {
  balances: Balance[];
  demand: PriorityDemand[];
  procurement: Procurement[];
  assembly: AssemblyRequirement[];
  receipts: Receipt[];
  grns: Grn[];
};

export const EMPTY_THREE_PGS_SNAPSHOT: Snapshot = {
  balances: [],
  demand: [],
  procurement: [],
  assembly: [],
  receipts: [],
  grns: [],
};

export function isFinalisedGrn(grn: Grn): boolean {
  return grn.status === "finalised" || grn.finalised_at !== null;
}

export function receiptGrnsFor(receiptId: string, grns: Grn[]): Grn[] {
  return grns.filter((row) => row.receipt_id === receiptId);
}

export function receiptHasFinalisedGrn(receiptId: string, grns: Grn[]): boolean {
  return receiptGrnsFor(receiptId, grns).some(isFinalisedGrn);
}

export function receiptDisplayGrn(receiptId: string, grns: Grn[]): Grn | undefined {
  const relatedGrns = receiptGrnsFor(receiptId, grns);
  return relatedGrns.find(isFinalisedGrn) ?? relatedGrns[0];
}

export function threePgsCommandCentreMetrics(snapshot: Snapshot) {
  const available = snapshot.balances.reduce((sum, row) => sum + row.available_qty, 0);
  const reserved = snapshot.balances.reduce((sum, row) => sum + row.reserved_qty, 0);
  const exceptions = snapshot.balances.reduce(
    (sum, row) => sum + row.damaged_qty + row.expired_qty + row.quarantine_qty,
    0,
  );
  const openProcurement = snapshot.procurement.filter((row) => !CLOSED_PROCUREMENT_STATUSES.has(row.status)).length;
  const openAssembly = snapshot.assembly.filter((row) => OPEN_ASSEMBLY_STATUSES.has(row.status)).length;
  const receiptsAwaitingGrn = snapshot.receipts.filter(
    (receipt) =>
      !EXCLUDED_RECEIPT_STATUSES.has(receipt.status) &&
      !snapshot.grns.some((grn) => grn.receipt_id === receipt.id && isFinalisedGrn(grn)),
  ).length;

  return { available, reserved, exceptions, openProcurement, openAssembly, receiptsAwaitingGrn };
}
