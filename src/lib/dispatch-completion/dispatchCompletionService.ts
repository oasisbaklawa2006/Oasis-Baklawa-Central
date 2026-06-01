import {
  assertDispatchCompletionAuthority,
  isForbiddenCompletionAction,
} from "@/lib/dispatch-completion-authority/dispatchCompletionAuthorityGuard";
import {
  buildDispatchCompletionOperationalEvent,
  completionReviewMessage,
} from "./dispatchCompletionEventBridge";
import { requireAttestationReason } from "./dispatchCompletionEvidence";
import type { DispatchCompletionEvidenceStore } from "./inMemoryDispatchCompletionEvidenceStore";
import { projectDispatchCompletion } from "./dispatchCompletionProjection";
import type {
  DispatchCompletionEvidenceRecord,
  DispatchCompletionHoldType,
  DispatchCompletionInput,
  DispatchCompletionOperationalEventRecord,
  DispatchCompletionProjection,
  DispatchCompletionWriteContext,
} from "./dispatchCompletionTypes";
import { DispatchCompletionError } from "./dispatchCompletionTypes";

export interface DispatchCompletionEventSink {
  append(event: DispatchCompletionOperationalEventRecord): Promise<DispatchCompletionOperationalEventRecord>;
  listByOrder(orderId: string): Promise<DispatchCompletionOperationalEventRecord[]>;
}

export function createInMemoryDispatchCompletionEventSink(): DispatchCompletionEventSink {
  const events: DispatchCompletionOperationalEventRecord[] = [];
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

export interface DispatchCompletionServiceDeps {
  evidence: DispatchCompletionEvidenceStore;
  events: DispatchCompletionEventSink;
}

export function createDispatchCompletionService(deps: DispatchCompletionServiceDeps) {
  const { evidence, events } = deps;

  function guard(action: string, ctx: DispatchCompletionWriteContext) {
    if (isForbiddenCompletionAction(action)) {
      throw new DispatchCompletionError("forbidden_action", `Forbidden: ${action}`);
    }
    const auth = assertDispatchCompletionAuthority(action, ctx);
    if (!auth.allowed) throw new DispatchCompletionError("authority_denied", auth.reason);
  }

  function assertEligibleForAttestation(projection: DispatchCompletionProjection) {
    if (projection.completionStatus === "already_dispatched") {
      throw new DispatchCompletionError("not_eligible", "Order already dispatched");
    }
    if (projection.completionStatus !== "completion_eligible") {
      throw new DispatchCompletionError(
        "not_eligible",
        `Cannot attest when status is ${projection.completionStatus}`,
      );
    }
  }

  return {
    projectCompletion(input: DispatchCompletionInput): DispatchCompletionProjection {
      return projectDispatchCompletion(input);
    },

    async reviewCompletion(
      input: DispatchCompletionInput,
      ctx: DispatchCompletionWriteContext,
    ): Promise<{ projection: DispatchCompletionProjection; eventId: string; evidenceId: string }> {
      guard("dispatch:completion_review", ctx);
      const projection = projectDispatchCompletion(input);

      const record = await evidence.insertEvidence({
        orderId: input.orderId,
        queueItemId: input.queueItemId,
        evidenceType: "completion_review",
        evidenceStatus: "verified",
        completionStatus: projection.completionStatus,
        evidenceRef: completionReviewMessage(projection),
        courierRef: null,
        manifestRef: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: ctx.overrideReason ?? null,
        correlationId: ctx.correlationId,
        metadata: { readinessStatus: input.readinessStatus, financeSignal: input.financeSignal },
      });

      const evt = await events.append(
        buildDispatchCompletionOperationalEvent(
          "dispatch_completion_reviewed",
          input.orderId,
          ctx,
          "Dispatch completion reviewed",
          completionReviewMessage(projection),
        ),
      );

      return { projection, eventId: evt.id, evidenceId: record.id };
    },

    async attestCompletion(
      input: DispatchCompletionInput,
      ctx: DispatchCompletionWriteContext,
    ): Promise<{
      projection: DispatchCompletionProjection;
      eventId: string;
      evidence: DispatchCompletionEvidenceRecord;
    }> {
      guard("dispatch:attest_completion", ctx);
      const prior = await evidence.listByOrder(input.orderId);
      if (
        prior.some(
          (row) =>
            row.evidenceType === "completion_attestation" && row.evidenceStatus === "verified",
        )
      ) {
        throw new DispatchCompletionError("not_eligible", "Completion already attested");
      }
      const projection = projectDispatchCompletion(input);
      assertEligibleForAttestation(projection);
      const reason = requireAttestationReason(ctx.attestationReason);

      const record = await evidence.insertEvidence({
        orderId: input.orderId,
        queueItemId: input.queueItemId,
        evidenceType: "completion_attestation",
        evidenceStatus: "verified",
        completionStatus: "completion_attested",
        evidenceRef: reason,
        courierRef: input.courierManifestAttached ? "manifest-on-file" : null,
        manifestRef: input.securityGatePassed ? "gate-cleared" : null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: ctx.overrideReason ?? null,
        correlationId: ctx.correlationId,
        metadata: { attestationReason: reason, governedOnly: true },
      });

      const attestedProjection: DispatchCompletionProjection = {
        ...projection,
        completionStatus: "completion_attested",
        completionRecommendation:
          "Attestation recorded — no order.status or stock mutation performed",
      };

      const evt = await events.append(
        buildDispatchCompletionOperationalEvent(
          "dispatch_completion_attested",
          input.orderId,
          ctx,
          "Dispatch completion attested (governance)",
          reason,
        ),
      );

      return { projection: attestedProjection, eventId: evt.id, evidence: record };
    },

    async placeCompletionHold(
      orderId: string,
      holdType: DispatchCompletionHoldType,
      ctx: DispatchCompletionWriteContext,
    ): Promise<{ eventId: string }> {
      guard("dispatch:place_completion_hold", ctx);
      await evidence.insertEvidence({
        orderId,
        queueItemId: null,
        evidenceType: "completion_hold",
        evidenceStatus: "blocked",
        completionStatus: "completion_blocked",
        evidenceRef: holdType,
        courierRef: null,
        manifestRef: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: null,
        correlationId: ctx.correlationId,
        metadata: { holdType },
      });

      const evt = await events.append(
        buildDispatchCompletionOperationalEvent(
          "dispatch_completion_hold_placed",
          orderId,
          ctx,
          `Completion hold: ${holdType}`,
          "Append-only — no dispatch mutation",
        ),
      );
      return { eventId: evt.id };
    },

    async releaseCompletionHold(
      orderId: string,
      holdType: DispatchCompletionHoldType,
      ctx: DispatchCompletionWriteContext,
    ): Promise<{ eventId: string }> {
      guard("dispatch:release_completion_hold", ctx);
      await evidence.insertEvidence({
        orderId,
        queueItemId: null,
        evidenceType: "completion_hold_release",
        evidenceStatus: "released",
        completionStatus: "prerequisites_pending",
        evidenceRef: holdType,
        courierRef: null,
        manifestRef: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: null,
        correlationId: ctx.correlationId,
        metadata: { holdType },
      });

      const evt = await events.append(
        buildDispatchCompletionOperationalEvent(
          "dispatch_completion_hold_released",
          orderId,
          ctx,
          `Completion hold released: ${holdType}`,
          "No order status mutation",
        ),
      );
      return { eventId: evt.id };
    },

    async listEvents(orderId: string) {
      return events.listByOrder(orderId);
    },
  };
}

export type DispatchCompletionService = ReturnType<typeof createDispatchCompletionService>;
