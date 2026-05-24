/**
 * Namespaced write intents — contracts only; no execution here.
 */
export const WRITE_ACTION_KINDS = [
  "retail.reservation_draft.create",
  "retail.reservation_draft.cancel",
  "retail.factory_followup.create",
  "media.attachment_metadata.create",
  "notification.acknowledge",
  "inventory.reservation_hold.request",
  "inventory.reconciliation_note.create",
  "approval.request.create",
] as const;

export type WriteActionKind = (typeof WRITE_ACTION_KINDS)[number];

export function isWriteActionKind(s: string): s is WriteActionKind {
  return (WRITE_ACTION_KINDS as readonly string[]).includes(s);
}
