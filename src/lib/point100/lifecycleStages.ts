/**
 * Point100 operational lifecycle stages — top-down dress rehearsal plan.
 * Each stage binds to rebindable Core RPC contracts and Central surfaces.
 */

export type Point100LifecycleStage = {
  id: string;
  sequence: number;
  label: string;
  domain: "buyer" | "finance" | "production" | "inventory" | "packing" | "dispatch" | "gate" | "trace" | "completion";
  coreRpcs: readonly string[];
  centralBindings: readonly string[];
  fixtureEnvKeys: readonly string[];
  negativePathIds: readonly string[];
};

export const POINT100_LIFECYCLE_STAGES: readonly Point100LifecycleStage[] = [
  {
    id: "buyer_catalogue_intent",
    sequence: 1,
    label: "Buyer catalogue → Genie/editable draft",
    domain: "buyer",
    coreRpcs: ["add_customer_order_draft_line_v1", "clear_customer_order_draft_v1"],
    centralBindings: ["/buyer/catalogue", "customerAppClient"],
    fixtureEnvKeys: ["FACTORY_CERT_GOLDEN_ORDER_ID"],
    negativePathIds: ["wrong_tenant_role"],
  },
  {
    id: "buyer_quotation_so",
    sequence: 2,
    label: "Quotation → accept → Sales Order",
    domain: "buyer",
    coreRpcs: ["submit_customer_order_v1"],
    centralBindings: ["/buyer/cart", "customerAppClient.submitOrder"],
    fixtureEnvKeys: ["FACTORY_CERT_GOLDEN_ORDER_ID"],
    negativePathIds: ["duplicate_replay"],
  },
  {
    id: "advance_payable_payment",
    sequence: 3,
    label: "Advance payable → payment proof",
    domain: "finance",
    coreRpcs: ["record_order_payment_proof_v1"],
    centralBindings: ["paymentAuthorityClient", "/buyer/payments"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT37_ORDER_ID"],
    negativePathIds: ["insufficient_payment", "provider_replay"],
  },
  {
    id: "finance_verification_reconciliation",
    sequence: 4,
    label: "Finance verification → reconciliation",
    domain: "finance",
    coreRpcs: ["verify_order_payment_v1", "get_finance_operations_clearance_facts_v1"],
    centralBindings: ["FinanceGovernanceBoard", "financeClearanceAuthorityClient"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT37_ORDER_ID"],
    negativePathIds: ["active_finance_hold", "wrong_tenant_role"],
  },
  {
    id: "production_release",
    sequence: 5,
    label: "Production release → in_production",
    domain: "production",
    coreRpcs: ["release_order_to_in_production_v1", "decide_finance_operations_clearance_v1"],
    centralBindings: ["OrderManagement", "orderAuthorityClient"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT37_ORDER_ID"],
    negativePathIds: ["duplicate_replay", "wrong_tenant_role"],
  },
  {
    id: "inventory_lot_allocation",
    sequence: 6,
    label: "Inventory reservation → lot allocation",
    domain: "inventory",
    coreRpcs: ["reserve_rgs_stock", "allocate_b2b_inventory_putaway"],
    centralBindings: ["ReadyGoodsStore", "rgsGovernedRpc"],
    fixtureEnvKeys: ["FACTORY_CERT_GOLDEN_ORDER_ID"],
    negativePathIds: ["stock_shortage", "quarantined_expired_lot"],
  },
  {
    id: "production_qc",
    sequence: 7,
    label: "Production execution → QC",
    domain: "production",
    coreRpcs: ["accept_production_job", "record_production_output"],
    centralBindings: ["/admin/production", "productionJobsDatabase"],
    fixtureEnvKeys: ["FACTORY_CERT_GOLDEN_ORDER_ID"],
    negativePathIds: [],
  },
  {
    id: "packing_cartons_dpl",
    sequence: 8,
    label: "Packing → cartons → DPL",
    domain: "packing",
    coreRpcs: [
      "create_b2b_dispatch_consignment",
      "open_b2b_dispatch_carton",
      "create_b2b_dispatch_packing_list",
      "submit_b2b_dispatch_packing_list_to_finance",
    ],
    centralBindings: ["/admin/dispatch-mgmt", "/admin/golden-chain-operator", "DispatchManagement", "AssemblyManagement"],
    fixtureEnvKeys: ["FACTORY_CERT_GOLDEN_ORDER_ID"],
    negativePathIds: ["invalid_carton", "duplicate_scan"],
  },
  {
    id: "final_invoice_balance",
    sequence: 9,
    label: "Final invoice → balance settlement",
    domain: "finance",
    coreRpcs: ["issue_final_invoice_v1", "get_finance_exit_facts_v1"],
    centralBindings: ["financeExitAuthorityClient", "/admin/dispatch-finalization", "DispatchFinalizationBoard"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT38_ORDER_ID"],
    negativePathIds: ["insufficient_payment"],
  },
  {
    id: "finance_dispatch_clearance",
    sequence: 10,
    label: "Finance Dispatch Clearance",
    domain: "finance",
    coreRpcs: ["decide_finance_dispatch_clearance_v1", "receive_submitted_b2b_dispatch_dpls_v1"],
    centralBindings: ["financeExitAuthorityClient", "/admin/dispatch-readiness", "DispatchReadinessBoard"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT38_ORDER_ID"],
    negativePathIds: ["active_finance_hold"],
  },
  {
    id: "dispatch_consignment",
    sequence: 11,
    label: "Dispatch → consignment execution",
    domain: "dispatch",
    coreRpcs: ["record_dispatch_proof_packet_v1", "release_order_to_dispatched_v1"],
    centralBindings: ["/admin/dispatch-mgmt", "/admin/dispatch-completion", "DispatchManagement", "GoldenChainOperatorWizard"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT38_ORDER_ID"],
    negativePathIds: ["duplicate_scan"],
  },
  {
    id: "security_gate",
    sequence: 12,
    label: "Independent Security Gate release",
    domain: "gate",
    coreRpcs: ["release_b2b_dispatch_carton_at_gate_v1"],
    centralBindings: ["/security-gate", "gateExitAuthorityClient"],
    fixtureEnvKeys: [],
    negativePathIds: ["gate_mismatch"],
  },
  {
    id: "trace_handover",
    sequence: 13,
    label: "Trace handover → scan lineage",
    domain: "trace",
    coreRpcs: [],
    centralBindings: ["/admin/scan-timeline", "orderTraceFeed"],
    fixtureEnvKeys: [],
    negativePathIds: ["duplicate_scan"],
  },
  {
    id: "customer_dispatch_proof",
    sequence: 14,
    label: "Customer dispatch proof",
    domain: "completion",
    coreRpcs: ["record_dispatch_proof_packet_v1"],
    centralBindings: ["customerAppClient", "/buyer/orders"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT38_ORDER_ID"],
    negativePathIds: [],
  },
  {
    id: "order_complete",
    sequence: 15,
    label: "Order complete",
    domain: "completion",
    coreRpcs: ["release_order_to_dispatched_v1"],
    centralBindings: ["GoldenChainOperatorWizard", "DispatchCompletionBoard"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT38_ORDER_ID"],
    negativePathIds: [],
  },
  {
    id: "complaint_window",
    sequence: 16,
    label: "10-day complaint window opened",
    domain: "completion",
    coreRpcs: ["get_finance_exit_facts_v1"],
    centralBindings: ["financeExitAuthorityClient", "customerAppClient.complaint_window_status"],
    fixtureEnvKeys: ["FACTORY_CERT_POINT38_ORDER_ID"],
    negativePathIds: [],
  },
] as const;

export const POINT100_NEGATIVE_PATHS = [
  { id: "duplicate_replay", label: "Duplicate / idempotent replay" },
  { id: "wrong_tenant_role", label: "Wrong tenant / role isolation" },
  { id: "insufficient_payment", label: "Insufficient payment" },
  { id: "active_finance_hold", label: "Active finance hold" },
  { id: "stock_shortage", label: "Stock shortage" },
  { id: "quarantined_expired_lot", label: "Quarantined / expired lot" },
  { id: "invalid_carton", label: "Invalid carton" },
  { id: "duplicate_scan", label: "Duplicate scan" },
  { id: "gate_mismatch", label: "Gate mismatch" },
  { id: "provider_replay", label: "Provider / webhook replay" },
] as const;

export type Point100NegativePathId = (typeof POINT100_NEGATIVE_PATHS)[number]["id"];

export function getLifecycleStage(stageId: string): Point100LifecycleStage | undefined {
  return POINT100_LIFECYCLE_STAGES.find((stage) => stage.id === stageId);
}

export function stagesForNegativePath(negativePathId: string): Point100LifecycleStage[] {
  return POINT100_LIFECYCLE_STAGES.filter((stage) => stage.negativePathIds.includes(negativePathId));
}
