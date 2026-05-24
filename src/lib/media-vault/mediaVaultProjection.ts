import type { MediaBackendStatus, MediaDocumentKind, MediaVaultGroup, MediaVaultProjectionItem } from "./mediaVaultTypes";

function idFor(kind: MediaDocumentKind, shell: boolean): string {
  return shell ? `media-vault:shell:${kind}` : `media-vault:meta:${kind}`;
}

const KIND_ORDER: MediaDocumentKind[] = [
  "invoice_document",
  "payment_receipt",
  "packing_photo",
  "dispatch_proof",
  "label_preview",
  "whatsapp_attachment_hint",
  "customer_reference_image",
  "support_ticket_media",
];

const META: Record<
  MediaDocumentKind,
  { title: string; summary: string; group: MediaVaultGroup; entityTypeLabel: string; sourceChip: string; backend: MediaBackendStatus }
> = {
  invoice_document: {
    title: "Invoice PDF / image",
    summary: "Signed invoices and tax paperwork — upload backend not connected; metadata placeholder only.",
    group: "financial",
    entityTypeLabel: "Invoice",
    sourceChip: "Finance",
    backend: "upload_backend_pending",
  },
  payment_receipt: {
    title: "Payment receipt",
    summary: "Bank / UPI / card receipt captures — no binary storage in this foundation.",
    group: "financial",
    entityTypeLabel: "Receipt",
    sourceChip: "Finance",
    backend: "upload_backend_pending",
  },
  packing_photo: {
    title: "Packing bench photo",
    summary: "Line-ready evidence photos — operator attach workflow pending.",
    group: "dispatch",
    entityTypeLabel: "Packing",
    sourceChip: "Dispatch",
    backend: "manual_verification_required",
  },
  dispatch_proof: {
    title: "Dispatch proof (POD / handoff)",
    summary: "Carrier or cold-chain proof-of-delivery hints — visibility metadata only.",
    group: "dispatch",
    entityTypeLabel: "Dispatch",
    sourceChip: "Dispatch",
    backend: "upload_backend_pending",
  },
  label_preview: {
    title: "Label preview JSON",
    summary: "Links to Label Command Center style payloads — not a print spooler artifact.",
    group: "labels",
    entityTypeLabel: "Label",
    sourceChip: "Labels",
    backend: "metadata_only",
  },
  whatsapp_attachment_hint: {
    title: "WhatsApp attachment reference",
    summary: "Attachment presence hints from inbox projections — no media duplication here.",
    group: "communication",
    entityTypeLabel: "WhatsApp",
    sourceChip: "Inbox",
    backend: "metadata_only",
  },
  customer_reference_image: {
    title: "Customer reference image",
    summary: "Wedding references / plating photos — gated customer uploads not wired in this shell.",
    group: "customer",
    entityTypeLabel: "Customer",
    sourceChip: "CRM",
    backend: "upload_backend_pending",
  },
  support_ticket_media: {
    title: "Support ticket media",
    summary: "Ticket screenshots or voice notes — support vault backend pending.",
    group: "support",
    entityTypeLabel: "Support",
    sourceChip: "Support",
    backend: "upload_backend_pending",
  },
};

/**
 * Catalog of metadata-only document visibility rows. All `isShellSample: true` until a read model exists.
 */
export function buildMediaVaultProjectionCatalog(): MediaVaultProjectionItem[] {
  return KIND_ORDER.map((kind) => {
    const m = META[kind];
    return {
      id: idFor(kind, true),
      kind,
      title: m.title,
      summary: m.summary,
      group: m.group,
      backendStatus: m.backend,
      isShellSample: true,
      entityTypeLabel: m.entityTypeLabel,
      sourceChip: m.sourceChip,
    };
  });
}

export function groupMediaVaultItems(items: MediaVaultProjectionItem[]): Record<MediaVaultGroup, MediaVaultProjectionItem[]> {
  const empty: Record<MediaVaultGroup, MediaVaultProjectionItem[]> = {
    financial: [],
    dispatch: [],
    labels: [],
    communication: [],
    customer: [],
    support: [],
  };
  for (const i of items) {
    empty[i.group].push(i);
  }
  return empty;
}
