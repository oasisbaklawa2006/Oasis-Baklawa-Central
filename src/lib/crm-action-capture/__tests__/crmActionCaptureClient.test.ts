import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/integrations/supabase/types";
import {
  captureCrmManualAction,
  insertGovernedCapture,
  type CrmActionCaptureDeps,
} from "../crmActionCaptureClient";
import { captureEmailIntent, captureWhatsAppProviderSend } from "../crmActionCaptureChannels";

type ClientInteractionRow = Database["public"]["Tables"]["client_interactions"]["Row"];

const COMPANY_ID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";
const EXEC_ID = "e1e1e1e1-e1e1-41e1-81e1-e1e1e1e1e1e1";

function mockDeps(existing: ClientInteractionRow | null = null): CrmActionCaptureDeps {
  const inserted: Record<string, unknown>[] = [];
  return {
    findByIdempotency: vi.fn(async () => existing),
    insertInteraction: vi.fn(async (row) => {
      inserted.push(row);
      return {
        data: {
          id: "ci-new",
          company_id: row.company_id,
          executive_id: row.executive_id,
          interaction_type: row.interaction_type,
          notes: row.notes,
          outcome: row.outcome,
          follow_up_date: row.follow_up_date,
          created_at: "2026-03-01T00:00:00.000Z",
        },
        error: null,
      };
    }),
  };
}

describe("crmActionCaptureClient", () => {
  it("deduplicates on idempotency key", async () => {
    const deps = mockDeps({
      id: "ci-existing",
      company_id: COMPANY_ID,
      executive_id: EXEC_ID,
      interaction_type: "call",
      notes: "[P62|channel=call|source=manual|delivery=not_applicable|idem=idem-dup] hello",
      outcome: null,
      follow_up_date: null,
      created_at: "2026-03-01T00:00:00.000Z",
    } as ClientInteractionRow);

    const result = await captureCrmManualAction(
      {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        channel: "call",
        notes: "hello",
        idempotencyKey: "idem-dup",
      },
      deps,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deduplicated).toBe(true);
      expect(result.recordId).toBe("ci-existing");
    }
    expect(deps.insertInteraction).not.toHaveBeenCalled();
  });

  it("persists manual capture when idempotency key is new", async () => {
    const deps = mockDeps();
    const result = await captureCrmManualAction(
      {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        channel: "note",
        notes: "Pricing discussion",
      },
      deps,
    );
    expect(result.ok).toBe(true);
    expect(deps.insertInteraction).toHaveBeenCalledOnce();
  });

  it("records email intent only without provider send", async () => {
    const deps = mockDeps();
    const result = await captureEmailIntent(
      {
        companyId: COMPANY_ID,
        executiveId: EXEC_ID,
        subject: "Quote",
        body: "Please review",
      },
      deps,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deliveryState).toBe("intent_only");
    }
  });

  it("fails closed when WhatsApp provider send fails", async () => {
    const result = await captureWhatsAppProviderSend({
      companyId: COMPANY_ID,
      executiveId: EXEC_ID,
      to: "919999999999",
      message: "Hello",
      sendProvider: async () => ({ success: false, error: "provider down" }),
    });
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.failure).toBe("provider_unavailable");
    }
  });

  it("delegates WhatsApp success to provider without inventing delivered state", async () => {
    const sendProvider = vi.fn(async () => ({ success: true, data: { messageId: "m1" } }));
    const result = await captureWhatsAppProviderSend({
      companyId: COMPANY_ID,
      executiveId: EXEC_ID,
      to: "919999999999",
      message: "Hello",
      sendProvider,
    });
    expect(sendProvider).toHaveBeenCalledOnce();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deliveryState).toBe("pending_provider");
      expect(result.recordId).toBe("provider:send-whatsapp");
    }
  });

  it("insertGovernedCapture surfaces insert failures", async () => {
    const deps: CrmActionCaptureDeps = {
      findByIdempotency: async () => null,
      insertInteraction: async () => ({ data: null, error: { message: "RLS denied" } }),
    };
    const result = await insertGovernedCapture(
      {
        input: {
          companyId: COMPANY_ID,
          executiveId: EXEC_ID,
          channel: "call",
          notes: "test",
        },
        deliveryState: "not_applicable",
        source: "manual",
        idempotencyKey: "k1",
      },
      deps,
    );
    expect(result.ok).toBe(false);
  });
});
