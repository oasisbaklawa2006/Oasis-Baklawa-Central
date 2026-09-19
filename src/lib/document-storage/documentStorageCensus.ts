/**
 * Cross-repo census of document/file storage surfaces relevant to Point22.
 * Central implements only `centralOwned` gaps; foreign prerequisites are listed separately.
 */
export interface DocumentStorageSurface {
  id: string;
  repository: "Central" | "Core" | "Buyer" | "AI Studio" | "Trace";
  bucket: string;
  documentClass: string;
  visibility: "public" | "private" | "protected";
  centralOwned: boolean;
  uploadAuthority: "central_ui" | "edge_function" | "buyer_app" | "core_only";
  binding: string;
  risks: readonly string[];
  point41Separate: boolean;
}

export const POINT22_STORAGE_CENSUS: readonly DocumentStorageSurface[] = [
  {
    id: "central-packing-proof",
    repository: "Central",
    bucket: "receipts",
    documentClass: "packing_proof",
    visibility: "private",
    centralOwned: true,
    uploadAuthority: "central_ui",
    binding: "orderId + actorUserId",
    risks: ["legacy public URL persistence", "filename-derived extension"],
    point41Separate: false,
  },
  {
    id: "central-dispatch-carton-evidence",
    repository: "Central",
    bucket: "receipts",
    documentClass: "dispatch_carton_evidence",
    visibility: "private",
    centralOwned: true,
    uploadAuthority: "central_ui",
    binding: "cartonId + actorUserId",
    risks: ["legacy public URL in open_photo_ref"],
    point41Separate: false,
  },
  {
    id: "central-product-image",
    repository: "Central",
    bucket: "product-images",
    documentClass: "product_image",
    visibility: "public",
    centralOwned: true,
    uploadAuthority: "central_ui",
    binding: "productId (optional on create)",
    risks: ["unscoped random root keys"],
    point41Separate: true,
  },
  {
    id: "core-payment-receipt",
    repository: "Buyer",
    bucket: "receipts",
    documentClass: "payment_receipt",
    visibility: "private",
    centralOwned: false,
    uploadAuthority: "buyer_app",
    binding: "orderId + companyId + paymentId",
    risks: ["receipts bucket public flag drift on prod"],
    point41Separate: false,
  },
  {
    id: "core-final-invoice",
    repository: "Core",
    bucket: "final-invoices",
    documentClass: "invoice_document",
    visibility: "private",
    centralOwned: false,
    uploadAuthority: "edge_function",
    binding: "companyId + ledgerId",
    risks: ["getPublicUrl on private invoice PDFs"],
    point41Separate: false,
  },
  {
    id: "core-whatsapp-attachment",
    repository: "Core",
    bucket: "whatsapp_attachments",
    documentClass: "whatsapp_media_hint",
    visibility: "protected",
    centralOwned: false,
    uploadAuthority: "core_only",
    binding: "packet/message identity",
    risks: ["protected corpus secrets", "public URL leakage"],
    point41Separate: true,
  },
];

export const POINT22_FOREIGN_PREREQUISITES = [
  "Core: reconcile storage.buckets.public for receipts (intended private, prod may be true).",
  "Core: final-invoices edge functions must stop using getPublicUrl for private PDFs.",
  "Core/Buyer: payment receipt upload authority remains in Buyer + Core RPCs.",
  "Core: whatsapp_attachments ingress, retention, and protected corpus handling (Point41 boundary).",
] as const;

export const POINT22_CENTRAL_MAIN_SHA = "64a107dfc167be76673a3d18f177a72472dcb241";

export const POINT22_STORAGE_CONTRACT_SHAS = {
  centralMain: POINT22_CENTRAL_MAIN_SHA,
  coreProductImagesLimits: "20260809211500_enforce_product_images_bucket_limits",
  coreBuyerReceiptStorage: "20260515194500_buyer_payment_receipt_and_storage",
  coreWhatsappAttachmentsBucket: "20260411112153_df91b082-600a-4f92-8ff9-877e56bc7e02",
} as const;
