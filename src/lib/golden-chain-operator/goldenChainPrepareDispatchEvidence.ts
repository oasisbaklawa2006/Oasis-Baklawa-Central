import type { SupabaseClient } from "@supabase/supabase-js";
import type { DispatchReadinessBundle } from "@/lib/dispatch-readiness/createDispatchReadinessBundle";
import type { DispatchReadinessWriteContext } from "@/lib/dispatch-readiness/dispatchReadinessTypes";
import { recordVerifiedScanForStockFinalization } from "@/lib/inventory-reservations/reservationStagingPrerequisites";
import type { GoldenChainEvidenceRefs } from "./goldenChainTypes";
import { hasVerifiedReadinessEvidence } from "./goldenChainPrerequisites";
import type {
  ReadinessEvidenceSlice,
  ReadinessScanSlice,
} from "@/lib/execution-read-models/adapters/readinessSignalAdapter";

export interface PrepareDispatchEvidenceResult {
  added: string[];
  skipped: string[];
  scanRecorded: string[];
}

type EvidenceSlice = ReadinessEvidenceSlice;

export async function prepareDispatchEvidenceForOrder(
  client: SupabaseClient,
  params: {
    orderId: string;
    evidenceSlices: EvidenceSlice[];
    scan: ReadinessScanSlice;
    refs: GoldenChainEvidenceRefs;
    readinessBundle: DispatchReadinessBundle;
    ctx: DispatchReadinessWriteContext;
  },
): Promise<PrepareDispatchEvidenceResult> {
  const { orderId, evidenceSlices, scan, refs, readinessBundle, ctx } = params;
  const service = readinessBundle.service;
  if (!service) {
    throw new Error("Dispatch check service is unavailable.");
  }

  const added: string[] = [];
  const skipped: string[] = [];
  const scanRecorded: string[] = [];

  const evidenceBase = {
    orderId,
    queueItemId: null,
    evidenceStatus: "verified" as const,
    actorId: null,
    actorRole: null,
    actorDepartment: null,
    correlationId: ctx.correlationId,
    metadata: { source: "golden_chain_operator_wizard", governedOnly: true },
  };

  if (!hasVerifiedReadinessEvidence(evidenceSlices, "packing_photo")) {
    await service.addEvidence(
      {
        ...evidenceBase,
        evidenceType: "packing_photo",
        evidenceRef: refs.packingPhotoRef,
        photoRef: refs.packingPhotoRef,
        documentRef: null,
        barcodeRef: null,
      },
      ctx,
    );
    added.push("packing_photo");
  } else {
    skipped.push("packing_photo");
  }

  if (!hasVerifiedReadinessEvidence(evidenceSlices, "document_placeholder")) {
    await service.addEvidence(
      {
        ...evidenceBase,
        evidenceType: "document_placeholder",
        evidenceRef: refs.documentPlaceholderRef,
        photoRef: null,
        documentRef: refs.documentPlaceholderRef,
        barcodeRef: null,
      },
      ctx,
    );
    added.push("document_placeholder");
  } else {
    skipped.push("document_placeholder");
  }

  if (!hasVerifiedReadinessEvidence(evidenceSlices, "gate_scan")) {
    await service.addEvidence(
      {
        ...evidenceBase,
        evidenceType: "gate_scan",
        evidenceRef: refs.gateScanRef,
        photoRef: null,
        documentRef: null,
        barcodeRef: refs.gateScanRef,
      },
      ctx,
    );
    added.push("gate_scan");
  } else {
    skipped.push("gate_scan");
  }

  const scanCtx = {
    correlationId: ctx.correlationId,
    actorUserId: ctx.actorUserId,
    actorRole: ctx.actorRole,
  };

  if (!scan.gateScanVerified) {
    await recordVerifiedScanForStockFinalization(
      client,
      { orderId, barcodeValue: refs.gateScanRef, scanType: "dispatch_gate" },
      scanCtx,
    );
    scanRecorded.push("dispatch_gate");
  } else {
    skipped.push("operational_dispatch_gate");
  }

  const cartonBarcode = refs.gateScanRef.startsWith("GATE-")
    ? refs.gateScanRef.replace(/^GATE-/, "CTN-")
    : `CTN-${refs.gateScanRef}`;

  if (!scan.cartonBarcodeVerified) {
    await recordVerifiedScanForStockFinalization(
      client,
      { orderId, barcodeValue: cartonBarcode, scanType: "carton" },
      scanCtx,
    );
    scanRecorded.push("carton");
  } else {
    skipped.push("operational_carton");
  }

  return { added, skipped, scanRecorded };
}
