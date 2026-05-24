import type { WriteActionKind } from "./writeActionKinds";
import type { WriteRollbackKind } from "./writeAuthorityTypes";

const ROLLBACK_KIND: Record<WriteActionKind, WriteRollbackKind> = {
  "retail.reservation_draft.create": "soft_delete",
  "retail.reservation_draft.cancel": "state_revert",
  "retail.factory_followup.create": "soft_delete",
  "media.attachment_metadata.create": "soft_delete",
  "notification.acknowledge": "compensating_movement",
  "inventory.reservation_hold.request": "compensating_movement",
  "inventory.reconciliation_note.create": "soft_delete",
  "approval.request.create": "state_revert",
};

const ROLLBACK_PATH: Record<WriteActionKind, string> = {
  "retail.reservation_draft.create": "retail_reservations:cancel_draft_row + audit append",
  "retail.reservation_draft.cancel": "retail_reservations:restore_previous_state + audit append",
  "retail.factory_followup.create": "factory_followups:archive_row + audit append",
  "media.attachment_metadata.create": "media_vault:detach_metadata + blob lifecycle policy",
  "notification.acknowledge": "notifications:reopen_ack_state + audit append",
  "inventory.reservation_hold.request": "inventory_movements:post_release_hold + audit pair",
  "inventory.reconciliation_note.create": "inventory_notes:void_with_supervisor_pair",
  "approval.request.create": "approvals:withdraw_request + dual_control log",
};

export function rollbackKindForWriteAction(kind: WriteActionKind): WriteRollbackKind {
  return ROLLBACK_KIND[kind];
}

/** Human-readable rollback / reversal routing label for preflight UI and audit shells. */
export function rollbackPathForWriteAction(kind: WriteActionKind): string {
  return ROLLBACK_PATH[kind];
}
