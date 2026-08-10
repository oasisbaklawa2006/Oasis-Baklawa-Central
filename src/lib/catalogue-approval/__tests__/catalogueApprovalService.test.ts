import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  CATALOGUE_APPROVAL_LEGACY_FORBIDDEN,
  createCatalogueApprovalService,
  parseAliasDraftView,
  parseTagDraftView,
} from "../index";
import type { CatalogueApprovalService } from "../catalogueApprovalService";

const __dirname = dirname(fileURLToPath(import.meta.url));

function mockClient(handlers: {
  tagDrafts?: unknown[];
  aliasDrafts?: unknown[];
  pricingDrafts?: unknown[];
  moqDrafts?: unknown[];
  rpc?: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: null }>;
}) {
  const draftsByTable: Record<string, unknown[]> = {
    catalogue_tag_drafts: handlers.tagDrafts ?? [],
    catalogue_alias_drafts: handlers.aliasDrafts ?? [],
    catalogue_pricing_drafts: handlers.pricingDrafts ?? [],
    catalogue_moq_drafts: handlers.moqDrafts ?? [],
  };
  const from = vi.fn((table: string) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: draftsByTable[table] ?? [],
        error: null,
      }),
    };
    return chain;
  });

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    if (handlers.rpc) {
      return handlers.rpc(name, args);
    }
    return { data: { ok: true, action: "approved" }, error: null };
  });

  return { from, rpc } as unknown as Parameters<typeof createCatalogueApprovalService>[0];
}

describe("catalogue approval service", () => {
  it("lists tag drafts using product_tags field names in payload", async () => {
    const service = createCatalogueApprovalService(
      mockClient({
        tagDrafts: [
          {
            id: "t1",
            operation: "create",
            status: "pending_approval",
            submitted_at: "2026-06-01T00:00:00Z",
            target_record_id: null,
            payload: {
              scope: "tag_vocabulary",
              tag_key: "general:festive",
              tag_label: "Festive",
              is_active: true,
            },
          },
        ],
      }),
    );

    const rows = await service.listPendingTagDrafts();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("tag");
    if (rows[0].kind === "tag") {
      expect(rows[0].tag_key).toBe("general:festive");
      expect(rows[0].tag_label).toBe("Festive");
      expect(rows[0].is_active).toBe(true);
    }
  });

  it("lists alias drafts using product_aliases field names", async () => {
    const service = createCatalogueApprovalService(
      mockClient({
        aliasDrafts: [
          {
            id: "a1",
            operation: "create",
            status: "pending_approval",
            submitted_at: "2026-06-01T00:00:00Z",
            target_record_id: null,
            payload: {
              scope: "product_alias",
              alias_text: "baklava box",
              canonical_name: "Premium Pack",
              product_id: "prod-uuid",
            },
          },
        ],
      }),
    );

    const rows = await service.listPendingAliasDrafts();
    expect(rows[0].kind).toBe("alias");
    if (rows[0].kind === "alias") {
      expect(rows[0].alias_text).toBe("baklava box");
      expect(rows[0].canonical_name).toBe("Premium Pack");
      expect(rows[0].product_id).toBe("prod-uuid");
    }
  });

  it("calls approve_catalogue_tag_draft RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, action: "approved" },
      error: null,
    });
    const service = createCatalogueApprovalService(mockClient({ rpc }));
    const outcome = await service.approveTagDraft("draft-1");
    expect(rpc).toHaveBeenCalledWith("approve_catalogue_tag_draft", { draft_id: "draft-1" });
    expect(outcome.success).toBe(true);
    expect(outcome.kind).toBe("tag_approved");
  });

  it("calls approve_catalogue_alias_draft RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, action: "approved" },
      error: null,
    });
    const service = createCatalogueApprovalService(mockClient({ rpc }));
    const outcome = await service.approveAliasDraft("draft-2");
    expect(rpc).toHaveBeenCalledWith("approve_catalogue_alias_draft", { draft_id: "draft-2" });
    expect(outcome.kind).toBe("alias_approved");
  });

  it("lists pricing drafts using product_pricing_rules field names (Point 27, Finding 2)", async () => {
    const service = createCatalogueApprovalService(
      mockClient({
        pricingDrafts: [
          {
            id: "p1",
            operation: "create",
            status: "pending_approval",
            submitted_at: "2026-08-01T00:00:00Z",
            target_record_id: null,
            payload: {
              scope: "product_pricing_rule",
              product_id: "prod-uuid",
              price_channel: "b2b",
              price_type: "fixed_price",
              calculated_price: 450,
              currency: "INR",
            },
          },
        ],
      }),
    );

    const rows = await service.listPendingPricingDrafts();
    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("pricing");
    if (rows[0].kind === "pricing") {
      expect(rows[0].product_id).toBe("prod-uuid");
      expect(rows[0].price_channel).toBe("b2b");
      expect(rows[0].calculated_price).toBe(450);
    }
  });

  it("lists moq drafts using product_moq_rules field names (Point 27, Finding 2)", async () => {
    const service = createCatalogueApprovalService(
      mockClient({
        moqDrafts: [
          {
            id: "m1",
            operation: "create",
            status: "pending_approval",
            submitted_at: "2026-08-01T00:00:00Z",
            target_record_id: null,
            payload: {
              scope: "product_moq_rule",
              product_id: "prod-uuid",
              channel: "distributor",
              moq_applicable: true,
              moq_value: 5,
              moq_uom: "kg",
            },
          },
        ],
      }),
    );

    const rows = await service.listPendingMoqDrafts();
    expect(rows[0].kind).toBe("moq");
    if (rows[0].kind === "moq") {
      expect(rows[0].channel).toBe("distributor");
      expect(rows[0].moq_value).toBe(5);
      expect(rows[0].moq_uom).toBe("kg");
    }
  });

  it("calls approve_catalogue_pricing_draft / approve_catalogue_moq_draft RPCs", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: { ok: true, action: "approved" },
      error: null,
    });
    const service = createCatalogueApprovalService(mockClient({ rpc }));

    const pricingOutcome = await service.approvePricingDraft("draft-3");
    expect(rpc).toHaveBeenCalledWith("approve_catalogue_pricing_draft", { draft_id: "draft-3" });
    expect(pricingOutcome.kind).toBe("pricing_approved");

    const moqOutcome = await service.approveMoqDraft("draft-4");
    expect(rpc).toHaveBeenCalledWith("approve_catalogue_moq_draft", { draft_id: "draft-4" });
    expect(moqOutcome.kind).toBe("moq_approved");
  });

  it("does not treat ok:false approve as success", async () => {
    const service = createCatalogueApprovalService(
      mockClient({
        rpc: async () => ({
          data: {
            ok: false,
            action: "approve_blocked_mapping_not_finalized",
            message: "blocked",
          },
          error: null,
        }),
      }),
    );
    const outcome = await service.approveTagDraft("draft-x");
    expect(outcome.success).toBe(false);
    expect(outcome.kind).toBe("mapping_not_finalized");
  });

  it("legacy tags table and alias column names are not used in approval module", () => {
    const moduleDir = join(__dirname, "..");
    const files = ["parseCatalogueApprovalPayload.ts", "parseCatalogueApprovalRpcResult.ts"];
    for (const file of files) {
      const source = readFileSync(join(moduleDir, file), "utf8");
      for (const forbidden of CATALOGUE_APPROVAL_LEGACY_FORBIDDEN) {
        expect(source).not.toContain(forbidden);
      }
    }
    const inboxSource = readFileSync(
      join(__dirname, "../../../pages/admin/ApprovalInbox.tsx"),
      "utf8",
    );
    expect(inboxSource).toContain("product_tags");
    expect(inboxSource).toContain("product_aliases");
    expect(inboxSource).not.toContain('from("tags")');
    expect(inboxSource).not.toContain("normalized_alias");
    expect(parseTagDraftView).toBeDefined();
    const tagView = parseTagDraftView({
      id: "x",
      operation: "create",
      status: "pending_approval",
      submitted_at: null,
      target_record_id: null,
      payload: { tag_label: "L", tag_key: "k" },
    });
    expect(tagView).not.toHaveProperty("normalized_alias");
    const aliasView = parseAliasDraftView({
      id: "y",
      operation: "create",
      status: "pending_approval",
      submitted_at: null,
      target_record_id: null,
      payload: { alias_text: "a", canonical_name: "c", product_id: "p" },
    });
    expect(aliasView.alias_text).toBe("a");
  });
});

describe("CatalogueApprovalService contract", () => {
  it("exposes tag, alias, pricing, and moq approve/reject methods", () => {
    const service: CatalogueApprovalService = createCatalogueApprovalService(
      mockClient({}),
    );
    expect(typeof service.approveTagDraft).toBe("function");
    expect(typeof service.approveAliasDraft).toBe("function");
    expect(typeof service.approvePricingDraft).toBe("function");
    expect(typeof service.approveMoqDraft).toBe("function");
    expect(typeof service.rejectTagDraft).toBe("function");
    expect(typeof service.rejectAliasDraft).toBe("function");
    expect(typeof service.rejectPricingDraft).toBe("function");
    expect(typeof service.rejectMoqDraft).toBe("function");
  });
});
