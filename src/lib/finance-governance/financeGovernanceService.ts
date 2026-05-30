import { assertFinanceAuthority, isForbiddenFinanceAction } from "@/lib/finance-authority/financeAuthorityGuard";
import { validateCommercialReleaseAttempt, validateRejection } from "./financeApprovalWorkflow";
import {
  buildFinanceOperationalEvent,
  commercialReleaseEventMessage,
} from "./financeEventBridge";
import { requireOverrideReason } from "./financeEvidenceModel";
import { assertOverrideContext } from "./financeOverrideRules";
import { FINANCE_HOLD_LABELS, detectFinanceHolds } from "./financeHoldRules";
import { projectFinanceRelease } from "./financeReleaseEligibility";
import type { FinanceEvidenceStore } from "./inMemoryFinanceEvidenceStore";
import type {
  FinanceEvidenceRecord,
  FinanceGovernanceInput,
  FinanceGovernanceWriteContext,
  FinanceHoldType,
  FinanceOperationalEventRecord,
} from "./financeGovernanceTypes";
import { FinanceGovernanceError } from "./financeGovernanceTypes";

export interface FinanceEventSink {
  append(event: FinanceOperationalEventRecord): Promise<FinanceOperationalEventRecord>;
  listByOrder(orderId: string): Promise<FinanceOperationalEventRecord[]>;
}

export function createInMemoryFinanceEventSink(): FinanceEventSink {
  const events: FinanceOperationalEventRecord[] = [];
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

export interface FinanceGovernanceServiceDeps {
  evidence: FinanceEvidenceStore;
  events: FinanceEventSink;
}

export function createFinanceGovernanceService(deps: FinanceGovernanceServiceDeps) {
  const { evidence, events } = deps;

  function guard(action: string, ctx: FinanceGovernanceWriteContext) {
    if (isForbiddenFinanceAction(action)) {
      throw new FinanceGovernanceError("forbidden_action", `Forbidden: ${action}`);
    }
    const auth = assertFinanceAuthority(action, ctx);
    if (!auth.allowed) throw new FinanceGovernanceError("authority_denied", auth.reason);
    if (action === "finance:override_review") {
      assertOverrideContext(ctx, ctx.actorRole);
    }
  }

  return {
    projectRelease(input: FinanceGovernanceInput) {
      return projectFinanceRelease(input);
    },

    async startReview(
      input: FinanceGovernanceInput,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ projection: ReturnType<typeof projectFinanceRelease>; eventId: string; evidenceId: string }> {
      guard("finance:review", ctx);
      const projection = projectFinanceRelease(input);
      const record = await evidence.insertEvidence({
        orderId: input.orderId,
        reviewType: "credit_review",
        reviewStatus: "pending",
        evidenceType: "credit_review",
        evidenceRef: projection.releaseStatus,
        utrRef: null,
        amount: input.orderValue,
        currency: "INR",
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: ctx.overrideReason ?? null,
        correlationId: ctx.correlationId,
        metadata: {
          risk: projection.commercialRiskLevel,
          dispatchReadinessGateEligible: input.dispatchReadinessGateEligible,
          recommendation: projection.releaseRecommendation,
        },
      });
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_review_started",
          input.orderId,
          ctx,
          "Finance review started",
          projection.releaseRecommendation,
        ),
      );
      return { projection, eventId: evt.id, evidenceId: record.id };
    },

    async verifyAdvance(
      input: FinanceGovernanceInput,
      evidenceRow: Omit<FinanceEvidenceRecord, "id" | "createdAt">,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ record: FinanceEvidenceRecord; eventId: string }> {
      guard("finance:verify_advance", ctx);
      const record = await evidence.insertEvidence({
        ...evidenceRow,
        orderId: input.orderId,
        reviewType: "advance_verification",
        reviewStatus: "verified",
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        correlationId: ctx.correlationId,
      });
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_advance_verified",
          input.orderId,
          ctx,
          "Advance verified",
          evidenceRow.evidenceRef ?? "UTR/evidence on file",
        ),
      );
      return { record, eventId: evt.id };
    },

    async placeHold(
      orderId: string,
      holdType: FinanceHoldType,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ eventId: string }> {
      guard("finance:place_hold", ctx);
      await evidence.insertEvidence({
        orderId,
        reviewType: "finance_hold",
        reviewStatus: "blocked",
        evidenceType: holdType,
        evidenceRef: FINANCE_HOLD_LABELS[holdType],
        utrRef: null,
        amount: null,
        currency: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: null,
        correlationId: ctx.correlationId,
        metadata: { holdType },
      });
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_hold_created",
          orderId,
          ctx,
          `Hold: ${holdType}`,
          FINANCE_HOLD_LABELS[holdType],
        ),
      );
      return { eventId: evt.id };
    },

    async releaseHold(
      orderId: string,
      holdType: FinanceHoldType,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ eventId: string }> {
      guard("finance:release_hold", ctx);
      await evidence.insertEvidence({
        orderId,
        reviewType: "finance_hold",
        reviewStatus: "released",
        evidenceType: holdType,
        evidenceRef: "hold_released",
        utrRef: null,
        amount: null,
        currency: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: null,
        correlationId: ctx.correlationId,
        metadata: { holdType },
      });
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_hold_released",
          orderId,
          ctx,
          `Hold released: ${holdType}`,
          "No dispatch mutation",
        ),
      );
      return { eventId: evt.id };
    },

    async commercialRelease(
      input: FinanceGovernanceInput,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ projection: ReturnType<typeof projectFinanceRelease>; eventId: string }> {
      guard("finance:commercial_release", ctx);
      const check = validateCommercialReleaseAttempt(input, ctx);
      if (!check.allowed) {
        throw new FinanceGovernanceError("validation_failed", check.reason);
      }
      const projection = projectFinanceRelease(input);
      await evidence.insertEvidence({
        orderId: input.orderId,
        reviewType: "commercial_release",
        reviewStatus: "released",
        evidenceType: "commercial_release",
        evidenceRef: projection.releaseStatus,
        utrRef: null,
        amount: input.orderValue,
        currency: "INR",
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: ctx.overrideReason ?? null,
        correlationId: ctx.correlationId,
        metadata: { risk: projection.commercialRiskLevel },
      });
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_commercially_released",
          input.orderId,
          ctx,
          "Commercially released",
          commercialReleaseEventMessage(projection),
        ),
      );
      return { projection, eventId: evt.id };
    },

    async rejectRelease(
      input: FinanceGovernanceInput,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ eventId: string }> {
      guard("finance:reject_release", ctx);
      validateRejection(ctx);
      await evidence.insertEvidence({
        orderId: input.orderId,
        reviewType: "commercial_release",
        reviewStatus: "rejected",
        evidenceType: "rejection",
        evidenceRef: ctx.rejectionReason ?? null,
        utrRef: null,
        amount: null,
        currency: null,
        actorId: ctx.actorUserId,
        actorRole: ctx.actorRole,
        actorDepartment: ctx.actorDepartment ?? null,
        overrideReason: null,
        correlationId: ctx.correlationId,
        metadata: {},
      });
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_release_rejected",
          input.orderId,
          ctx,
          "Commercial release rejected",
          ctx.rejectionReason ?? "",
        ),
      );
      return { eventId: evt.id };
    },

    async applyOverride(
      input: FinanceGovernanceInput,
      ctx: FinanceGovernanceWriteContext,
    ): Promise<{ eventId: string }> {
      guard("finance:override_review", ctx);
      requireOverrideReason(ctx.overrideReason);
      const holds = detectFinanceHolds(input);
      const evt = await events.append(
        buildFinanceOperationalEvent(
          "finance_override_applied",
          input.orderId,
          ctx,
          "Finance override applied",
          `${ctx.overrideReason} · holds: ${holds.join(", ") || "none"}`,
        ),
      );
      if (projectFinanceRelease(input).commercialRiskLevel === "critical") {
        await events.append(
          buildFinanceOperationalEvent(
            "finance_risk_escalated",
            input.orderId,
            ctx,
            "Risk escalated",
            "Critical commercial risk — manual CMD review",
          ),
        );
      }
      return { eventId: evt.id };
    },

    listEvidence: evidence.listByOrder.bind(evidence),
    listEvents: events.listByOrder.bind(events),
  };
}

export type FinanceGovernanceService = ReturnType<typeof createFinanceGovernanceService>;
