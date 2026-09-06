import type {
  DocumentStorageBucket,
  DocumentStorageClass,
  DocumentVisibilityClass,
} from "./documentStorageTypes";

export interface DocumentClassPolicy {
  bucket: DocumentStorageBucket;
  visibility: DocumentVisibilityClass;
  pathPrefix: string;
  allowedMimeTypes: readonly string[];
  maxBytes: number;
  requiredBindings: ReadonlyArray<keyof import("./documentStorageTypes").GovernedStorageBinding>;
  centralUploadAllowed: boolean;
}

const IMAGE_MIME_JPEG_PNG_WEBP_HEIC = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
] as const;

const PRODUCT_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;

export const DOCUMENT_CLASS_POLICIES: Record<DocumentStorageClass, DocumentClassPolicy> = {
  payment_receipt: {
    bucket: "receipts",
    visibility: "private",
    pathPrefix: "payment-receipt",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 10 * 1024 * 1024,
    requiredBindings: ["orderId", "companyId"],
    centralUploadAllowed: false,
  },
  packing_proof: {
    bucket: "receipts",
    visibility: "private",
    pathPrefix: "packing-proof",
    allowedMimeTypes: IMAGE_MIME_JPEG_PNG_WEBP_HEIC,
    maxBytes: 10 * 1024 * 1024,
    requiredBindings: ["orderId"],
    centralUploadAllowed: true,
  },
  dispatch_carton_evidence: {
    bucket: "receipts",
    visibility: "private",
    pathPrefix: "dispatch-carton-evidence",
    allowedMimeTypes: IMAGE_MIME_JPEG_PNG_WEBP_HEIC,
    maxBytes: 10 * 1024 * 1024,
    requiredBindings: ["cartonId"],
    centralUploadAllowed: true,
  },
  product_image: {
    bucket: "product-images",
    visibility: "public",
    pathPrefix: "catalogue/products",
    allowedMimeTypes: PRODUCT_IMAGE_MIME,
    maxBytes: 10 * 1024 * 1024,
    requiredBindings: [],
    centralUploadAllowed: true,
  },
  invoice_document: {
    bucket: "final-invoices",
    visibility: "private",
    pathPrefix: "ledgers",
    allowedMimeTypes: ["application/pdf"],
    maxBytes: 25 * 1024 * 1024,
    requiredBindings: ["companyId", "documentId"],
    centralUploadAllowed: false,
  },
  support_attachment: {
    bucket: "receipts",
    visibility: "private",
    pathPrefix: "support-attachments",
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
    maxBytes: 10 * 1024 * 1024,
    requiredBindings: ["orderId"],
    centralUploadAllowed: false,
  },
  whatsapp_media_hint: {
    bucket: "whatsapp_attachments",
    visibility: "protected",
    pathPrefix: "ingress",
    allowedMimeTypes: [],
    maxBytes: 0,
    requiredBindings: ["documentId"],
    centralUploadAllowed: false,
  },
};

export const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/gif": "gif",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

export const SIGNED_URL_TTL_SECONDS = 3600;

export function policyForDocumentClass(documentClass: DocumentStorageClass): DocumentClassPolicy {
  return DOCUMENT_CLASS_POLICIES[documentClass];
}
