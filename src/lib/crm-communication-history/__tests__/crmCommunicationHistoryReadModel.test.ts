import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchCrmCommunicationHistory } from "../crmCommunicationHistoryReadModel";
import { buildCrmCommunicationChannelGovernance } from "../crmCommunicationHistoryNormalizer";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

function createQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe("fetchCrmCommunicationHistory", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "client_interactions") {
        return createQuery({
          data: [
            {
              id: "ci-1",
              company_id: VALID_UUID,
              executive_id: "exec-1",
              interaction_type: "call",
              notes: "Follow-up call",
              outcome: null,
              follow_up_date: "2026-04-01",
              created_at: "2026-03-01T10:00:00.000Z",
            },
          ],
          error: null,
        }) as never;
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("returns company-scoped normalized ledger from client_interactions", async () => {
    const model = await fetchCrmCommunicationHistory(VALID_UUID, {
      viewerCompanyId: null,
      isStorefrontViewer: false,
    });

    expect(model.companyId).toBe(VALID_UUID);
    expect(model.entries).toHaveLength(1);
    expect(model.entries[0]?.channel).toBe("call");
    expect(model.entries[0]?.source.authority).toBe("client_interactions");
  });

  it("blocks cross-company storefront access", async () => {
    await expect(
      fetchCrmCommunicationHistory(VALID_UUID, {
        viewerCompanyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        isStorefrontViewer: true,
      }),
    ).rejects.toThrow(/Cross-company/);
  });

  it("exposes partial email intent-only channel governance", () => {
    const channels = buildCrmCommunicationChannelGovernance();
    const email = channels.find((c) => c.channel === "email");
    expect(email?.availability).toBe("partial");
    const whatsapp = channels.find((c) => c.channel === "whatsapp");
    expect(whatsapp?.availability).toBe("partial");
  });
});
