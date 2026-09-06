import { describe, expect, it } from "vitest";
import {
  captureCrmEmailIntent,
  captureCrmManualAction,
  captureCrmWhatsAppManualLog,
  type CrmActionCapturePersistence,
} from "../crmActionCaptureClient";
import { extractIdempotencyKeyFromNotes } from "../crmActionCaptureProvenance";

const companyId = "11111111-1111-4111-8111-111111111111";
const actor = { userId: "exec-1", role: "SALES_EXECUTIVE", isInternalStaff: false };
const binding = { companyId, accountManagerId: "exec-1" };

function createMemoryPersistence(): CrmActionCapturePersistence & { rows: Array<Record<string, unknown>> } {
  const rows: Array<Record<string, unknown>> = [];
  return {
    rows,
    async resolveCompanyBinding() {
      return binding;
    },
    async findByIdempotencyKey(_companyId, idempotencyKey) {
      const found = rows.find((row) =>
        String(row.notes ?? "").includes(`:idem:${idempotencyKey}]`),
      );
      return (found as never) ?? null;
    },
    async insertInteraction(row) {
      const persisted = {
        id: `ci-${rows.length + 1}`,
        created_at: "2026-09-06T10:00:00.000Z",
        ...row,
      };
      rows.push(persisted);
      return persisted as never;
    },
  };
}

describe("crmActionCaptureClient", () => {
  it("persists manual call capture with provenance and company binding", async () => {
    const persistence = createMemoryPersistence();
    const result = await captureCrmManualAction(persistence, actor, {
      companyId,
      channel: "call",
      notes: "Discussed dispatch timing",
      source: "central_sales_dashboard",
      idempotencyKey: "idem-call-1",
    });

    expect(result.idempotentReplay).toBe(false);
    expect(result.outcome).toBe("recorded");
    expect(persistence.rows[0]?.company_id).toBe(companyId);
    expect(extractIdempotencyKeyFromNotes(String(persistence.rows[0]?.notes))).toBe("idem-call-1");
  });

  it("replays idempotent captures without duplicate inserts", async () => {
    const persistence = createMemoryPersistence();
    const input = {
      companyId,
      channel: "note" as const,
      notes: "Follow-up note",
      source: "central_sales_interactions" as const,
      idempotencyKey: "idem-note-1",
    };
    const first = await captureCrmManualAction(persistence, actor, input);
    const second = await captureCrmManualAction(persistence, actor, input);

    expect(first.idempotentReplay).toBe(false);
    expect(second.idempotentReplay).toBe(true);
    expect(persistence.rows).toHaveLength(1);
  });

  it("records WhatsApp manual logs without claiming provider delivery", async () => {
    const persistence = createMemoryPersistence();
    const result = await captureCrmWhatsAppManualLog(persistence, actor, {
      companyId,
      notes: "Customer replied on personal thread",
      source: "central_sales_interactions",
      idempotencyKey: "idem-wa-manual",
    });

    expect(result.outcome).toBe("logged_manual");
    expect(result.providerInvoked).toBeUndefined();
  });

  it("records email intent only when provider is unavailable", async () => {
    const persistence = createMemoryPersistence();
    const result = await captureCrmEmailIntent(persistence, actor, {
      companyId,
      subject: "PI follow-up",
      bodyPreview: "Please review attached PI.",
      recipientEmail: "buyer@example.com",
      source: "central_customer360",
      idempotencyKey: "idem-email-1",
    });

    expect(result.outcome).toBe("intent_recorded");
    expect(String(persistence.rows[0]?.notes)).toContain("Intent recorded only");
    expect(persistence.rows[0]?.interaction_type).toBe("email");
  });

  it("captures promise commitments with follow-up date", async () => {
    const persistence = createMemoryPersistence();
    const result = await captureCrmManualAction(persistence, actor, {
      companyId,
      channel: "promise",
      notes: "Will confirm PO by Friday",
      followUpDate: "2026-09-12",
      source: "central_customer360",
      idempotencyKey: "idem-promise-1",
    });

    expect(result.interactionType).toBe("promise");
    expect(persistence.rows[0]?.follow_up_date).toBe("2026-09-12");
  });
});

describe("captureWhatsAppProviderSend intent/result separation", () => {
  it("never claims delivered without provider success", async () => {
    const { captureWhatsAppProviderSend } = await import("../crmActionCaptureFacade");
    const persistence = createMemoryPersistence();

    const result = await captureWhatsAppProviderSend(
      persistence,
      actor,
      {
        companyId,
        to: "+919999999999",
        message: "Test",
        source: "central_customer360",
        idempotencyKey: "idem-wa-send-1",
      },
      {
        invokeSendWhatsApp: async () => ({
          data: { success: false, error: "provider_down" },
          error: null,
        }),
      },
    );

    expect(result.providerInvoked).toBe(true);
    expect(result.outcome).toBe("failed");
    expect(result.providerSuccess).toBe(false);
    expect(persistence.rows.some((row) => String(row.notes).includes("intent"))).toBe(true);
  });
});
