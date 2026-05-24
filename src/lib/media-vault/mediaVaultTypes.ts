/**
 * Media / document vault visibility model — metadata only, no uploads, no public URLs.
 */

export type MediaDocumentKind =
  | "invoice_document"
  | "payment_receipt"
  | "packing_photo"
  | "dispatch_proof"
  | "label_preview"
  | "whatsapp_attachment_hint"
  | "customer_reference_image"
  | "support_ticket_media";

export type MediaVaultGroup = "financial" | "dispatch" | "labels" | "communication" | "customer" | "support";

export type MediaBackendStatus = "metadata_only" | "upload_backend_pending" | "manual_verification_required";

export interface MediaVaultProjectionItem {
  id: string;
  kind: MediaDocumentKind;
  title: string;
  summary: string;
  group: MediaVaultGroup;
  backendStatus: MediaBackendStatus;
  /** When true, row is explicit shell sample (no datastore row). */
  isShellSample: boolean;
  entityTypeLabel: string;
  sourceChip: string;
}
