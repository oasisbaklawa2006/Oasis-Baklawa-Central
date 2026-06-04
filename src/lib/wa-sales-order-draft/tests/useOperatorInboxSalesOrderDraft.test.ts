import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SalesOrderDraftBundle } from "@/lib/wa-sales-order-draft/types";

const fetchSalesOrderDraftByPacket = vi.fn();
const approveSalesOrderDraft = vi.fn();

vi.mock("@/lib/wa-sales-order-draft/salesOrderDraftRepository", () => ({
  fetchSalesOrderDraftByPacket: (...args: unknown[]) => fetchSalesOrderDraftByPacket(...args),
  approveSalesOrderDraft: (...args: unknown[]) => approveSalesOrderDraft(...args),
  createSalesOrderDraft: vi.fn(),
  rejectSalesOrderDraft: vi.fn(),
  submitSalesOrderDraftForReviewWithOperatorSync: vi.fn(),
  updateSalesOrderDraftOperatorFinal: vi.fn(),
}));

vi.mock("@/components/whatsapp/operatorInboxDraftOrderLocalState", () => ({
  getDraftOrderLocalEdits: () => ({ lineQuantities: {} }),
  clearDraftOrderLocalEdits: vi.fn(),
}));

vi.mock("@/lib/wa-sales-order-draft/buildComparisonView", () => ({
  buildSalesOrderDraftComparisonView: vi.fn(() => null),
}));

import { useOperatorInboxSalesOrderDraft } from "@/components/whatsapp/useOperatorInboxSalesOrderDraft";
import { extractedFixture } from "./fixtures/extractedDraftFixture";

const extractedFixtureLive = {
  ...extractedFixture,
  extractionRequestKey: "key-live",
};

const bundleFixture: SalesOrderDraftBundle = {
  draft: {
    id: "draft-1",
    packet_id: "packet-a",
    status: "UNDER_REVIEW",
    extraction_request_key: "key-live",
    ai_draft_snapshot: extractedFixture,
    readiness_dimensions: extractedFixture.readiness.dimensions,
  } as SalesOrderDraftBundle["draft"],
  lines: [],
  auditLog: [],
};

describe("useOperatorInboxSalesOrderDraft actionPending lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSalesOrderDraftByPacket.mockResolvedValue(bundleFixture);
  });

  it("clears actionPending after stale action completes following packet switch", async () => {
    let resolveApprove: ((value: SalesOrderDraftBundle) => void) | undefined;
    approveSalesOrderDraft.mockImplementation(
      () =>
        new Promise<SalesOrderDraftBundle>((resolve) => {
          resolveApprove = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      (props: { packetId: string | null }) =>
        useOperatorInboxSalesOrderDraft({
          packetId: props.packetId,
          extracted: extractedFixtureLive,
          operatorLineQuantities: {},
          user: { id: "user-1", email: "u@test.com", user_metadata: {} } as never,
          enabled: Boolean(props.packetId),
        }),
      { initialProps: { packetId: "packet-a" as string | null } },
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    await act(async () => {
      void result.current.approveDraft();
    });
    expect(result.current.actionPending).toBe(true);

    rerender({ packetId: "packet-b" });
    await waitFor(() => {
      expect(result.current.actionPending).toBe(false);
    });

    await act(async () => {
      resolveApprove?.(bundleFixture);
      await Promise.resolve();
    });

    expect(result.current.actionPending).toBe(false);
  });
});

describe("useOperatorInboxSalesOrderDraft approve extraction guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchSalesOrderDraftByPacket.mockResolvedValue(bundleFixture);
  });

  it("blocks approve handler when extraction is unavailable", async () => {
    const { result } = renderHook(() =>
      useOperatorInboxSalesOrderDraft({
        packetId: "packet-a",
        extracted: null,
        operatorLineQuantities: {},
        user: { id: "user-1", email: "u@test.com", user_metadata: {} } as never,
        enabled: true,
      }),
    );

    await waitFor(() => {
      expect(result.current.state.status).toBe("ready");
    });

    await act(async () => {
      await result.current.approveDraft();
    });

    expect(approveSalesOrderDraft).not.toHaveBeenCalled();
    expect(result.current.actionError).toBe("Waiting for latest WhatsApp extraction.");
    expect(result.current.canApproveDraft).toBe(false);
  });
});
