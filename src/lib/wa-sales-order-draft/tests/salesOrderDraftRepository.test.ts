import { beforeEach, describe, expect, it, vi } from "vitest";

const { linesResult, auditResult, fromMock, rpcMock, draftHeaderResult } = vi.hoisted(() => ({
  linesResult: {
    data: null as unknown[] | null,
    error: null as { message: string } | null,
  },
  auditResult: {
    data: [] as unknown[],
    error: null as { message: string } | null,
  },
  draftHeaderResult: {
    data: {
      id: "draft-1",
      status: "AI_DRAFT",
      extraction_request_key: "key-1",
    } as Record<string, unknown> | null,
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

function draftHeaderChainMock() {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue(draftHeaderResult),
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

describe("approve and reject atomicity (static)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("approve uses atomic RPC only without operator sync chain", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const approveStart = repo.indexOf("export async function approveSalesOrderDraft");
    const approveEnd = repo.indexOf("export async function rejectSalesOrderDraft");
    const approveBlock = repo.slice(approveStart, approveEnd);
    expect(approveBlock).toMatch(/rpc\("approve_sales_order_draft_for_so_atomic"/);
    expect(approveBlock).not.toMatch(/update_sales_order_draft_operator_final/);
    expect(approveBlock).not.toMatch(/transition_sales_order_draft_status/);
    expect(approveBlock).not.toMatch(/canTransitionToApproved/);
    expect(approveBlock).not.toMatch(/from\("sales_order_drafts"\)\s*\n\s*\.update/);
  });

  it("reject uses atomic RPC only", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const rejectStart = repo.indexOf("export async function rejectSalesOrderDraft");
    const rejectEnd = repo.indexOf("export async function updateSalesOrderDraftOperatorFinal");
    const rejectBlock = repo.slice(rejectStart, rejectEnd);
    expect(rejectBlock).toMatch(/rpc\("reject_sales_order_draft_atomic"/);
    expect(rejectBlock).not.toMatch(/transition_sales_order_draft_status/);
    expect(rejectBlock).not.toMatch(/from\("sales_order_drafts"\)\s*\n\s*\.update/);
  });

  it("throws on approve RPC failure without separate writes", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "client is not ready" } });

    const { approveSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );

    await expect(
      approveSalesOrderDraft({
        draftId: "draft-1",
        actor: { id: "user-1", name: "Approver" },
      }),
    ).rejects.toThrow("client is not ready");

    expect(rpcMock).toHaveBeenCalledWith(
      "approve_sales_order_draft_for_so_atomic",
      expect.objectContaining({ p_draft_id: "draft-1", p_actor_id: "user-1" }),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("throws on reject RPC failure without separate writes", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "Reject not allowed" } });

    const { rejectSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );

    await expect(
      rejectSalesOrderDraft({
        draftId: "draft-1",
        actor: { id: "user-1", name: "Reviewer" },
        rejectionReason: "Incomplete address",
      }),
    ).rejects.toThrow("Reject not allowed");

    expect(rpcMock).toHaveBeenCalledWith(
      "reject_sales_order_draft_atomic",
      expect.objectContaining({
        p_draft_id: "draft-1",
        p_rejection_reason: "Incomplete address",
      }),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("approve/reject RPC migrations verify actor id and readiness validation", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const sql = readFileSync(
      join(
        import.meta.dirname,
        "../../../../supabase/migrations/20260606160000_wa_sprint9_sales_order_draft_approve_reject_atomic_rpc.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/p_actor_id IS DISTINCT FROM auth\.uid\(\)/);
    expect(sql).toMatch(/validate_sales_order_draft_readiness/);
    expect(sql).toMatch(/APPROVE/);
    expect(sql).toMatch(/REJECT/);
    expect(sql).toMatch(/UNDER_REVIEW/);
    expect(sql).toMatch(/payment_terms/);
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
    const createEnd = repo.indexOf("export async function submitSalesOrderDraftForReviewWithOperatorSync");
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
    const createEnd = repo.indexOf("export async function submitSalesOrderDraftForReviewWithOperatorSync");
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
    draftHeaderResult.data = {
      id: "draft-1",
      status: "AI_DRAFT",
      extraction_request_key: "key-1",
    };
    draftHeaderResult.error = null;
  });

  it("uses RPC only and does not manually update header, lines, or audit", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    const updateStart = repo.indexOf("export async function updateSalesOrderDraftOperatorFinal");
    const updateEnd = repo.indexOf("async function fetchDraftHeaderForMutation");
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
        return draftHeaderChainMock();
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

    const writeCalls = fromMock.mock.calls.filter(
      ([table]) => table === "sales_order_draft_audit_log",
    );
    expect(writeCalls).toHaveLength(0);
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
    draftHeaderResult.data = {
      id: "draft-1",
      status: "AI_DRAFT",
      extraction_request_key: "key-1",
    };
    draftHeaderResult.error = null;
    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_drafts") {
        return draftHeaderChainMock();
      }
      return chainMock({ data: [], error: null });
    });
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
    expect(submitBlock).toMatch(/Draft extraction must be ready before submitting for review/);
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

  it("requires extracted draft and always uses atomic submit RPC", async () => {
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
    expect(submitBlock).toMatch(/Draft extraction must be ready before submitting for review/);
    expect(submitBlock).toMatch(/rpc\("submit_sales_order_draft_for_review_atomic"/);
    expect(submitBlock).not.toMatch(/submitSalesOrderDraftForReview\(/);
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
    expect(submitBlock).toMatch(/Draft extraction must be ready before submitting for review/);
  });

  it("approve uses single atomic repository call without operator sync chain", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const approveStart = hook.indexOf("const approveDraft = useCallback");
    expect(approveStart).toBeGreaterThan(-1);
    const approveBlock = hook.slice(approveStart, approveStart + 500);
    expect(approveBlock).toMatch(/approveSalesOrderDraft/);
    expect(approveBlock).not.toMatch(/updateSalesOrderDraftOperatorFinal/);
    expect(approveBlock).not.toMatch(/resolveLatestOperatorLineQuantities/);
  });
});

describe("extraction projection guard (static)", () => {
  it("sync and submit validate extraction_request_key before RPC", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    expect(repo).toMatch(/assertPersistedDraftExtractionMatch/);
    expect(repo).toMatch(/fetchDraftHeaderForMutation/);
    const submitStart = repo.indexOf("export async function submitSalesOrderDraftForReviewWithOperatorSync");
    const submitEnd = repo.indexOf("export async function approveSalesOrderDraft");
    const submitBlock = repo.slice(submitStart, submitEnd);
    expect(submitBlock).toMatch(/assertPersistedDraftExtractionMatch/);
    const updateStart = repo.indexOf("export async function updateSalesOrderDraftOperatorFinal");
    const updateEnd = repo.indexOf("async function fetchDraftHeaderForMutation");
    const updateBlock = repo.slice(updateStart, updateEnd);
    expect(updateBlock).toMatch(/assertPersistedDraftExtractionMatch/);
  });

  it("locks draft panel quantity edits while under review or terminal", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const inbox = readFileSync(
      join(import.meta.dirname, "../../../components/WhatsAppInbox.tsx"),
      "utf8",
    );
    const panel = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/OperatorInboxDraftOrderPanel.tsx"),
      "utf8",
    );
    expect(inbox).toMatch(/quantityEditsLocked/);
    expect(inbox).toMatch(/draftStatus === "UNDER_REVIEW"/);
    expect(panel).toMatch(/quantityEditsLocked/);
    expect(panel).toMatch(/Quantity edits are locked while the sales order draft is under review/);
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

  it("disables submit for review without extraction", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    const submitButtonStart = section.indexOf("onClick={() => void submitForReview()}");
    expect(submitButtonStart).toBeGreaterThan(-1);
    const submitBlock = section.slice(submitButtonStart - 120, submitButtonStart);
    expect(submitBlock).toMatch(/disabled=\{actionPending \|\| !extracted\}/);
  });
});
