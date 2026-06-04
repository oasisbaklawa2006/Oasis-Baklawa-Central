import { beforeEach, describe, expect, it, vi } from "vitest";

const { linesResult, auditResult, fromMock } = vi.hoisted(() => ({
  linesResult: {
    data: null as unknown[] | null,
    error: null as { message: string } | null,
  },
  auditResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

function chainMock(result: { data: unknown; error: { message: string } | null }) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(result),
      }),
    }),
  };
}

describe("fetchDraftLinesAndAudit", () => {
  beforeEach(() => {
    fromMock.mockReset();
    linesResult.data = [];
    linesResult.error = null;
    auditResult.data = [];
    auditResult.error = null;
  });

  it("throws when lines query fails instead of returning empty lines", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_draft_lines") {
        return chainMock({ data: null, error: { message: "lines permission denied" } });
      }
      return chainMock({ data: [], error: null });
    });

    const { fetchDraftLinesAndAudit } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );

    await expect(fetchDraftLinesAndAudit("draft-1")).rejects.toThrow("lines permission denied");
  });

  it("throws when audit query fails instead of returning empty audit log", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_draft_audit_log") {
        return chainMock({ data: null, error: { message: "audit permission denied" } });
      }
      return chainMock({ data: [], error: null });
    });

    const { fetchDraftLinesAndAudit } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );

    await expect(fetchDraftLinesAndAudit("draft-1")).rejects.toThrow("audit permission denied");
  });
});

describe("transitionDraft atomicity (static)", () => {
  it("uses RPC for status transition and does not append audit separately", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const transitionStart = repo.indexOf("async function transitionDraft");
    expect(transitionStart).toBeGreaterThan(-1);
    const transitionBlock = repo.slice(transitionStart);
    expect(transitionBlock).toMatch(/rpc\("transition_sales_order_draft_status"/);
    expect(transitionBlock).not.toMatch(/appendAuditEntry/);
    expect(transitionBlock).not.toMatch(/from\("sales_order_drafts"\)\s*\n\s*\.update/);
  });
});
