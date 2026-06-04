import { beforeEach, describe, expect, it, vi } from "vitest";

const { linesResult, auditResult, fromMock, rpcMock } = vi.hoisted(() => ({
  linesResult: {
    data: null as unknown[] | null,
    error: null as { message: string } | null,
  },
  auditResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  fromMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
    rpc: rpcMock,
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

describe("createSalesOrderDraft atomicity", () => {
  it("does not leave partial header insert path on line failure (static)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const createStart = repo.indexOf("export async function createSalesOrderDraft");
    const createEnd = repo.indexOf("export async function submitSalesOrderDraftForReview");
    const createBlock = repo.slice(createStart, createEnd);
    expect(createBlock).toMatch(/rpc\("create_sales_order_draft_atomic"/);
    expect(createBlock).not.toMatch(/from\("sales_order_drafts"\)\s*\n\s*\.insert/);
    expect(createBlock).not.toMatch(/from\("sales_order_draft_lines"\)\s*\n\s*\.insert/);
  });

  it("reloads created draft by RPC id and returns existing on retry (static)", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const createStart = repo.indexOf("export async function createSalesOrderDraft");
    const createEnd = repo.indexOf("export async function submitSalesOrderDraftForReview");
    const createBlock = repo.slice(createStart, createEnd);
    expect(createBlock).toMatch(/fetchSalesOrderDraftById\(draftId\)/);
    expect(createBlock).toMatch(/return existing;/);
    expect(createBlock).toMatch(/Active sales order draft already exists/);
  });
});

describe("submitForReview operator sync (static)", () => {
  it("persists latest operator quantities before submit transition", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const submitStart = hook.indexOf("const submitForReview = useCallback");
    expect(submitStart).toBeGreaterThan(-1);
    const submitBlock = hook.slice(submitStart, submitStart + 900);
    expect(submitBlock).toMatch(/resolveLatestOperatorLineQuantities/);
    expect(submitBlock).toMatch(/updateSalesOrderDraftOperatorFinal/);
    expect(submitBlock).toMatch(/submitSalesOrderDraftForReview/);
    expect(submitBlock.indexOf("updateSalesOrderDraftOperatorFinal")).toBeLessThan(
      submitBlock.indexOf("submitSalesOrderDraftForReview"),
    );
  });

  it("persists latest operator quantities before approve transition", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const approveStart = hook.indexOf("const approveDraft = useCallback");
    expect(approveStart).toBeGreaterThan(-1);
    const approveBlock = hook.slice(approveStart, approveStart + 900);
    expect(approveBlock).toMatch(/resolveLatestOperatorLineQuantities/);
    expect(approveBlock).toMatch(/updateSalesOrderDraftOperatorFinal/);
    expect(approveBlock).toMatch(/approveSalesOrderDraft/);
    expect(approveBlock.indexOf("updateSalesOrderDraftOperatorFinal")).toBeLessThan(
      approveBlock.indexOf("approveSalesOrderDraft"),
    );
  });
});

describe("persisted draft fetch and rejected recreate UI (static)", () => {
  it("enables draft fetch by packetId rather than extraction readiness", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const inbox = readFileSync(
      join(import.meta.dirname, "../../../components/WhatsAppInbox.tsx"),
      "utf8",
    );
    const hookStart = inbox.indexOf("useOperatorInboxSalesOrderDraft({");
    expect(hookStart).toBeGreaterThan(-1);
    const hookBlock = inbox.slice(hookStart, hookStart + 500);
    expect(hookBlock).toMatch(/enabled:\s*Boolean\(selectedPacket\?\.id\)/);
    expect(hookBlock).not.toMatch(/enabled:\s*draftOrderExtractionState\.status === "ready"/);
  });

  it("shows persisted draft without requiring extractionReady", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    expect(section).not.toMatch(/if \(!extractionReady\) return null/);
    expect(section).toMatch(/Loading persisted draft/);
  });

  it("shows Create New Draft when latest bundle is REJECTED", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    expect(section).toMatch(/isRejected/);
    expect(section).toMatch(/Create New Draft/);
    expect(section).toMatch(/bundle\?\.draft\.status === "REJECTED"/);
  });

  it("RPC migrations verify actor id matches auth.uid()", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const file of [
      "20260606120000_wa_sprint9_sales_order_draft_transition_rpc.sql",
      "20260606130000_wa_sprint9_sales_order_draft_create_atomic_rpc.sql",
    ]) {
      const sql = readFileSync(join(import.meta.dirname, "../../../../supabase/migrations", file), "utf8");
      expect(sql).toMatch(/p_actor_id IS DISTINCT FROM auth\.uid\(\)/);
    }
  });

  it("preserves bundle on reload error and disables sync without extraction", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    expect(hook).toMatch(/bundle: prev\.status === "ready" \? prev\.bundle : null/);
    expect(hook).toMatch(/Draft extraction must be ready before syncing operator edits/);
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    expect(section).toMatch(/state\.status === "error"/);
    expect(section).toMatch(/disabled=\{actionPending \|\| !extracted\}/);
  });
});
