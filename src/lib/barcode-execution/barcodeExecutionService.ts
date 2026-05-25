import type { OperationalEventRepository } from "@/lib/operational-events/operationalEventRepository";
import { assertSafeEventMetadata } from "@/lib/operational-events/eventVisibility";
import type {
  BaseScanVerifyInput,
  ScanExecutionContext,
  ScanRecordResult,
  ScanType,
  ScanVerificationStatus,
  VerificationType,
} from "./barcodeExecutionTypes";
import { evaluateDepartmentHandoffScan, type DepartmentHandoffScanInput } from "./departmentHandoffVerification";
import { evaluateDispatchGateScan, type DispatchGateScanInput } from "./dispatchGateVerification";
import { detectDuplicateScan } from "./scanDuplicateDetection";
import { detectScanMismatch, requireMismatchReason } from "./scanMismatchDetection";
import { assertScanAuthority, type ScanAuthorityAction } from "./scanAuthority";
import { eventTypeForScanOutcome, severityForScanStatus } from "./scanEventBridge";
import type { ScanRepository } from "./scanRepository";

export interface RecordScanOptions {
  scanType: ScanType;
  verificationType: VerificationType;
  authorityAction: ScanAuthorityAction;
  input: BaseScanVerifyInput;
  ctx: ScanExecutionContext;
  title: string;
  extraMetadata?: Record<string, unknown>;
  requireExpected?: boolean;
}

async function appendScanEvent(
  events: OperationalEventRepository,
  params: {
    scanId: string;
    scanType: ScanType;
    status: ScanVerificationStatus;
    input: BaseScanVerifyInput;
    ctx: ScanExecutionContext;
    title: string;
    mismatchReason: string | null;
    metadata: Record<string, unknown>;
  },
): Promise<string> {
  const eventType = eventTypeForScanOutcome(params.scanType, params.status);
  const ev = await events.appendEvent({
    eventType,
    entityType: params.input.entityType,
    entityId: params.input.entityId,
    orderId: params.input.orderId ?? null,
    queueItemId: params.input.queueItemId ?? null,
    actorId: params.ctx.actorUserId,
    actorRole: params.ctx.actorRole,
    actorDepartment: params.ctx.actorDepartment,
    visibility: "internal",
    severity: severityForScanStatus(params.status),
    title: params.title,
    message: params.mismatchReason,
    reasonCode: params.status === "mismatch" ? "scan_mismatch" : null,
    reasonText: params.mismatchReason,
    metadata: assertSafeEventMetadata({
      scanId: params.scanId,
      scanType: params.scanType,
      verificationStatus: params.status,
      barcodeValue: params.input.barcodeValue,
      ...params.metadata,
    }),
    correlationId: params.ctx.correlationId,
    idempotencyKey: params.ctx.idempotencyKey
      ? `${params.ctx.idempotencyKey}:event`
      : `scan-event:${params.scanId}`,
  });
  return ev.id;
}

export function createBarcodeExecutionService(
  scans: ScanRepository,
  events: OperationalEventRepository,
) {
  async function recordScan(options: RecordScanOptions): Promise<ScanRecordResult> {
    const { scanType, verificationType, authorityAction, input, ctx, title, extraMetadata, requireExpected } =
      options;

    assertScanAuthority(authorityAction, {
      actorRole: ctx.actorRole,
      scanType,
      actorDepartment: ctx.actorDepartment,
    });

    if (!ctx.correlationId?.trim()) {
      throw new Error("scan requires correlation_id");
    }

    if (ctx.idempotencyKey) {
      const existing = await scans.findByIdempotencyKey(ctx.idempotencyKey);
      if (existing) {
        const replay = await events.findByIdempotencyKey(`${ctx.idempotencyKey}:event`);
        return {
          scanId: existing.id,
          verificationStatus: existing.verificationStatus,
          eventId: replay?.id ?? "",
          mismatchReason: existing.mismatchReason,
          duplicateOfScanId: (existing.metadata.duplicateOfScanId as string) ?? null,
        };
      }
    }

    if (requireExpected && !input.expectedBarcode?.trim()) {
      throw new Error(`${scanType} scan requires expected_barcode`);
    }

    const entityScans = await scans.listScansForEntity(input.entityType, input.entityId, 100);
    const duplicate = detectDuplicateScan({
      barcodeValue: input.barcodeValue,
      entityType: input.entityType,
      entityId: input.entityId,
      verificationType,
      recentScans: entityScans,
    });

    let verificationStatus: ScanVerificationStatus = "scanned";
    let mismatchReason: string | null = null;
    let duplicateOfScanId: string | null = null;

    if (duplicate.isDuplicate) {
      verificationStatus = "duplicate";
      duplicateOfScanId = duplicate.duplicateOfScanId;
      mismatchReason = "Duplicate scan within detection window";
    } else {
      const mismatch = detectScanMismatch({
        barcodeValue: input.barcodeValue,
        expectedBarcode: input.expectedBarcode,
      });
      if (mismatch.isMismatch) {
        verificationStatus = "mismatch";
        mismatchReason = mismatch.mismatchReason;
      } else {
        verificationStatus = "verified";
      }
    }

    const scan = await scans.insertScan({
      scan_type: scanType,
      verification_type: verificationType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      order_id: input.orderId ?? null,
      queue_item_id: input.queueItemId ?? null,
      barcode_value: input.barcodeValue,
      expected_barcode: input.expectedBarcode ?? null,
      verification_status: verificationStatus,
      mismatch_reason: mismatchReason,
      scan_source: ctx.scanSource ?? "execution_os",
      scan_device_id: ctx.scanDeviceId ?? null,
      actor_id: ctx.actorUserId,
      actor_role: ctx.actorRole,
      actor_department: ctx.actorDepartment ?? null,
      photo_evidence_url: input.photoEvidenceUrl ?? null,
      metadata: {
        ...extraMetadata,
        ...(duplicateOfScanId ? { duplicateOfScanId } : {}),
      },
      correlation_id: ctx.correlationId,
      idempotency_key: ctx.idempotencyKey ?? null,
    });

    const eventId = await appendScanEvent(events, {
      scanId: scan.id,
      scanType,
      status: verificationStatus,
      input,
      ctx,
      title,
      mismatchReason,
      metadata: { ...extraMetadata, duplicateOfScanId },
    });

    return {
      scanId: scan.id,
      verificationStatus,
      eventId,
      mismatchReason,
      duplicateOfScanId,
    };
  }

  return {
    recordScan,

    verifyOrderBarcode(input: BaseScanVerifyInput, ctx: ScanExecutionContext) {
      return recordScan({
        scanType: "order",
        verificationType: "identity_match",
        authorityAction: "scan:verify",
        input,
        ctx,
        title: "Order barcode scan",
        requireExpected: true,
      });
    },

    verifyCartonBarcode(input: BaseScanVerifyInput, ctx: ScanExecutionContext) {
      return recordScan({
        scanType: "carton",
        verificationType: "identity_match",
        authorityAction: "scan:verify",
        input,
        ctx,
        title: "Carton barcode scan",
        requireExpected: true,
      });
    },

    verifyDepartmentHandoff(input: DepartmentHandoffScanInput, ctx: ScanExecutionContext) {
      const evalResult = evaluateDepartmentHandoffScan(input);
      return recordScan({
        scanType: "department_handoff",
        verificationType: "handoff_check",
        authorityAction: "scan:handoff",
        input,
        ctx,
        title: `Handoff ${input.fromDepartment} → ${input.toDepartment}`,
        requireExpected: true,
        extraMetadata: {
          fromDepartment: input.fromDepartment,
          toDepartment: input.toDepartment,
          handoffVerified: evalResult.handoffVerified,
        },
      });
    },

    verifyReadyGoodsIntake(input: BaseScanVerifyInput, ctx: ScanExecutionContext) {
      return recordScan({
        scanType: "ready_goods_intake",
        verificationType: "intake_check",
        authorityAction: "scan:verify",
        input,
        ctx,
        title: "Ready goods intake scan",
        requireExpected: true,
      });
    },

    verifyDispatchGateScan(input: DispatchGateScanInput, ctx: ScanExecutionContext) {
      const gate = evaluateDispatchGateScan(input);
      return recordScan({
        scanType: "dispatch_gate",
        verificationType: "gate_check",
        authorityAction: "scan:gate",
        input,
        ctx,
        title: `Dispatch gate scan: ${input.gateId}`,
        requireExpected: true,
        extraMetadata: {
          gateId: input.gateId,
          allowedToProceed: gate.allowedToProceed,
        },
      });
    },

    verifyAssemblyHandoff(input: DepartmentHandoffScanInput, ctx: ScanExecutionContext) {
      const evalResult = evaluateDepartmentHandoffScan(input);
      return recordScan({
        scanType: "assembly_handoff",
        verificationType: "handoff_check",
        authorityAction: "scan:handoff",
        input,
        ctx,
        title: `Assembly handoff ${input.fromDepartment} → ${input.toDepartment}`,
        requireExpected: true,
        extraMetadata: {
          fromDepartment: input.fromDepartment,
          toDepartment: input.toDepartment,
          handoffVerified: evalResult.handoffVerified,
        },
      });
    },

    async rejectScan(
      input: BaseScanVerifyInput & {
        parentScanId?: string;
        reason: string;
        scanType?: ScanType;
      },
      ctx: ScanExecutionContext,
    ): Promise<ScanRecordResult> {
      const reason = requireMismatchReason(input.reason, "scan:reject");
      assertScanAuthority("scan:reject", { actorRole: ctx.actorRole });
      const scanType = input.scanType ?? "order";
      const scan = await scans.insertScan({
        scan_type: scanType,
        verification_type: "identity_match",
        entity_type: input.entityType,
        entity_id: input.entityId,
        order_id: input.orderId ?? null,
        queue_item_id: input.queueItemId ?? null,
        barcode_value: input.barcodeValue,
        expected_barcode: input.expectedBarcode ?? null,
        verification_status: "rejected",
        mismatch_reason: reason,
        scan_source: ctx.scanSource ?? "execution_os",
        scan_device_id: ctx.scanDeviceId ?? null,
        actor_id: ctx.actorUserId,
        actor_role: ctx.actorRole,
        actor_department: ctx.actorDepartment ?? null,
        photo_evidence_url: input.photoEvidenceUrl ?? null,
        metadata: { parentScanId: input.parentScanId ?? null, rejectReason: reason },
        correlation_id: ctx.correlationId,
        idempotency_key: ctx.idempotencyKey ?? `reject:${input.parentScanId ?? input.entityId}`,
      });
      const eventId = await appendScanEvent(events, {
        scanId: scan.id,
        scanType,
        status: "rejected",
        input,
        ctx,
        title: "Scan rejected",
        mismatchReason: reason,
        metadata: { parentScanId: input.parentScanId, rejectReason: reason },
      });
      return {
        scanId: scan.id,
        verificationStatus: "rejected",
        eventId,
        mismatchReason: reason,
        duplicateOfScanId: null,
      };
    },

    async escalateScan(
      input: BaseScanVerifyInput & { parentScanId?: string; reason: string },
      ctx: ScanExecutionContext,
    ): Promise<ScanRecordResult> {
      requireMismatchReason(input.reason, "scan:escalate");
      assertScanAuthority("scan:escalate", { actorRole: ctx.actorRole });
      const mismatch = detectScanMismatch({
        barcodeValue: input.barcodeValue,
        expectedBarcode: input.expectedBarcode,
        explicitMismatchReason: input.reason,
      });
      const scan = await scans.insertScan({
        scan_type: "order",
        verification_type: "identity_match",
        entity_type: input.entityType,
        entity_id: input.entityId,
        order_id: input.orderId ?? null,
        queue_item_id: input.queueItemId ?? null,
        barcode_value: input.barcodeValue,
        expected_barcode: input.expectedBarcode ?? null,
        verification_status: "escalated",
        mismatch_reason: mismatch.mismatchReason ?? input.reason,
        scan_source: ctx.scanSource ?? "execution_os",
        scan_device_id: ctx.scanDeviceId ?? null,
        actor_id: ctx.actorUserId,
        actor_role: ctx.actorRole,
        actor_department: ctx.actorDepartment ?? null,
        photo_evidence_url: input.photoEvidenceUrl ?? null,
        metadata: { parentScanId: input.parentScanId ?? null, escalateReason: input.reason },
        correlation_id: ctx.correlationId,
        idempotency_key: ctx.idempotencyKey ?? null,
      });
      const eventId = await appendScanEvent(events, {
        scanId: scan.id,
        scanType: "order",
        status: "escalated",
        input,
        ctx,
        title: "Scan escalated",
        mismatchReason: input.reason,
        metadata: { parentScanId: input.parentScanId },
      });
      return {
        scanId: scan.id,
        verificationStatus: "escalated",
        eventId,
        mismatchReason: input.reason,
        duplicateOfScanId: null,
      };
    },

    async attachPhotoEvidenceMetadata(
      input: BaseScanVerifyInput,
      ctx: ScanExecutionContext,
    ): Promise<ScanRecordResult> {
      if (!input.photoEvidenceUrl?.trim()) {
        throw new Error("photo_evidence_url is required");
      }
      return recordScan({
        scanType: "carton",
        verificationType: "identity_match",
        authorityAction: "scan:verify",
        input,
        ctx,
        title: "Scan with photo evidence",
        extraMetadata: { hasPhotoEvidence: true },
      });
    },
  };
}

export type BarcodeExecutionService = ReturnType<typeof createBarcodeExecutionService>;
