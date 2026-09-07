/**
 * Rebindable Point100 contract bindings — canonical RPC/route references that
 * can be rebound as upstream macro PRs land without rewriting the harness.
 */

export type Point100ContractBinding = {
  key: string;
  kind: "core_rpc" | "central_route" | "central_client";
  canonical: string;
  /** Optional override via env for cross-repo preview heads */
  envOverrideKey?: string;
};

export const POINT100_CONTRACT_BINDINGS: readonly Point100ContractBinding[] = [
  { key: "buyer_draft_line", kind: "core_rpc", canonical: "add_customer_order_draft_line_v1" },
  { key: "buyer_submit_order", kind: "core_rpc", canonical: "submit_customer_order_v1" },
  { key: "payment_proof", kind: "core_rpc", canonical: "record_order_payment_proof_v1" },
  { key: "payment_verify", kind: "core_rpc", canonical: "verify_order_payment_v1" },
  { key: "finance_clearance_facts", kind: "core_rpc", canonical: "get_finance_operations_clearance_facts_v1" },
  { key: "finance_operations_clearance", kind: "core_rpc", canonical: "decide_finance_operations_clearance_v1" },
  { key: "production_release", kind: "core_rpc", canonical: "release_order_to_in_production_v1" },
  { key: "rgs_reserve", kind: "core_rpc", canonical: "reserve_rgs_stock" },
  { key: "dispatch_consignment", kind: "core_rpc", canonical: "create_b2b_dispatch_consignment" },
  { key: "dispatch_carton", kind: "core_rpc", canonical: "open_b2b_dispatch_carton" },
  { key: "dispatch_dpl", kind: "core_rpc", canonical: "create_b2b_dispatch_packing_list" },
  { key: "dispatch_dpl_submit", kind: "core_rpc", canonical: "submit_b2b_dispatch_packing_list_to_finance" },
  { key: "finance_exit_facts", kind: "core_rpc", canonical: "get_finance_exit_facts_v1" },
  { key: "final_invoice", kind: "core_rpc", canonical: "issue_final_invoice_v1" },
  { key: "finance_dispatch_clearance", kind: "core_rpc", canonical: "decide_finance_dispatch_clearance_v1" },
  { key: "dispatch_proof", kind: "core_rpc", canonical: "record_dispatch_proof_packet_v1" },
  { key: "gate_release", kind: "core_rpc", canonical: "release_b2b_dispatch_carton_at_gate_v1" },
  { key: "order_dispatched", kind: "core_rpc", canonical: "release_order_to_dispatched_v1", envOverrideKey: "POINT100_ORDER_DISPATCHED_RPC" },
  { key: "buyer_catalogue_route", kind: "central_route", canonical: "/buyer/catalogue" },
  { key: "security_gate_route", kind: "central_route", canonical: "/security-gate" },
  { key: "scan_timeline_route", kind: "central_route", canonical: "/admin/scan-timeline" },
  { key: "finance_board_route", kind: "central_route", canonical: "/admin/finance-board" },
  { key: "gate_client", kind: "central_client", canonical: "gateExitAuthorityClient" },
  { key: "finance_exit_client", kind: "central_client", canonical: "financeExitAuthorityClient" },
  { key: "payment_client", kind: "central_client", canonical: "paymentAuthorityClient" },
] as const;

export function resolveBoundContract(binding: Point100ContractBinding): string {
  if (binding.envOverrideKey) {
    const override = typeof process !== "undefined" ? process.env[binding.envOverrideKey]?.trim() : undefined;
    if (override) return override;
  }
  return binding.canonical;
}

export function bindingByKey(key: string): Point100ContractBinding | undefined {
  return POINT100_CONTRACT_BINDINGS.find((binding) => binding.key === key);
}
