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

describe("updateSalesOrderDraftOperatorFinal atomicity", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("uses RPC only and does not manually update header, lines, or audit", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const updateStart = repo.indexOf("export async function updateSalesOrderDraftOperatorFinal");
    const updateEnd = repo.indexOf("async function fetchSalesOrderDraftById");
    const updateBlock = repo.slice(updateStart, updateEnd);
    expect(updateBlock).toMatch(/rpc\("update_sales_order_draft_operator_final"/);
    expect(updateBlock).not.toMatch(/from\("sales_order_drafts"\)\s*\n\s*\.update/);
    expect(updateBlock).not.toMatch(/from\("sales_order_draft_lines"\)\s*\n\s*\.update/);
    expect(updateBlock).not.toMatch(/appendAuditEntry/);
    expect(updateBlock).not.toMatch(/for \(const line of/);
  });

  it("throws on RPC failure without issuing separate line or audit writes", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "line 0 not found" } });

    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_drafts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      return chainMock({ data: [], error: null });
    });

    const { updateSalesOrderDraftOperatorFinal } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      updateSalesOrderDraftOperatorFinal({
        draftId: "draft-1",
        extracted: extractedFixture,
        operatorLineQuantities: { 0: 12 },
        actor: { id: "user-1", name: "Operator" },
      }),
    ).rejects.toThrow("line 0 not found");

    expect(rpcMock).toHaveBeenCalledWith(
      "update_sales_order_draft_operator_final",
      expect.objectContaining({
        p_draft_id: "draft-1",
        p_actor_id: "user-1",
      }),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);

    const updateCalls = fromMock.mock.calls.filter(
      ([table, _opts]) =>
        table === "sales_order_drafts" || table === "sales_order_draft_audit_log",
    );
    expect(updateCalls).toHaveLength(0);
  });

  it("operator final RPC migration verifies actor id matches auth.uid()", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(
        import.meta.dirname,
        "../../../../supabase/migrations/20260606140000_wa_sprint9_sales_order_draft_operator_final_rpc.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/p_actor_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(sql).toMatch(/UPDATE_OPERATOR_FINAL/);
  });
});

describe("submitForReview atomicity (static)", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("hook calls single repository method without chaining update and submit", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const submitStart = hook.indexOf("const submitForReview = useCallback");
    expect(submitStart).toBeGreaterThan(-1);
    const submitBlock = hook.slice(submitStart, submitStart + 700);
    expect(submitBlock).toMatch(/submitSalesOrderDraftForReviewWithOperatorSync/);
    expect(submitBlock).toMatch(/resolveLatestOperatorLineQuantities/);
    expect(submitBlock).not.toMatch(/updateSalesOrderDraftOperatorFinal/);
    expect(submitBlock).not.toMatch(/submitSalesOrderDraftForReview\(/);
  });

  it("repository uses atomic submit RPC when extracted draft is present", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const submitStart = repo.indexOf("export async function submitSalesOrderDraftForReviewWithOperatorSync");
    const submitEnd = repo.indexOf("export async function approveSalesOrderDraft");
    const submitBlock = repo.slice(submitStart, submitEnd);
    expect(submitBlock).toMatch(/rpc\("submit_sales_order_draft_for_review_atomic"/);
    expect(submitBlock).not.toMatch(/update_sales_order_draft_operator_final/);
    expect(submitBlock).not.toMatch(/transition_sales_order_draft_status/);
    expect(submitBlock).not.toMatch(/for \(const line of/);
  });

  it("falls back to transition-only submit when extracted is null", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const submitStart = repo.indexOf("export async function submitSalesOrderDraftForReviewWithOperatorSync");
    const submitEnd = repo.indexOf("export async function approveSalesOrderDraft");
    const submitBlock = repo.slice(submitStart, submitEnd);
    expect(submitBlock).toMatch(/if \(!input\.extracted\)/);
    expect(submitBlock).toMatch(/submitSalesOrderDraftForReview\(/);
  });

  it("throws on atomic submit RPC failure without separate operator or transition calls", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Draft line 0 not found" } });

    const { submitSalesOrderDraftForReviewWithOperatorSync } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      submitSalesOrderDraftForReviewWithOperatorSync({
        draftId: "draft-1",
        extracted: extractedFixture,
        operatorLineQuantities: { 0: 12 },
        actor: { id: "user-1", name: "Operator" },
      }),
    ).rejects.toThrow("Draft line 0 not found");

    expect(rpcMock).toHaveBeenCalledWith(
      "submit_sales_order_draft_for_review_atomic",
      expect.objectContaining({ p_draft_id: "draft-1" }),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("submit review RPC migration verifies actor id and status transition", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(
        import.meta.dirname,
        "../../../../supabase/migrations/20260606150000_wa_sprint9_sales_order_draft_submit_review_atomic_rpc.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/p_actor_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(sql).toMatch(/status = 'UNDER_REVIEW'/);
    expect(sql).toMatch(/SUBMIT_REVIEW/);
    expect(sql).toMatch(/AI_DRAFT/);
  });
});

describe("submitForReview operator sync (static)", () => {
  it("persists latest operator quantities via atomic submit repository method", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const submitStart = hook.indexOf("const submitForReview = useCallback");
    expect(submitStart).toBeGreaterThan(-1);
    const submitBlock = hook.slice(submitStart, submitStart + 700);
    expect(submitBlock).toMatch(/resolveLatestOperatorLineQuantities/);
    expect(submitBlock).toMatch(/submitSalesOrderDraftForReviewWithOperatorSync/);
    expect(submitBlock).toMatch(/operatorLineQuantities: latestQuantities/);
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
