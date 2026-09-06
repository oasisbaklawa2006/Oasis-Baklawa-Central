/**
 * Point 80 — census of financial/operational hold, release, reversal and second-approval surfaces.
 * Read-only registry; mutations must route through `financeControlAuthorityClient`.
 */

export type FinanceControlSurfaceKind =
  | "hold"
  | "release"
  | "reversal"
  | "second_approval"
  | "override";

export type FinanceControlAuthorityClass =
  | "core_rpc"
  | "core_partial"
  | "central_read_only"
  | "central_shadow"
  | "ui_only";

export interface FinanceControlSurfaceEntry {
  id: string;
  kind: FinanceControlSurfaceKind;
  authorityClass: FinanceControlAuthorityClass;
  centralModule: string;
  coreRpcOrView: string | null;
  actorRoles: string[];
  requiresAal2: boolean;
  requiresSecondApproval: boolean;
  bindsOrderPiCommercial: boolean;
  idempotent: boolean;
  staleVersionGuard: boolean;
  auditEvent: string | null;
  point80Scope: boolean;
  /** Separates Point 80 from adjacent lanes when false. */
  separateFromPoint80: false | "point78_payment_proof" | "point79_wallet_credit" | "point81_ageing_disputes";
  gapNote: string | null;
}

export const FINANCE_CONTROL_SURFACE_CENSUS: FinanceControlSurfaceEntry[] = [
  {
    id: "pf6c.operations_clearance.grant",
    kind: "release",
    authorityClass: "core_rpc",
    centralModule: "order-authority/financeClearanceAuthorityClient",
    coreRpcOrView: "decide_finance_operations_clearance_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_operations_clearance_decided",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: null,
  },
  {
    id: "pf6c.operations_clearance.revoke",
    kind: "reversal",
    authorityClass: "core_rpc",
    centralModule: "order-authority/financeClearanceAuthorityClient",
    coreRpcOrView: "decide_finance_operations_clearance_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_operations_clearance_decided",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: null,
  },
  {
    id: "pf6c.operations_clearance.read",
    kind: "hold",
    authorityClass: "core_rpc",
    centralModule: "order-authority/financeClearanceAuthorityClient",
    coreRpcOrView: "get_finance_operations_clearance_facts_v1",
    actorRoles: ["FINANCE_HEAD", "FINANCE_EXEC", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: false,
    auditEvent: null,
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: null,
  },
  {
    id: "finance_exit.dispatch_clearance.grant",
    kind: "release",
    authorityClass: "core_rpc",
    centralModule: "order-authority/financeExitAuthorityClient",
    coreRpcOrView: "decide_finance_dispatch_clearance_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_dispatch_clearance_decided",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: null,
  },
  {
    id: "finance_exit.dispatch_clearance.revoke",
    kind: "reversal",
    authorityClass: "core_rpc",
    centralModule: "order-authority/financeExitAuthorityClient",
    coreRpcOrView: "decide_finance_dispatch_clearance_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_dispatch_clearance_decided",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: null,
  },
  {
    id: "pf6d.finance_hold.place",
    kind: "hold",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "place_finance_hold_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_hold_placed",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — Central must not write finance_review_evidence directly.",
  },
  {
    id: "pf6d.finance_hold.release",
    kind: "release",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "release_finance_hold_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_hold_released",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — release requires immutable hold_event_id reference.",
  },
  {
    id: "pf6d.finance_reversal.request",
    kind: "reversal",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "request_finance_reversal_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_reversal_requested",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — reversal must reference immutable original_event_id.",
  },
  {
    id: "pf6d.finance_reversal.complete",
    kind: "reversal",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "complete_finance_reversal_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_reversal_completed",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — completing actor must differ from requesting actor.",
  },
  {
    id: "pf6d.finance_second_approval.request",
    kind: "second_approval",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "request_finance_second_approval_v1",
    actorRoles: ["FINANCE_HEAD", "FINANCE_MANAGER", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_second_approval_requested",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — high-value/exceptional release lane.",
  },
  {
    id: "pf6d.finance_second_approval.decide",
    kind: "second_approval",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "decide_finance_second_approval_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "finance_second_approval_decided",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — deciding actor must differ from requesting actor.",
  },
  {
    id: "pf6d.finance_control.read",
    kind: "hold",
    authorityClass: "core_partial",
    centralModule: "order-authority/financeControlAuthorityClient",
    coreRpcOrView: "get_finance_control_facts_v1",
    actorRoles: ["FINANCE_HEAD", "FINANCE_EXEC", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: false,
    auditEvent: null,
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Core RPC prerequisite — unified hold/release/reversal/approval facts.",
  },
  {
    id: "governance.finance_review_evidence.shadow",
    kind: "hold",
    authorityClass: "central_shadow",
    centralModule: "finance-governance/financeGovernanceService",
    coreRpcOrView: null,
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: false,
    idempotent: false,
    staleVersionGuard: false,
    auditEvent: "finance_hold_created",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "UI-only shadow — blocked for production writes; use PF-6D Core RPCs.",
  },
  {
    id: "governance.commercial_release.shadow",
    kind: "release",
    authorityClass: "central_shadow",
    centralModule: "finance-governance/financeGovernanceService",
    coreRpcOrView: null,
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: false,
    idempotent: false,
    staleVersionGuard: false,
    auditEvent: "finance_commercially_released",
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "UI-only shadow — commercial release record must bind Core clearance authority.",
  },
  {
    id: "finance_release_state.derive",
    kind: "hold",
    authorityClass: "central_read_only",
    centralModule: "utils/financeReleaseState",
    coreRpcOrView: null,
    actorRoles: [],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: false,
    idempotent: true,
    staleVersionGuard: false,
    auditEvent: null,
    point80Scope: true,
    separateFromPoint80: false,
    gapNote: "Read-only chip derivation — never mutates finance authority.",
  },
  {
    id: "dispatch.finalization.reversal",
    kind: "reversal",
    authorityClass: "central_shadow",
    centralModule: "dispatch-finalization/dispatchFinalizationService",
    coreRpcOrView: null,
    actorRoles: ["DISPATCH_HEAD", "INVENTORY_MANAGER", "SUPER_ADMIN"],
    requiresAal2: false,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: false,
    idempotent: false,
    staleVersionGuard: false,
    auditEvent: "dispatch_reversal_completed",
    point80Scope: false,
    separateFromPoint80: false,
    gapNote: "Operational dispatch compensating lineage only — not finance hold/release authority.",
  },
  {
    id: "pf6a.payment.verify",
    kind: "release",
    authorityClass: "core_rpc",
    centralModule: "order-authority/paymentAuthorityClient",
    coreRpcOrView: "verify_payment_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: false,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "payment_verified",
    point80Scope: false,
    separateFromPoint80: "point78_payment_proof",
    gapNote: "Point 78 payment-proof lane — not Point 80 hold/release closure.",
  },
  {
    id: "pf6b.credit.decide",
    kind: "second_approval",
    authorityClass: "core_rpc",
    centralModule: "order-authority/creditWalletAuthorityClient",
    coreRpcOrView: "decide_credit_request_v1",
    actorRoles: ["FINANCE_HEAD", "ADMIN", "SUPER_ADMIN"],
    requiresAal2: true,
    requiresSecondApproval: true,
    bindsOrderPiCommercial: true,
    idempotent: true,
    staleVersionGuard: true,
    auditEvent: "credit_request_decided",
    point80Scope: false,
    separateFromPoint80: "point79_wallet_credit",
    gapNote: "Point 79 wallet/credit lane — separate from generic finance hold/release.",
  },
];

export const POINT80_REQUIRED_CORE_RPCS = [
  "get_finance_control_facts_v1",
  "place_finance_hold_v1",
  "release_finance_hold_v1",
  "request_finance_reversal_v1",
  "complete_finance_reversal_v1",
  "request_finance_second_approval_v1",
  "decide_finance_second_approval_v1",
] as const;

export type Point80RequiredCoreRpc = (typeof POINT80_REQUIRED_CORE_RPCS)[number];

export function listPoint80Surfaces(): FinanceControlSurfaceEntry[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter((entry) => entry.point80Scope);
}

export function listShadowSurfaces(): FinanceControlSurfaceEntry[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter((entry) => entry.authorityClass === "central_shadow");
}

export function listCorePartialSurfaces(): FinanceControlSurfaceEntry[] {
  return FINANCE_CONTROL_SURFACE_CENSUS.filter((entry) => entry.authorityClass === "core_partial");
}
