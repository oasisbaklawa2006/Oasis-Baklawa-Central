import type { CanonicalEntityType } from "./entityTypes";

export type OperationalOwnerRole =
  | "finance_head"
  | "finance_exec"
  | "operations_manager"
  | "production_manager"
  | "assembly_manager"
  | "dispatch_manager"
  | "dispatch_incharge"
  | "store_incharge"
  | "security_control"
  | "support_executive"
  | "cmd_escalation"
  | "unassigned";

export interface EntityOwnershipContract {
  entityType: CanonicalEntityType;
  primaryOwner: OperationalOwnerRole;
  backupOwner?: OperationalOwnerRole;
  /** When true, ownership is advisory until persisted assignment exists. */
  projectionOnly: true;
  notes?: string;
}

/** Default ownership matrix — contracts for queue routing, not live assignment. */
export const ENTITY_OWNERSHIP_MATRIX: EntityOwnershipContract[] = [
  { entityType: "order", primaryOwner: "operations_manager", backupOwner: "cmd_escalation", projectionOnly: true },
  { entityType: "order_item", primaryOwner: "production_manager", backupOwner: "operations_manager", projectionOnly: true },
  { entityType: "reservation", primaryOwner: "store_incharge", backupOwner: "operations_manager", projectionOnly: true },
  { entityType: "carton", primaryOwner: "assembly_manager", backupOwner: "dispatch_manager", projectionOnly: true },
  { entityType: "dispatch", primaryOwner: "dispatch_manager", backupOwner: "dispatch_incharge", projectionOnly: true },
  { entityType: "shipment", primaryOwner: "dispatch_manager", projectionOnly: true },
  { entityType: "invoice", primaryOwner: "finance_head", backupOwner: "finance_exec", projectionOnly: true },
  { entityType: "payment", primaryOwner: "finance_exec", backupOwner: "finance_head", projectionOnly: true },
  { entityType: "approval_request", primaryOwner: "finance_head", backupOwner: "cmd_escalation", projectionOnly: true },
  { entityType: "factory_followup", primaryOwner: "production_manager", projectionOnly: true },
  { entityType: "inventory_snapshot", primaryOwner: "store_incharge", backupOwner: "operations_manager", projectionOnly: true },
  { entityType: "scan_event", primaryOwner: "security_control", backupOwner: "dispatch_incharge", projectionOnly: true },
  { entityType: "barcode_label", primaryOwner: "dispatch_incharge", backupOwner: "assembly_manager", projectionOnly: true },
  { entityType: "whatsapp_packet", primaryOwner: "support_executive", backupOwner: "operations_manager", projectionOnly: true },
  { entityType: "notification", primaryOwner: "support_executive", projectionOnly: true, notes: "Intent only — no send engine" },
  { entityType: "media_document", primaryOwner: "dispatch_manager", projectionOnly: true },
  { entityType: "customer_timeline_projection", primaryOwner: "support_executive", backupOwner: "operations_manager", projectionOnly: true },
];

export function ownershipForEntityType(type: CanonicalEntityType): EntityOwnershipContract | undefined {
  return ENTITY_OWNERSHIP_MATRIX.find((c) => c.entityType === type);
}

export function formatOwnerRole(role: OperationalOwnerRole): string {
  return role.replace(/_/g, " ");
}
