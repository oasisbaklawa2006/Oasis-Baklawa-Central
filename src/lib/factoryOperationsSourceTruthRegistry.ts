/**
 * Factory Operations source-truth registry.
 *
 * This is not a synthetic queue model. It records the relations that existing
 * Factory screens actually read and the server/governed authority that owns
 * their state. The certification harness uses this metadata to avoid comparing
 * one UI projection against another and accidentally calling two stale screens
 * "consistent".
 */

export type FactoryTruthSubsystem =
  | "PRODUCTION"
  | "RGS"
  | "ASSEMBLY"
  | "3PGS"
  | "INVENTORY"
  | "DISPATCH"
  | "TRACE_GATE"
  | "LEGACY";

export type FactoryTruthStatus = "AUTHORITATIVE" | "REFERENCE" | "DERIVED_VIEW" | "DEAD_PROJECTION";

export type FactorySourceTruthEntry = {
  relation: string;
  subsystem: FactoryTruthSubsystem;
  status: FactoryTruthStatus;
  readConsumers: readonly string[];
  writeAuthority: string;
  evidence: string;
};

export const FACTORY_SOURCE_TRUTH: FactorySourceTruthEntry[] = [
  {
    relation: "production_jobs",
    subsystem: "PRODUCTION",
    status: "AUTHORITATIVE",
    readConsumers: ["FactoryTVModule", "OperationsController", "ReadyGoodsStore", "useOpenProductionJobsCount"],
    writeAuthority: "Governed Production/RGS RPC lifecycle in oasis-supabase-core",
    evidence: "RGS shortage creation and PHH lifecycle operate on production_jobs; PR #404 moved Production TVs and KPI to this authority.",
  },
  {
    relation: "inventory_reservations",
    subsystem: "RGS",
    status: "AUTHORITATIVE",
    readConsumers: ["ReadyGoodsStore", "RgsProductionDemandPlanner", "ThreePgsProcurementQueue", "ThirdPartyPackingMaterialCatalogue"],
    writeAuthority: "reserve_rgs_stock / release_rgs_reservation / pick_rgs_reservation / issue_rgs_stock governed RPCs",
    evidence: "Reservation quantities are the governed demand/coverage record used by RGS and the P&A->3PGS bridge.",
  },
  {
    relation: "inventory_stock_balances",
    subsystem: "RGS",
    status: "AUTHORITATIVE",
    readConsumers: ["ReadyGoodsTV", "ReadyGoodsStore", "ThreePgsProcurementQueue"],
    writeAuthority: "Server-side RGS receipt acceptance and issue RPCs",
    evidence: "Permanent RGS stock is credited only after governed RGS acceptance; issue RPCs decrement balances server-side.",
  },
  {
    relation: "production_rgs_transfers",
    subsystem: "RGS",
    status: "AUTHORITATIVE",
    readConsumers: ["ReadyGoodsStore"],
    writeAuthority: "dispatch_production_to_rgs / record_rgs_receipt / accept_rgs_production_receipt",
    evidence: "Custody evidence between Production dispatch and RGS receipt/acceptance.",
  },
  {
    relation: "rgs_issue_events",
    subsystem: "RGS",
    status: "AUTHORITATIVE",
    readConsumers: ["ReadyGoodsStore", "ThreePgsProcurementQueue"],
    writeAuthority: "issue_rgs_stock / acknowledge_rgs_issue and 3PGS requirement issue/acknowledgement RPCs",
    evidence: "Issue/custody acknowledgement evidence for RGS and P&A/3PGS handoffs.",
  },
  {
    relation: "b2b_assembly_jobs",
    subsystem: "ASSEMBLY",
    status: "AUTHORITATIVE",
    readConsumers: ["AssemblyManagement", "InventoryCommandCenter"],
    writeAuthority: "Governed P&A assembly RPC lifecycle",
    evidence: "AssemblyManagement explicitly treats Job Closed as terminal and never writes job rows directly.",
  },
  {
    relation: "b2b_assembly_components",
    subsystem: "ASSEMBLY",
    status: "AUTHORITATIVE",
    readConsumers: ["AssemblyManagement"],
    writeAuthority: "Governed reserve/issue/consume/waste/return assembly component RPCs",
    evidence: "Component reservation, issue and consumption state drive P&A readiness and reconciliation.",
  },
  {
    relation: "b2b_assembly_handovers",
    subsystem: "ASSEMBLY",
    status: "AUTHORITATIVE",
    readConsumers: ["AssemblyManagement"],
    writeAuthority: "Governed assembly handover / receiver acknowledgement RPCs",
    evidence: "Receiver-acknowledged custody transfer evidence is loaded per assembly job.",
  },
  {
    relation: "b2b_assembly_3pgs_requirements",
    subsystem: "ASSEMBLY",
    status: "AUTHORITATIVE",
    readConsumers: ["AssemblyManagement", "ThreePgsProcurementQueue"],
    writeAuthority: "Governed P&A shortfall creation and distinct-actor 3PGS fulfilment bridge",
    evidence: "Links P&A component shortfall to 3PGS reserve/issue/acknowledge before P&A may resume.",
  },
  {
    relation: "b2b_3pgs_pending_demand_priority",
    subsystem: "3PGS",
    status: "DERIVED_VIEW",
    readConsumers: ["ThreePgsProcurementQueue"],
    writeAuthority: "Derived server-side from underlying governed demand authorities",
    evidence: "ThreePgsProcurementQueue documents this as the governed pending-demand priority view.",
  },
  {
    relation: "b2b_procurement_requirements",
    subsystem: "3PGS",
    status: "AUTHORITATIVE",
    readConsumers: ["ThreePgsProcurementQueue"],
    writeAuthority: "create_procurement_requirement / assign_procurement_vendor / receipt-link RPCs",
    evidence: "Vendor-shortage requirements and linked inbound receipt lifecycle are governed server-side.",
  },
  {
    relation: "b2b_inventory_receipts",
    subsystem: "INVENTORY",
    status: "AUTHORITATIVE",
    readConsumers: ["ThreePgsProcurementQueue", "InventoryReceiving"],
    writeAuthority: "create_b2b_inventory_receipt / record_b2b_inventory_receipt / accept_b2b_inventory_receipt",
    evidence: "Inbound vendor/store receipt authority used by the 3PGS procurement bridge and inventory receiving surfaces.",
  },
  {
    relation: "orders",
    subsystem: "DISPATCH",
    status: "REFERENCE",
    readConsumers: ["DispatchManagement", "DispatchTV", "productionQueueFeed"],
    writeAuthority: "Order lifecycle authority; legacy DispatchManagement still contains direct order-status mutation paths",
    evidence: "DispatchManagement currently reads orders and order_items for dispatch readiness; production pipeline order counts are explicitly not production_jobs truth.",
  },
  {
    relation: "order_items",
    subsystem: "DISPATCH",
    status: "REFERENCE",
    readConsumers: ["DispatchManagement", "DispatchTV"],
    writeAuthority: "Order/packing lifecycle; some legacy DispatchManagement paths still update actual_packed_qty directly",
    evidence: "Dispatch packing UI derives required/packed quantities from order_items.",
  },
  {
    relation: "dispatch_cartons",
    subsystem: "TRACE_GATE",
    status: "AUTHORITATIVE",
    readConsumers: ["DispatchManagement", "CartonExplorer", "ScanTimeline"],
    writeAuthority: "Dispatch/carton lifecycle",
    evidence: "Carton identity/barcode records bridge packing, scan and gate/trace surfaces.",
  },
  {
    relation: "products",
    subsystem: "INVENTORY",
    status: "REFERENCE",
    readConsumers: ["RgsProductionDemandPlanner", "AssemblyManagement", "Inventory screens", "DispatchManagement"],
    writeAuthority: "Catalogue/master-data authority outside Factory execution",
    evidence: "Factory modules resolve SKU/name/department metadata from products but do not treat it as execution state.",
  },
  {
    relation: "operational_queue_items",
    subsystem: "LEGACY",
    status: "DEAD_PROJECTION",
    readConsumers: ["DepartmentExecutionBoard", "ExecutionCommandCenter"],
    writeAuthority: "No proven writer for the retired Production/Assembly/Ready-Goods execution-board workloads",
    evidence: "PR #404 redirected those three legacy execution boards to governed surfaces instead of reviving operational_queue_items as a competing authority.",
  },
];

export function factoryTruthForSubsystem(subsystem: FactoryTruthSubsystem): FactorySourceTruthEntry[] {
  return FACTORY_SOURCE_TRUTH.filter((entry) => entry.subsystem === subsystem);
}

export function authoritativeFactoryTruthForSubsystem(subsystem: FactoryTruthSubsystem): FactorySourceTruthEntry[] {
  return factoryTruthForSubsystem(subsystem).filter((entry) => entry.status === "AUTHORITATIVE");
}
