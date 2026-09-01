import { describe, expect, it, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import {
  buildProductAliasLearningCapture,
  clarificationChipCandidates,
  observedProductPhrase,
} from "@/lib/wa-governance/clarificationProductCandidate";
import type { ProductResolutionCandidate } from "@/lib/wa-governance/productResolutionTypes";

const candidate = (id: string, name: string): ProductResolutionCandidate => ({
  productId: id,
  productName: name,
  sku: `SKU-${id}`,
  confidence: 80,
  reasons: ["alias"],
});

const captureMock = vi.fn();
const fetchSnapshotMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

vi.mock("@/hooks/useWhatsAppPermissions", () => ({
  useWhatsAppPermissions: () => ({
    has: (key: string) => key === "wa.intake.triage",
    loading: false,
  }),
}));

vi.mock("@/lib/wa-governance/caseDecisionDesk", () => ({
  fetchWhatsAppCaseDecisionSnapshot: (...args: unknown[]) => fetchSnapshotMock(...args),
  captureWhatsAppLearningCandidate: (...args: unknown[]) => captureMock(...args),
  newCaseActionIdempotencyKey: (_kind: string, seed: string) => `key:${seed}`,
}));

describe("clarificationProductCandidate helpers", () => {
  it("deduplicates chip candidates and keeps best match first", () => {
    const best = candidate("p1", "Kaju Pyramid");
    const alternatives = [candidate("p2", "Kaju Round"), candidate("p1", "Duplicate")];
    expect(clarificationChipCandidates(best, alternatives).map((item) => item.productId)).toEqual(["p1", "p2"]);
  });

  it("prefers interpreted order-line product phrase for observed value", () => {
    expect(observedProductPhrase({
      stitchedText: "send kaju",
      orderLineProductName: "kaju pyramd",
    })).toBe("kaju pyramd");
  });

  it("uses stitched customer evidence when no order-line product name exists", () => {
    expect(observedProductPhrase({
      stitchedText: "send kaju pyramd",
      orderLineProductName: null,
    })).toBe("send kaju pyramd");
  });

  it("fails closed without customer evidence and does not use catalogue names", () => {
    expect(observedProductPhrase({
      stitchedText: "   ",
      orderLineProductName: null,
    })).toBe("");
  });

  it("builds governed PRODUCT_ALIAS capture payload", () => {
    const payload = buildProductAliasLearningCapture({
      caseId: "case-1",
      packetId: "packet-1",
      candidate: candidate("p1", "Kaju Pyramid"),
      observedValue: "kaju pyramd",
      idempotencyKey: "learning:case-1:p1",
    });
    expect(payload.candidateType).toBe("PRODUCT_ALIAS");
    expect(payload.proposedMapping).toMatchObject({ productId: "p1", sku: "SKU-p1" });
    expect(payload.evidence).toMatchObject({ packet_id: "packet-1", selection: "clarification_product_chip" });
    expect(payload.observedValue).toBe("kaju pyramd");
    expect(payload.observedValue).not.toBe("Kaju Pyramid");
  });

  it("fails closed when observed value is empty", () => {
    expect(() => buildProductAliasLearningCapture({
      caseId: "case-1",
      packetId: "packet-1",
      candidate: candidate("p1", "Kaju Pyramid"),
      observedValue: "   ",
      idempotencyKey: "key",
    })).toThrow("LEARNING_OBSERVED_VALUE_REQUIRED");
  });
});

describe("ClarificationProductCandidateChips", () => {
  beforeEach(() => {
    captureMock.mockReset();
    fetchSnapshotMock.mockReset();
  });

  async function renderChips(packetId: string) {
    const { ClarificationProductCandidateChips } = await import("@/components/whatsapp/ClarificationProductCandidateChips");
    return render(createElement(ClarificationProductCandidateChips, {
      packetId,
      bestMatch: candidate("p1", "Kaju Pyramid"),
      alternatives: [candidate("p2", "Kaju Round")],
      stitchedText: undefined,
      orderLineProductName: null,
    }));
  }

  it("does not capture alias proposals when customer-observed phrase is absent", async () => {
    fetchSnapshotMock.mockResolvedValue({ communicationCase: { id: "case-1" } });
    await renderChips("packet-1");
    await waitFor(() => expect(fetchSnapshotMock).toHaveBeenCalled());
    const button = screen.getByRole("button", { name: /Kaju Pyramid/i });
    expect(button).toBeDisabled();
    expect(screen.getByText(/Customer product phrase unavailable/i)).toBeInTheDocument();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("clears stale error after failed packet A then successful packet B load", async () => {
    fetchSnapshotMock
      .mockRejectedValueOnce(new Error("case load failed"))
      .mockResolvedValueOnce({ communicationCase: { id: "case-2" } });

    const { ClarificationProductCandidateChips } = await import("@/components/whatsapp/ClarificationProductCandidateChips");
    const { rerender } = render(createElement(ClarificationProductCandidateChips, {
      packetId: "packet-a",
      bestMatch: candidate("p1", "Kaju Pyramid"),
      alternatives: [],
      stitchedText: "customer phrase",
      orderLineProductName: null,
    }));

    await waitFor(() => expect(screen.getByText(/case load failed/i)).toBeInTheDocument());

    rerender(createElement(ClarificationProductCandidateChips, {
      packetId: "packet-b",
      bestMatch: candidate("p1", "Kaju Pyramid"),
      alternatives: [],
      stitchedText: "customer phrase",
      orderLineProductName: null,
    }));

    await waitFor(() => expect(screen.queryByText(/case load failed/i)).not.toBeInTheDocument());
    expect(fetchSnapshotMock).toHaveBeenLastCalledWith(expect.anything(), "packet-b");
  });

  it("keeps triage/case fail-closed gates when case is missing", async () => {
    fetchSnapshotMock.mockResolvedValue({ communicationCase: null });
    const { ClarificationProductCandidateChips } = await import("@/components/whatsapp/ClarificationProductCandidateChips");
    render(createElement(ClarificationProductCandidateChips, {
      packetId: "packet-1",
      bestMatch: candidate("p1", "Kaju Pyramid"),
      alternatives: [],
      stitchedText: "customer phrase",
      orderLineProductName: null,
    }));
    await waitFor(() => expect(screen.getByText(/No communication case is linked/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Kaju Pyramid/i })).toBeDisabled();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("ignores in-flight capture completion after packet switch", async () => {
    let resolveCapture: (() => void) | undefined;
    captureMock.mockImplementation(
      () => new Promise<void>((resolve) => {
        resolveCapture = resolve;
      }),
    );
    fetchSnapshotMock.mockResolvedValue({ communicationCase: { id: "case-1" } });

    const { ClarificationProductCandidateChips } = await import("@/components/whatsapp/ClarificationProductCandidateChips");
    const { rerender } = render(createElement(ClarificationProductCandidateChips, {
      packetId: "packet-a",
      bestMatch: candidate("p1", "Kaju Pyramid"),
      alternatives: [],
      stitchedText: "customer phrase",
      orderLineProductName: null,
    }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Kaju Pyramid/i })).not.toBeDisabled());
    screen.getByRole("button", { name: /Kaju Pyramid/i }).click();

    rerender(createElement(ClarificationProductCandidateChips, {
      packetId: "packet-b",
      bestMatch: candidate("p1", "Kaju Pyramid"),
      alternatives: [],
      stitchedText: "customer phrase",
      orderLineProductName: null,
    }));

    resolveCapture?.();
    await waitFor(() => expect(captureMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/Recorded governed PRODUCT_ALIAS candidate/i)).not.toBeInTheDocument();
  });
});
