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
    expect(approveBlock).toMatch(/assertPersistedDraftExtractionMatch/);
    expect(approveBlock).toMatch(/p_expected_extraction_request_key/);
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
    draftHeaderResult.data = {
      id: "draft-1",
      status: "UNDER_REVIEW",
      extraction_request_key: "key-1",
    };
    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_drafts") {
        return draftHeaderChainMock();
      }
      return chainMock({ data: [], error: null });
    });

    const { approveSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      approveSalesOrderDraft({
        draftId: "draft-1",
        extracted: extractedFixture,
        actor: { id: "user-1", name: "Approver" },
      }),
    ).rejects.toThrow("client is not ready");

    expect(rpcMock).toHaveBeenCalledWith(
      "approve_sales_order_draft_for_so_atomic",
      expect.objectContaining({
        p_draft_id: "draft-1",
        p_expected_extraction_request_key: "key-1",
        p_actor_id: "user-1",
      }),
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

});

describe("approve extraction version and readiness validation", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
    draftHeaderResult.data = {
      id: "draft-1",
      status: "UNDER_REVIEW",
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

  it("stale extraction version cannot approve", async () => {
    const { approveSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      approveSalesOrderDraft({
        draftId: "draft-1",
        extracted: { ...extractedFixture, extractionRequestKey: "new-key" },
        actor: { id: "user-1", name: "Approver" },
      }),
    ).rejects.toThrow(/approve for SO/);

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("missing extraction version cannot approve", async () => {
    draftHeaderResult.data = {
      id: "draft-1",
      status: "UNDER_REVIEW",
      extraction_request_key: "",
    };
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "Expected extraction request key is required" },
    });

    const { approveSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      approveSalesOrderDraft({
        draftId: "draft-1",
        extracted: { ...extractedFixture, extractionRequestKey: "" },
        actor: { id: "user-1", name: "Approver" },
      }),
    ).rejects.toThrow("Expected extraction request key is required");

    expect(rpcMock).toHaveBeenCalledWith(
      "approve_sales_order_draft_for_so_atomic",
      expect.objectContaining({ p_expected_extraction_request_key: "" }),
    );
  });

  it("invalid persisted readiness cannot approve", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: "client is not ready (20 — missing)" } });

    const { approveSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      approveSalesOrderDraft({
        draftId: "draft-1",
        extracted: extractedFixture,
        actor: { id: "user-1", name: "Approver" },
      }),
    ).rejects.toThrow("client is not ready");

    expect(rpcMock).toHaveBeenCalledWith(
      "approve_sales_order_draft_for_so_atomic",
      expect.objectContaining({ p_expected_extraction_request_key: "key-1" }),
    );
  });

  it("valid persisted readiness approves via atomic RPC", async () => {
    rpcMock.mockResolvedValue({ data: "draft-1", error: null });

    const { approveSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_drafts") {
        return {
          select: vi.fn().mockImplementation((fields: string) => ({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data:
                  fields === "id, status, extraction_request_key"
                    ? {
                        id: "draft-1",
                        status: "UNDER_REVIEW",
                        extraction_request_key: "key-1",
                      }
                    : {
                        id: "draft-1",
                        packet_id: "pkt-1",
                        extraction_request_key: "key-1",
                        status: "APPROVED_FOR_SO",
                        readiness_dimensions: extractedFixture.readiness.dimensions,
                        ai_draft_snapshot: extractedFixture,
                        operator_final_snapshot: {},
                      },
                error: null,
              }),
            }),
          })),
        };
      }
      return chainMock({ data: [], error: null });
    });

    await approveSalesOrderDraft({
      draftId: "draft-1",
      extracted: extractedFixture,
      actor: { id: "user-1", name: "Approver" },
    });

    expect(rpcMock).toHaveBeenCalledWith(
      "approve_sales_order_draft_for_so_atomic",
      expect.objectContaining({
        p_draft_id: "draft-1",
        p_expected_extraction_request_key: "key-1",
        p_actor_id: "user-1",
      }),
    );
  });

});

describe("createSalesOrderDraft version recovery", () => {
  beforeEach(() => {
    fromMock.mockReset();
    rpcMock.mockReset();
  });

  it("throws when active draft extraction key mismatches live extraction", async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_drafts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "draft-1",
                      packet_id: "pkt-1",
                      extraction_request_key: "old-key",
                      status: "AI_DRAFT",
                      readiness_dimensions: [],
                      ai_draft_snapshot: {},
                      operator_final_snapshot: {},
                    },
                  ],
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      return chainMock({ data: [], error: null });
    });

    const { createSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    await expect(
      createSalesOrderDraft({
        extracted: { ...extractedFixture, extractionRequestKey: "new-key" },
        operatorLineQuantities: { 0: 12 },
        actor: { id: "user-1", name: "Operator" },
      }),
    ).rejects.toThrow(/older WhatsApp extraction/);

    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("allows create when latest draft is REJECTED even if extraction key changed", async () => {
    rpcMock.mockResolvedValue({ data: "draft-2", error: null });

    fromMock.mockImplementation((table: string) => {
      if (table === "sales_order_drafts") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockImplementation((_col: string, val: string) => {
              if (val === "draft-2") {
                return {
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "draft-2",
                      packet_id: "pkt-1",
                      extraction_request_key: "new-key",
                      status: "AI_DRAFT",
                      readiness_dimensions: [],
                      ai_draft_snapshot: {},
                      operator_final_snapshot: {},
                    },
                    error: null,
                  }),
                };
              }
              return {
                order: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "draft-1",
                        packet_id: "pkt-1",
                        extraction_request_key: "old-key",
                        status: "REJECTED",
                        readiness_dimensions: [],
                        ai_draft_snapshot: {},
                        operator_final_snapshot: {},
                      },
                    ],
                    error: null,
                  }),
                }),
              };
            }),
          }),
        };
      }
      if (table === "sales_order_draft_lines" || table === "sales_order_draft_audit_log") {
        return chainMock({ data: [], error: null });
      }
      return chainMock({ data: [], error: null });
    });

    const { createSalesOrderDraft } = await import(
      "@/lib/wa-sales-order-draft/salesOrderDraftRepository"
    );
    const { extractedFixture } = await import("./fixtures/extractedDraftFixture");

    const bundle = await createSalesOrderDraft({
      extracted: { ...extractedFixture, extractionRequestKey: "new-key" },
      operatorLineQuantities: { 0: 12 },
      actor: { id: "user-1", name: "Operator" },
    });

    expect(bundle.draft.id).toBe("draft-2");
    expect(rpcMock).toHaveBeenCalledWith("create_sales_order_draft_atomic", expect.any(Object));
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
        p_expected_extraction_request_key: "key-1",
        p_actor_id: "user-1",
      }),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);

    const writeCalls = fromMock.mock.calls.filter(
      ([table]) => table === "sales_order_draft_audit_log",
    );
    expect(writeCalls).toHaveLength(0);
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
      expect.objectContaining({
        p_draft_id: "draft-1",
        p_expected_extraction_request_key: "key-1",
      }),
    );
    expect(rpcMock).toHaveBeenCalledTimes(1);
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
    const submitBlock = hook.slice(submitStart, submitStart + 900);
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
    const approveBlock = hook.slice(approveStart, approveStart + 700);
    expect(hook).toMatch(/approveSalesOrderDraft\([\s\S]*extracted,/);
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
    expect(inbox).toMatch(/draftStatus === "APPROVED_FOR_SO"/);
    expect(inbox).not.toMatch(/quantityEditsLocked=\{\s*\n\s*salesOrderDraftHook\.isTerminal/);
    expect(panel).toMatch(/quantityEditsLocked/);
    expect(panel).toMatch(/Quantity edits are locked while the sales order draft is under review/);
  });
  it("ignores stale reload and action results after packet switch", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    expect(hook).toMatch(/requestGenerationRef/);
    expect(hook).toMatch(/isActivePacketRequest\(requestPacketId, requestGeneration\)/);
    expect(hook).toMatch(/bundle\.draft\.packet_id !== requestPacketId/);
  });

  it("passes expected extraction key to sync/submit RPCs", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    expect(repo).toMatch(/p_expected_extraction_request_key: draftHeader\.extraction_request_key/);
    expect(repo).toMatch(/p_expected_extraction_request_key: input\.extracted\.extractionRequestKey/);
  });

  it("blocks create from returning stale active AI_DRAFT", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(import.meta.dirname, "../salesOrderDraftRepository.ts"),
      "utf8",
    );
    expect(repo).toMatch(/STALE_EXTRACTION_DRAFT_MESSAGE/);
    expect(repo).toMatch(/isExtractionVersionStale/);
  });

  it("shows stale extraction recovery copy in UI", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    expect(section).toMatch(/This draft was created from an older WhatsApp extraction/);
  });

  it("allows AI_DRAFT reject when extraction projection is stale", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    expect(section).toMatch(/extractionProjectionStale/);
    expect(section).toMatch(/Reject draft/);
    expect(section).toMatch(/!extracted \|\| extractionProjectionStale/);
  });

  it("blocks approve when extraction projection is stale even if readiness passes", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const approveButtonStart = section.indexOf("Approve for SO");
    expect(approveButtonStart).toBeGreaterThan(-1);
    const approveBlock = section.slice(approveButtonStart - 520, approveButtonStart + 80);
    expect(approveBlock).toMatch(/canApproveDraft/);
    expect(approveBlock).toMatch(/extractionReady/);
    expect(section).toMatch(/Waiting for latest WhatsApp extraction/);
    expect(section).toMatch(
      /Cannot approve: draft was created from an older WhatsApp extraction/,
    );

    const approveDraftStart = hook.indexOf("const approveDraft = useCallback");
    expect(approveDraftStart).toBeGreaterThan(-1);
    const approveHandlerBlock = hook.slice(approveDraftStart, approveDraftStart + 650);
    expect(approveHandlerBlock).toMatch(/if \(!extracted\)/);
    expect(approveHandlerBlock).toMatch(/Waiting for latest WhatsApp extraction/);
    expect(approveHandlerBlock).toMatch(/if \(extractionProjectionStale\)/);
    expect(approveHandlerBlock).toMatch(/setActionError/);
    expect(approveHandlerBlock).toMatch(/return;/);
  });

  it("blocks approve in UI when extraction is null, loading, or error", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    expect(section).toMatch(/!extractionReady \|\| !extracted/);
    expect(section).toMatch(/disabled=\{actionPending \|\| !canApproveDraft \|\| !extractionReady\}/);
    expect(hook).toMatch(/canApproveDraft/);
    expect(hook).toMatch(/approveExtractionReady = Boolean\(extracted\)/);
  });

  it("clears actionPending via action token after stale async action completes", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    const runActionStart = hook.indexOf("const runAction = useCallback");
    expect(runActionStart).toBeGreaterThan(-1);
    const runActionBlock = hook.slice(runActionStart, runActionStart + 900);
    expect(runActionBlock).toMatch(/actionTokenRef/);
    expect(runActionBlock).toMatch(/const actionToken = \+\+actionTokenRef\.current/);
    expect(runActionBlock).toMatch(/if \(actionTokenRef\.current === actionToken\)/);
    expect(runActionBlock).toMatch(/setActionPending\(false\)/);
    expect(hook).toMatch(/actionTokenRef\.current \+= 1[\s\S]*setActionPending\(false\)/);
  });

  it("hides create draft CTA while persisted draft is loading", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    expect(section).toMatch(/canShowCreateDraft/);
    expect(section).toMatch(/isPersistedDraftLoading/);
    expect(section).not.toMatch(/!bundle && state\.status !== "loading"/);
    expect(hook).toMatch(/canShowCreateDraft = state\.status === "ready" && !currentBundle/);
    expect(hook).toMatch(/isPersistedDraftLoading/);
  });
  it("shows retry instead of create when persisted draft fetch errors without bundle", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const section = readFileSync(
      join(
        import.meta.dirname,
        "../../../components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx",
      ),
      "utf8",
    );
    expect(section).toMatch(/state\.status === "error" && !bundle/);
    expect(section).toMatch(/Retry loading draft/);
    expect(section).not.toMatch(/Create Sales Order Draft[\s\S]*state\.status === "error" && !bundle/);
  });
  it("clears stale local qty overrides when creating after extraction drift", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const hook = readFileSync(
      join(import.meta.dirname, "../../../components/whatsapp/useOperatorInboxSalesOrderDraft.ts"),
      "utf8",
    );
    expect(hook).toMatch(/resolveCreateOperatorLineQuantities/);
    expect(hook).toMatch(/extractionProjectionStale/);
    expect(hook).toMatch(/clearDraftOrderLocalEdits\(packetId\)/);
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
    expect(section).toMatch(/!extracted \|\| extractionProjectionStale/);
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
    const submitBlock = section.slice(submitButtonStart - 160, submitButtonStart);
    expect(submitBlock).toMatch(/!extracted \|\| extractionProjectionStale/);
  });
});
