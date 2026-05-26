import { assertDispatchAuthority } from "@/lib/dispatch-authority/dispatchAuthorityGuard";
import {
  buildDispatchOperationalEvent,
  eventTypeForReadinessReview,
  readinessReviewMessage,
} from "./dispatchReadinessEventBridge";
import { projectDispatchReadiness } from "./dispatchReadinessProjection";
import type { DispatchEvidenceStore } from "./inMemoryDispatchEvidenceStore";
import type {
  DispatchEvidenceRecord,
  DispatchOperationalEventRecord,
  DispatchReadinessInput,
  DispatchReadinessProjection,
  DispatchReadinessWriteContext,
  DispatchExceptionType,
} from "./dispatchReadinessTypes";
import { DispatchReadinessError } from "./dispatchReadinessTypes";
import { observeFinanceDispatchSignal } from "./financeDispatchSignal";

export interface DispatchReadinessServiceDeps {
  evidence: DispatchEvidenceStore;
  events: DispatchEventSink;
}

export interface DispatchEventSink {
  append(event: DispatchOperationalEventRecord): Promise<DispatchOperationalEventRecord>;
  listByOrder(orderId: string): Promise<DispatchOperationalEventRecord[]>;
}

export function createInMemoryDispatchEventSink(): DispatchEventSink {
  const events: DispatchOperationalEventRecord[] = [];
  return {
    async append(event) {
      events.push(event);
      return event;
    },
    async listByOrder(orderId) {
      return events.filter((e) => e.orderId === orderId);
    },
  };
}

export function createDispatchReadinessService(deps: DispatchReadinessServiceDeps) {
  const { evidence, events } = deps;

  return {
    projectReadiness(input: DispatchReadinessInput): DispatchReadinessProjection {
      return projectDispatchReadiness(input);
    },

    async addEvidence(
      row: Omit<DispatchEvidenceRecord, "id" | "createdAt">,
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ evidence: DispatchEvidenceRecord; eventId: string }> {
      const auth = assertDispatchAuthority("dispatch:evidence_add", ctx);
      if (!auth.allowed) throw new DispatchReadinessError("authority_denied", auth.reason);

      const record = await evidence.insertEvidence({
        ...row,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        correlationId: ctx.correlationId,
      });

      const evt = await events.append(
        buildDispatchOperationalEvent(
          "dispatch_evidence_added",
          row.orderId,
          ctx,
          `Evidence added: ${row.evidenceType}`,
          `Status ${row.evidenceStatus}`,
        ),
      );
      return { evidence: record, eventId: evt.id };
    },

    async rejectEvidence(
      orderId: string,
      evidenceType: DispatchEvidenceRecord["evidenceType"],
      reason: string,
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ evidence: DispatchEvidenceRecord; eventId: string }> {
      const auth = assertDispatchAuthority("dispatch:evidence_reject", ctx);
      if (!auth.allowed) throw new DispatchReadinessError("authority_denied", auth.reason);

      const record = await evidence.insertEvidence({
        orderId,
        queueItemId: null,
        evidenceType,
        evidenceStatus: "rejected",
        evidenceRef: reason,
        photoRef: null,
        documentRef: null,
        barcodeRef: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        correlationId: ctx.correlationId,
        metadata: { rejectionReason: reason },
      });

      const evt = await events.append(
        buildDispatchOperationalEvent(
          "dispatch_evidence_rejected",
          orderId,
          ctx,
          `Evidence rejected: ${evidenceType}`,
          reason,
        ),
      );
      return { evidence: record, eventId: evt.id };
    },

    async reviewReadiness(
      input: DispatchReadinessInput,
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ projection: DispatchReadinessProjection; eventId: string }> {
      const auth = assertDispatchAuthority("dispatch:readiness_review", ctx);
      if (!auth.allowed) throw new DispatchReadinessError("authority_denied", auth.reason);

      const projection = projectDispatchReadiness(input);
      const eventType = eventTypeForReadinessReview(projection);
      const evt = await events.append(
        buildDispatchOperationalEvent(
          eventType,
          input.orderId,
          ctx,
          "Dispatch readiness reviewed",
          readinessReviewMessage(projection),
        ),
      );
      return { projection, eventId: evt.id };
    },

    async gateCheck(
      input: DispatchReadinessInput,
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ projection: DispatchReadinessProjection; eventId: string }> {
      const auth = assertDispatchAuthority("dispatch:gate_check", ctx);
      if (!auth.allowed) throw new DispatchReadinessError("authority_denied", auth.reason);

      const projection = projectDispatchReadiness(input);
      const evt = await events.append(
        buildDispatchOperationalEvent(
          projection.gateEligibility === "eligible_pending_review"
            ? "dispatch_gate_eligible"
            : "dispatch_readiness_reviewed",
          input.orderId,
          ctx,
          "Gate check recorded",
          readinessReviewMessage(projection),
        ),
      );
      return { projection, eventId: evt.id };
    },

    async createException(
      orderId: string,
      exceptionType: DispatchExceptionType,
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ eventId: string }> {
      const auth = assertDispatchAuthority("dispatch:exception_create", ctx);
      if (!auth.allowed) throw new DispatchReadinessError("authority_denied", auth.reason);

      const evt = await events.append(
        buildDispatchOperationalEvent(
          "dispatch_exception_created",
          orderId,
          ctx,
          `Exception: ${exceptionType}`,
          "Queue/event only — no dispatch mutation",
        ),
      );
      return { eventId: evt.id };
    },

    async clearException(
      orderId: string,
      exceptionType: DispatchExceptionType,
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ eventId: string }> {
      const auth = assertDispatchAuthority("dispatch:exception_clear", ctx);
      if (!auth.allowed) throw new DispatchReadinessError("authority_denied", auth.reason);

      const evt = await events.append(
        buildDispatchOperationalEvent(
          "dispatch_exception_cleared",
          orderId,
          ctx,
          `Exception cleared: ${exceptionType}`,
          "No dispatch completion performed",
        ),
      );
      return { eventId: evt.id };
    },

    async observeFinanceSignal(
      orderId: string,
      signal: DispatchReadinessInput["financeSignal"],
      ctx: DispatchReadinessWriteContext,
    ): Promise<{ eventId: string }> {
      const observed = observeFinanceDispatchSignal(orderId, signal);
      const evt = await events.append(
        buildDispatchOperationalEvent(
          "dispatch_finance_signal_observed",
          orderId,
          ctx,
          "Finance dispatch signal observed",
          `Signal ${observed.signal} (read-only)`,
        ),
      );
      return { eventId: evt.id };
    },

    listEvidence: evidence.listByOrder.bind(evidence),
    listEvents: events.listByOrder.bind(events),
  };
}

export type DispatchReadinessService = ReturnType<typeof createDispatchReadinessService>;
