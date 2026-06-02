import type {
  CatalogueApprovalOutcome,
  CatalogueApprovalRpcAction,
  CatalogueApprovalRpcResult,
  CatalogueDraftKind,
} from "./catalogueApprovalTypes";

const RPC_ACTIONS: CatalogueApprovalRpcAction[] = [
  "approved",
  "rejected",
  "approve_blocked_mapping_not_finalized",
];

function parseRpcAction(value: unknown): CatalogueApprovalRpcAction | undefined {
  if (typeof value !== "string") return undefined;
  return RPC_ACTIONS.includes(value as CatalogueApprovalRpcAction)
    ? (value as CatalogueApprovalRpcAction)
    : undefined;
}

export const CATALOGUE_APPROVAL_MESSAGES = {
  tagApproved: "Tag approved",
  aliasApproved: "Alias approved",
  rejected: "Rejected",
  mappingNotFinalized: "Mapping not finalized yet",
  notAuthorized: "Not authorized",
  approvalFailed: (reason: string) => `Approval failed: ${reason}`,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseCatalogueApprovalRpcResult(raw: unknown): CatalogueApprovalRpcResult {
  if (!isRecord(raw)) {
    return { ok: false, message: "Invalid RPC response" };
  }
  return {
    ok: raw.ok === true,
    action: parseRpcAction(raw.action),
    message: typeof raw.message === "string" ? raw.message : undefined,
    draft_table: typeof raw.draft_table === "string" ? raw.draft_table : undefined,
    draft_id: typeof raw.draft_id === "string" ? raw.draft_id : undefined,
    target_record_id:
      typeof raw.target_record_id === "string" ? raw.target_record_id : undefined,
    tag_key: typeof raw.tag_key === "string" ? raw.tag_key : undefined,
  };
}

export function isCatalogueNotAuthorizedError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("catalogue reviewer permission required") ||
    lower.includes("not authorized") ||
    lower.includes("permission denied") ||
    lower.includes("jwt")
  );
}

export function outcomeFromRpcResult(
  kind: CatalogueDraftKind,
  rpc: CatalogueApprovalRpcResult,
): CatalogueApprovalOutcome {
  if (rpc.ok && rpc.action === "approved") {
    return {
      kind: kind === "tag" ? "tag_approved" : "alias_approved",
      success: true,
      message:
        kind === "tag"
          ? CATALOGUE_APPROVAL_MESSAGES.tagApproved
          : CATALOGUE_APPROVAL_MESSAGES.aliasApproved,
      rpc,
    };
  }

  if (rpc.ok && rpc.action === "rejected") {
    return {
      kind: "rejected",
      success: true,
      message: CATALOGUE_APPROVAL_MESSAGES.rejected,
      rpc,
    };
  }

  if (!rpc.ok && rpc.action === "approve_blocked_mapping_not_finalized") {
    return {
      kind: "mapping_not_finalized",
      success: false,
      message: CATALOGUE_APPROVAL_MESSAGES.mappingNotFinalized,
      rpc,
    };
  }

  return {
    kind: "failed",
    success: false,
    message: CATALOGUE_APPROVAL_MESSAGES.approvalFailed(
      rpc.message ?? rpc.action ?? "Unknown error",
    ),
    rpc,
  };
}

export function outcomeFromSupabaseError(
  errorMessage: string,
  kind: CatalogueDraftKind,
): CatalogueApprovalOutcome {
  if (isCatalogueNotAuthorizedError(errorMessage)) {
    return {
      kind: "not_authorized",
      success: false,
      message: CATALOGUE_APPROVAL_MESSAGES.notAuthorized,
    };
  }
  const action = kind === "tag" ? "tag_error" : "alias_error";
  return {
    kind: "failed",
    success: false,
    message: CATALOGUE_APPROVAL_MESSAGES.approvalFailed(errorMessage),
    rpc: { ok: false, action, message: errorMessage },
  };
}
