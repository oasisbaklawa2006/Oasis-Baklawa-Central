import { buildMediaVaultProjectionCatalog } from "@/lib/media-vault/mediaVaultProjection";
import type { MediaBackendStatus, MediaDocumentKind, MediaVaultProjectionItem } from "@/lib/media-vault/mediaVaultTypes";
import { dedupeOperationalEventsById } from "./normalize";
import type { OperationalEventRecord } from "./types";
import { MediaOperationalEventKind } from "./types";

const SOURCE = "derived_media_vault" as const;

function operationalKindFor(kind: MediaDocumentKind): string {
  switch (kind) {
    case "invoice_document":
    case "payment_receipt":
      return MediaOperationalEventKind.RECEIPT_HINT;
    case "packing_photo":
    case "dispatch_proof":
      return MediaOperationalEventKind.DISPATCH_PROOF_HINT;
    case "label_preview":
      return MediaOperationalEventKind.LABEL_PREVIEW;
    case "whatsapp_attachment_hint":
      return MediaOperationalEventKind.WHATSAPP_ATTACHMENT_HINT;
    default:
      return MediaOperationalEventKind.DOCUMENT_VISIBLE;
  }
}

function severityFor(backend: MediaBackendStatus): OperationalEventRecord["severity"] {
  if (backend === "manual_verification_required") return "warning";
  if (backend === "upload_backend_pending") return "warning";
  return "info";
}

export interface MediaFeedInput {
  /** When false, skip umbrella explainer row. */
  includeMetadataExplainer?: boolean;
}

/**
 * Read-only media / document visibility feed — metadata only, occurredAt null.
 */
export function buildMediaOperationalFeed(input: MediaFeedInput = {}): OperationalEventRecord[] {
  const catalog = buildMediaVaultProjectionCatalog();
  let sortKey = 7000;
  const next = () => sortKey++;
  const actor: OperationalEventRecord["actor"] = { role: "operator", displayLabel: "Media vault visibility" };
  const out: OperationalEventRecord[] = [];

  if (input.includeMetadataExplainer !== false) {
    out.push({
      id: "media-vault:shell:metadata_only",
      kind: MediaOperationalEventKind.DOCUMENT_VISIBLE,
      category: "audit",
      severity: "info",
      title: "Media / document vault — metadata only",
      detail:
        "No uploads, no signed public URLs, and no binary storage in this foundation. Grouped cards describe future document classes only.",
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "document", id: "media-vault-shell" }],
      source: SOURCE,
    });
  }

  for (const row of catalog) {
    out.push({
      id: `media-vault:proj:${row.kind}`,
      kind: operationalKindFor(row.kind),
      category: row.group === "financial" ? "financial" : row.group === "support" ? "support" : "operational",
      severity: severityFor(row.backendStatus),
      title: row.title,
      detail: [row.summary, row.isShellSample ? "Sample shell row — no backing file row." : null].filter(Boolean).join("\n"),
      occurredAt: null,
      sortKey: next(),
      actor,
      entities: [{ entityType: "document", id: row.id }],
      source: SOURCE,
      hasAttachment: row.kind === "whatsapp_attachment_hint",
    });
  }

  return dedupeOperationalEventsById(out);
}

export function countMediaManualVerificationProjections(catalog: MediaVaultProjectionItem[]): number {
  return catalog.filter((c) => c.backendStatus === "manual_verification_required").length;
}
