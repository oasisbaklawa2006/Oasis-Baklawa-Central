/**
 * Point 77 — Central Finance canonical authority map.
 *
 * Single source of truth for which Finance surfaces exist, what lifecycle stage
 * they serve, and which Core RPCs (if any) govern their writes. Central must
 * consume Core facts only; capabilities without a Core RPC are marked unavailable.
 */

export type FinanceLifecycleStage =
  | "ingress"
  | "egress"
  | "governance"
  | "legacy_ops"
  | "commercial_config";

export type FinanceWriteBoundary =
  | "core_rpc_only"
  | "read_only"
  | "quarantined"
  | "evidence_store_only";

export type FinanceLegacyDisposition =
  | "canonical"
  | "supporting"
  | "quarantined"
  | "redirect";

export interface FinanceSurfaceDefinition {
  route: string;
  label: string;
  lifecycle: FinanceLifecycleStage;
  writeBoundary: FinanceWriteBoundary;
  moduleKey: string;
  coreRpcs: readonly string[];
  legacyDisposition: FinanceLegacyDisposition;
  unavailableCapabilities?: readonly string[];
  redirectTo?: string;
}

/** Canonical Finance routes and their Core authority bindings. */
export const FINANCE_CANONICAL_SURFACES: readonly FinanceSurfaceDefinition[] = [
  {
    route: "/admin/finance-board",
    label: "Finance Release Board",
    lifecycle: "ingress",
    writeBoundary: "core_rpc_only",
    moduleKey: "finance",
    legacyDisposition: "canonical",
    coreRpcs: [
      "get_order_payment_facts_v1",
      "verify_order_payment_v1",
      "reject_order_payment_v1",
      "reject_order_finance_review_v1",
      "get_finance_operations_clearance_facts_v1",
      "decide_finance_operations_clearance_v1",
      "release_order_to_in_production_v1",
    ],
  },
  {
    route: "/admin/accounts-release",
    label: "Accounts & Release (Finance Exit)",
    lifecycle: "egress",
    writeBoundary: "core_rpc_only",
    moduleKey: "accounts",
    legacyDisposition: "canonical",
    coreRpcs: [
      "get_finance_exit_facts_v1",
      "receive_submitted_b2b_dispatch_dpls_v1",
      "get_sales_order_pi_final_payment_request_v1",
      "issue_sales_order_pi_final_payment_request_v1",
      "issue_final_invoice_v1",
      "record_eway_bill_evidence_v1",
      "decide_finance_dispatch_clearance_v1",
      "clear_order_for_dispatch_v1",
    ],
  },
  {
    route: "/admin/finance-governance",
    label: "Finance Governance Board",
    lifecycle: "governance",
    writeBoundary: "evidence_store_only",
    moduleKey: "finance_audit",
    legacyDisposition: "canonical",
    coreRpcs: [],
    unavailableCapabilities: [
      "orders.payment_status mutation (evidence-only; not coupled to order state)",
    ],
  },
  {
    route: "/admin/finance",
    label: "Finance Control Tower (legacy ops)",
    lifecycle: "legacy_ops",
    writeBoundary: "quarantined",
    moduleKey: "finance",
    legacyDisposition: "supporting",
    redirectTo: "/admin/finance-board",
    coreRpcs: [
      "record_order_payment_proof_v1",
      "verify_order_payment_v1",
      "record_wallet_entry_v1",
      "request_credit_authority_v1",
      "decide_credit_request_v1",
      "confirm_prepaid_order_awaiting_advance_v1",
      "restore_order_financials",
    ],
    unavailableCapabilities: [
      "commission_payouts direct insert (no Core RPC)",
      "orders.payment_status direct update",
      "orders.status awaiting_final_payment direct update",
      "final invoice issuance (use /admin/accounts-release)",
    ],
  },
  {
    route: "/admin/pricing",
    label: "Commercial Pricing",
    lifecycle: "commercial_config",
    writeBoundary: "read_only",
    moduleKey: "pricing",
    legacyDisposition: "supporting",
    coreRpcs: [],
    unavailableCapabilities: ["Central pricing matrix writes (Core commercial freeze authority)"],
  },
  {
    route: "/admin/moq",
    label: "MOQ Rules",
    lifecycle: "commercial_config",
    writeBoundary: "read_only",
    moduleKey: "moq",
    legacyDisposition: "supporting",
    coreRpcs: [],
  },
  {
    route: "/admin/currency",
    label: "Currency Config",
    lifecycle: "commercial_config",
    writeBoundary: "read_only",
    moduleKey: "currency",
    legacyDisposition: "supporting",
    coreRpcs: [],
  },
];

/** Legacy bookmark redirects — not independent authority surfaces. */
export const FINANCE_LEGACY_REDIRECTS: Readonly<Record<string, string>> = {
  "/admin/finance/payments": "/admin/finance",
  "/admin/finance/invoices": "/admin/finance",
};

/** Capabilities with no Core RPC — must not be invented in Central. */
export const FINANCE_UNAVAILABLE_CAPABILITIES = new Set([
  "commission_payout",
  "orders_payment_status_direct_write",
  "orders_awaiting_final_payment_direct_write",
  "client_computed_dpl_variance_invoice",
]);

export function getFinanceSurfaceByRoute(route: string): FinanceSurfaceDefinition | undefined {
  const normalized = route.replace(/\/$/, "") || "/";
  return FINANCE_CANONICAL_SURFACES.find(
    (s) => normalized === s.route || normalized.startsWith(`${s.route}/`),
  );
}

export function isFinanceCapabilityAvailable(capability: string): boolean {
  return !FINANCE_UNAVAILABLE_CAPABILITIES.has(capability);
}

export function getCanonicalFinanceIngressRoute(): string {
  return "/admin/finance-board";
}

export function getCanonicalFinanceEgressRoute(): string {
  return "/admin/accounts-release";
}

/** All finance module routes for RBAC/isolation tests. */
export const FINANCE_MODULE_ROUTES = FINANCE_CANONICAL_SURFACES.map((s) => s.route);
