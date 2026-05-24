import type { MediaDocumentKind } from "./mediaVaultTypes";

export type DocumentOperationalLink =
  | "dispatch_proof"
  | "payment_proof"
  | "qc_proof"
  | "shelf_photo"
  | "damage_evidence"
  | "barcode_label_preview"
  | "reservation_proof"
  | "pickup_proof";

export interface DocumentGraphNode {
  id: string;
  category: DocumentOperationalLink;
  /** Related logical entity (projection id only). */
  entityRef: string;
  relatedKinds: MediaDocumentKind[];
}

/** Metadata-only relationship graph — no binary payloads. */
export function buildDocumentGovernanceGraph(): DocumentGraphNode[] {
  return [
    {
      id: "doc-graph:dispatch",
      category: "dispatch_proof",
      entityRef: "order:dispatch",
      relatedKinds: ["dispatch_proof", "packing_photo"],
    },
    {
      id: "doc-graph:payment",
      category: "payment_proof",
      entityRef: "order:finance",
      relatedKinds: ["payment_receipt", "invoice_document"],
    },
    {
      id: "doc-graph:qc",
      category: "qc_proof",
      entityRef: "production:qc",
      relatedKinds: ["packing_photo"],
    },
    {
      id: "doc-graph:shelf",
      category: "shelf_photo",
      entityRef: "store:shelf",
      relatedKinds: ["customer_reference_image"],
    },
    {
      id: "doc-graph:damage",
      category: "damage_evidence",
      entityRef: "carton:damage",
      relatedKinds: ["packing_photo", "dispatch_proof"],
    },
    {
      id: "doc-graph:label",
      category: "barcode_label_preview",
      entityRef: "label:preview",
      relatedKinds: ["label_preview"],
    },
    {
      id: "doc-graph:reservation",
      category: "reservation_proof",
      entityRef: "reservation:hold",
      relatedKinds: ["invoice_document", "payment_receipt"],
    },
    {
      id: "doc-graph:pickup",
      category: "pickup_proof",
      entityRef: "dispatch:pickup",
      relatedKinds: ["dispatch_proof", "whatsapp_attachment_hint"],
    },
  ];
}
