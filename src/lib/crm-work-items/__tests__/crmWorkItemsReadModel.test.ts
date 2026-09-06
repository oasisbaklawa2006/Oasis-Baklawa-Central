import { describe, expect, it, vi, beforeEach } from "vitest";
import { fetchCrmWorkItems } from "../crmWorkItemsReadModel";

const VALID_UUID = "a1b2c3d4-e5f6-4789-a012-3456789abcde";

function createQuery(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
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

describe("fetchCrmWorkItems", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const { supabase } = await import("@/integrations/supabase/client");
    vi.mocked(supabase.from).mockImplementation((table: string) => {
      if (table === "crm_tasks") {
        return createQuery({
          data: [
            {
              id: "task-1",
              company_id: VALID_UUID,
              sales_exec_id: "exec-1",
              task_type: "follow_up",
              status: "pending",
              due_date: "2026-04-01",
              description: "Follow up on quote",
              completed_at: null,
              created_at: "2026-03-01T10:00:00.000Z",
            },
          ],
          error: null,
        }) as never;
      }
      if (table === "client_interactions") {
        return createQuery({
          data: [
            {
              id: "ci-1",
              company_id: VALID_UUID,
              executive_id: "exec-1",
              interaction_type: "call",
              notes: "Pricing discussion",
              follow_up_date: "2026-04-10",
              created_at: "2026-03-01T09:00:00.000Z",
            },
          ],
          error: null,
        }) as never;
      }
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("returns company-scoped open tasks and follow-up commitments", async () => {
    const model = await fetchCrmWorkItems(
      VALID_UUID,
      {
        viewerCompanyId: null,
        isStorefrontViewer: false,
      },
      { referenceDate: "2026-03-15" },
    );

    expect(model.companyId).toBe(VALID_UUID);
    expect(model.openItems).toHaveLength(1);
    expect(model.followUpCommitments).toHaveLength(1);
    expect(model.openItems[0]?.source.authority).toBe("crm_tasks");
    expect(model.followUpCommitments[0]?.kind).toBe("follow_up_commitment");
  });

  it("blocks cross-company storefront access", async () => {
    await expect(
      fetchCrmWorkItems(VALID_UUID, {
        viewerCompanyId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        isStorefrontViewer: true,
      }),
    ).rejects.toThrow(/Cross-company/);
  });
});
