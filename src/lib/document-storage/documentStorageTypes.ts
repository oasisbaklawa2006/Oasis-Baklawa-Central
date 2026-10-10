/** Governed document / file-storage classes owned by Central callers. */
export const DOCUMENT_STORAGE_CLASSES = [
  "payment_receipt",
  "packing_proof",
  "dispatch_carton_evidence",
  "product_image",
  "invoice_document",
  "support_attachment",
  "whatsapp_media_hint",
] as const;

export type DocumentStorageClass = (typeof DOCUMENT_STORAGE_CLASSES)[number];

export const DOCUMENT_VISIBILITY_CLASSES = ["public", "private", "protected"] as const;

export type DocumentVisibilityClass = (typeof DOCUMENT_VISIBILITY_CLASSES)[number];

export const DOCUMENT_STORAGE_BUCKETS = [
  "receipts",
  "product-images",
  "final-invoices",
  "whatsapp_attachments",
] as const;

export type DocumentStorageBucket = (typeof DOCUMENT_STORAGE_BUCKETS)[number];

export type DocumentStorageProvenance =
  | "central_admin_ui"
  | "buyer_app"
  | "edge_function"
  | "whatsapp_ingress"
  | "import_batch";

export interface GovernedStorageBinding {
  companyId?: string | null;
  orderId?: string | null;
  cartonId?: string | null;
  productId?: string | null;
  documentId?: string | null;
}

export interface GovernedStorageReference {
  bucket: DocumentStorageBucket;
  storageKey: string;
  /** Canonical opaque reference persisted as business metadata. */
  canonicalRef: string;
  documentClass: DocumentStorageClass;
  visibility: DocumentVisibilityClass;
  contentType: string;
  byteSize: number;
  binding: GovernedStorageBinding;
  actorUserId: string;
  provenance: DocumentStorageProvenance;
  capturedAt: string;
}

export interface GovernedUploadRequest {
  documentClass: DocumentStorageClass;
  file: Pick<File, "type" | "size" | "name">;
  binding: GovernedStorageBinding;
  actorUserId: string;
  provenance: DocumentStorageProvenance;
}

export interface GovernedUploadPlan {
  bucket: DocumentStorageBucket;
  storageKey: string;
  contentType: string;
  visibility: DocumentVisibilityClass;
  documentClass: DocumentStorageClass;
  binding: GovernedStorageBinding;
  actorUserId: string;
  provenance: DocumentStorageProvenance;
}

export type DocumentStorageErrorCode =
  | "unresolved_identity"
  | "unsafe_path"
  | "unsafe_mime"
  | "unsafe_size"
  | "unauthorized_bucket"
  | "cross_company_access"
  | "storage_unavailable"
  | "demo_fallback_forbidden"
  | "invalid_reference"
  | "signed_url_failed";

export class DocumentStorageGovernanceError extends Error {
  readonly code: DocumentStorageErrorCode;

  constructor(code: DocumentStorageErrorCode, message: string) {
    super(message);
    this.name = "DocumentStorageGovernanceError";
    this.code = code;
  }
}
