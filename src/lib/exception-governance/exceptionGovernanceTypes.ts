/**
 * Point 89 — Central exception / quality-hold governance contract.
 *
 * Canonical wastage, rejection, shortage, blocker and QH mutations route through
 * governed Core RPCs only. Central never owns stock or job truth directly.
 */

export const EXCEPTION_CATEGORIES = [
  "wastage",
  "rejection",
  "shortage",
  "blocker",
  "quality_hold",
] as const;

export type ExceptionCategory = (typeof EXCEPTION_CATEGORIES)[number];

export const EXCEPTION_STATUSES = ["open", "resolved", "released", "denied"] as const;

export type ExceptionStatus = (typeof EXCEPTION_STATUSES)[number];

export const EXCEPTION_SUBSYSTEMS = [
  "PRODUCTION",
  "RGS",
  "ASSEMBLY",
  "3PGS",
  "INVENTORY",
  "DISPATCH",
] as const;

export type ExceptionSubsystem = (typeof EXCEPTION_SUBSYSTEMS)[number];

export const EXCEPTION_REASON_CODES = [
  "material_shortage",
  "equipment_failure",
  "quality_defect",
  "process_deviation",
  "batch_mismatch",
  "expiry_risk",
  "custody_variance",
  "operator_error",
  "supplier_variance",
  "inspection_hold",
  "other",
] as const;

export type ExceptionReasonCode = (typeof EXCEPTION_REASON_CODES)[number];

export type ExceptionAuthorityAction =
  | "exception:declare_wastage"
  | "exception:declare_rejection"
  | "exception:declare_shortage"
  | "exception:declare_blocker"
  | "exception:declare_quality_hold"
  | "exception:release_quality_hold"
  | "exception:release_blocker"
  | "exception:resolve";

export type ExceptionForbiddenAction =
  | "exception:direct_stock_mutate"
  | "exception:direct_job_mutate"
  | "exception:shadow_order_reject";

export type ExceptionAuthorityRole =
  | "SUPER_ADMIN"
  | "ADMIN"
  | "OPERATIONS_MANAGER"
  | "HOD"
  | "INVENTORY_MANAGER"
  | "QUALITY_CONTROLLER"
  | "DISPATCH_HEAD"
  | "DISPATCH_MANAGER"
  | "FINANCE_HEAD"
  | "UNKNOWN";

export interface ExceptionAuthorityContext {
  actorRole: string;
  actorDepartment?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  evidenceRef?: string | null;
  overrideReason?: string | null;
  releaseAuthorizerRole?: string | null;
}

export interface ExceptionAuthorityResult {
  allowed: boolean;
  reason: string;
}

export interface ExceptionCanonicalBinding {
  subsystem: ExceptionSubsystem;
  jobId?: string | null;
  orderId?: string | null;
  orderItemId?: string | null;
  productId?: string | null;
  sku?: string | null;
  batchNumber?: string | null;
  reservationId?: string | null;
  transferId?: string | null;
  componentId?: string | null;
  assemblyJobId?: string | null;
  receiptId?: string | null;
  department?: string | null;
  locationCode?: string | null;
}

export interface ExceptionQuantityImpact {
  expectedQty?: number | null;
  actualQty?: number | null;
  rejectedQty?: number | null;
  wastedQty?: number | null;
  holdQty?: number | null;
  shortageQty?: number | null;
}

export interface ExceptionGovernanceWriteContext {
  correlationId: string;
  actorUserId: string;
  actorRole: string;
  actorDepartment?: string | null;
  reason: string;
  reasonCode?: ExceptionReasonCode | null;
  evidenceRef?: string | null;
  releaseAuthorizerRole?: string | null;
  overrideReason?: string | null;
}

export interface ExceptionDeclarationInput {
  category: ExceptionCategory;
  binding: ExceptionCanonicalBinding;
  quantities?: ExceptionQuantityImpact;
  notes?: string | null;
  issueType?: string | null;
}

export interface ExceptionReleaseInput {
  category: "quality_hold" | "blocker";
  binding: ExceptionCanonicalBinding;
  targetId: string;
  resolutionNotes: string;
  quantities?: ExceptionQuantityImpact;
}

export interface GovernedExceptionRpcCall {
  rpcName: string;
  args: Record<string, unknown>;
}

export interface ExceptionGovernanceRpcResult {
  rpcName: string;
  alreadyApplied: boolean;
  correlationId: string;
}

export interface ExceptionReadRecord {
  id: string;
  category: ExceptionCategory;
  status: ExceptionStatus;
  subsystem: ExceptionSubsystem;
  binding: ExceptionCanonicalBinding;
  reason: string | null;
  reasonCode: ExceptionReasonCode | null;
  department: string | null;
  quantities: ExceptionQuantityImpact;
  reportedAt: string;
  resolvedAt: string | null;
}

export class ExceptionGovernanceError extends Error {
  readonly code:
    | "authority_denied"
    | "forbidden_action"
    | "validation_failed"
    | "shadow_write_blocked"
    | "completion_blocked"
    | "rpc_unavailable"
    | "department_isolation"
    | "duplicate_replay";

  constructor(
    code:
      | "authority_denied"
      | "forbidden_action"
      | "validation_failed"
      | "shadow_write_blocked"
      | "completion_blocked"
      | "rpc_unavailable"
      | "department_isolation"
      | "duplicate_replay",
    message: string,
  ) {
    super(message);
    this.name = "ExceptionGovernanceError";
    this.code = code;
  }
}
