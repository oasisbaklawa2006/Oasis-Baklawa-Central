import type { ClientResolutionResult } from "./clientResolutionTypes";
import type { SenderIdentityViewModel } from "./senderIdentityTypes";
import type { DraftOrderGovernanceRoles } from "./draftOrderExtractionTypes";

/**
 * Preserves ownership slots for a draft order projection without mutating live orders.
 * Values are copied from WA-03A sender identity + WA-04A client owner — never reassigned here.
 */
export function buildDraftOrderGovernanceRoles(args: {
  client: ClientResolutionResult | null;
  senderIdentity: SenderIdentityViewModel | null;
}): DraftOrderGovernanceRoles {
  const notes: string[] = [
    "Governance slots are projected read-only — no live order rows created or updated.",
    "Client owner preserved from WA-04A account_manager_id mapping.",
  ];

  const clientOwnerId = args.client?.bestMatch?.ownerId ?? null;
  const clientOwnerName = args.client?.bestMatch?.ownerName ?? null;

  let orderCreatorId: string | null = null;
  let orderCreatorName: string | null = null;
  if (args.senderIdentity?.kind === "employee" && args.senderIdentity.employeeProfile) {
    orderCreatorId = args.senderIdentity.employeeProfile.id;
    orderCreatorName =
      args.senderIdentity.employeeProfile.full_name ??
      args.senderIdentity.employeeProfile.name ??
      args.senderIdentity.roleFromEdge;
    notes.push("Order creator slot filled from WA-03A employee sender profile.");
  } else {
    notes.push("Order creator slot empty — inbound sender is not a mapped employee.");
  }

  const orderHandlerId = clientOwnerId;
  const orderHandlerName = clientOwnerName;
  if (clientOwnerId) {
    notes.push("Order handler preserved as client owner until reassignment workflow is enabled.");
  } else {
    notes.push("Order handler slot empty — no client owner resolved.");
  }

  notes.push("Approver slot reserved — human approval required; no automation in Sprint 8.");

  return {
    clientOwnerId,
    clientOwnerName,
    orderCreatorId,
    orderCreatorName,
    orderHandlerId,
    orderHandlerName,
    approverId: null,
    approverName: null,
    preservationNotes: notes,
  };
}
