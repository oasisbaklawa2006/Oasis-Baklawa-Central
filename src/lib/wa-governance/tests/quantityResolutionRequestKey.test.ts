import { describe, expect, it } from "vitest";
import {
  buildQuantityResolutionRequestDescriptor,
  buildQuantityResolutionRequestKey,
  projectQuantityResolutionDisplayState,
  quantityResolutionStateMatchesRequestKey,
  serializeProductResolutionBestMatch,
} from "@/lib/wa-governance/quantityResolutionRequestKey";
import type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { OperatorInboxProductResolutionState } from "@/lib/wa-governance/productResolutionRequestKey";
import type { QuantityResolutionResult } from "@/lib/wa-governance/quantityResolutionTypes";

const sampleResult = (): QuantityResolutionResult => ({
  quantities: [
    {
      rawQuantity: 50,
      rawUnit: "boxes",
      productHint: null,
      confidence: 98,
      reasons: ["Detected explicit quantity 50 boxes in message"],
      band: "auto_highlight",
      conversionStatus: "unknown",
    },
  ],
  band: "auto_highlight",
});

const packet = (id: string) => ({
  id,
  phone_number: "+919876543210",
  wa_contact_id: "wa-1",
  customer_name: "Alice",
  stitched_content: { plain: "Need 50 boxes" },
  messages: [
    {
      id: "m-1",
      direction: "inbound" as const,
      content: "Need 50 boxes",
      created_at: "2026-06-01T10:00:00Z",
    },
  ],
});

const readyIdentity = {
  status: "ready" as const,
  kind: "customer" as const,
  companyName: "HDFC Bank",
  customerName: "Alice",
};

const readyClient = (): OperatorInboxClientResolutionState => ({
  status: "ready",
  requestKey: "client-key",
  result: {
    candidateClients: [],
    bestMatch: {
      companyId: "c-1",
      companyName: "HDFC Bank",
      ownerId: null,
      ownerName: null,
      confidence: 96,
      reasons: [],
    },
    band: "auto_highlight",
  },
});

const readyProduct = (
  productId = "p-1",
  productName = "Assorted Baklawa 400gm Tin",
): OperatorInboxProductResolutionState => ({
  status: "ready",
  requestKey: "product-key",
  result: {
    candidateProducts: [],
    bestMatch: {
      productId,
      productName,
      sku: "BK-400",
      confidence: 96,
      reasons: [],
    },
    band: "auto_highlight",
  },
});

describe("quantityResolutionRequestKey", () => {
  it("includes product resolution best match in the request key", () => {
    const first = buildQuantityResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 50 boxes",
      readyClient(),
      readyProduct("p-a", "Product A"),
    );
    const second = buildQuantityResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 50 boxes",
      readyClient(),
      readyProduct("p-b", "Product B"),
    );

    expect(buildQuantityResolutionRequestKey(first!)).not.toBe(
      buildQuantityResolutionRequestKey(second!),
    );
  });

  it("changes key when content fingerprint changes", () => {
    const first = buildQuantityResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 50 boxes",
      readyClient(),
      readyProduct(),
    );
    const second = buildQuantityResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 25 tins",
      readyClient(),
      readyProduct(),
    );

    expect(buildQuantityResolutionRequestKey(first!)).not.toBe(
      buildQuantityResolutionRequestKey(second!),
    );
  });

  it("does not show packet A ready result under packet B request key", () => {
    const packetAKey = buildQuantityResolutionRequestKey(
      buildQuantityResolutionRequestDescriptor(
        packet("packet-a"),
        readyIdentity,
        "Need 50 boxes",
        readyClient(),
        readyProduct(),
      )!,
    );
    const packetBKey = buildQuantityResolutionRequestKey(
      buildQuantityResolutionRequestDescriptor(
        packet("packet-b"),
        readyIdentity,
        "Need 50 boxes",
        readyClient(),
        readyProduct(),
      )!,
    );

    const staleReady = {
      status: "ready" as const,
      requestKey: packetAKey,
      result: sampleResult(),
    };

    expect(projectQuantityResolutionDisplayState(staleReady, packetBKey)).toEqual({
      status: "loading",
      requestKey: packetBKey,
    });
    expect(quantityResolutionStateMatchesRequestKey(staleReady, packetBKey)).toBe(false);
  });

  it("serializes pending and error product resolution segments distinctly", () => {
    expect(
      serializeProductResolutionBestMatch({ status: "loading", requestKey: "rk" }),
    ).toBe("product:pending");
    expect(
      serializeProductResolutionBestMatch({ status: "error", requestKey: "rk", message: "x" }),
    ).toBe("product:error");
    expect(serializeProductResolutionBestMatch(readyProduct())).toBe(
      "product:p-1:Assorted Baklawa 400gm Tin",
    );
  });

  it("uses stable key for unchanged upstream inputs", () => {
    const descriptor = buildQuantityResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 50 boxes",
      readyClient(),
      readyProduct(),
    )!;
    const first = buildQuantityResolutionRequestKey(descriptor);
    const second = buildQuantityResolutionRequestKey(descriptor);
    expect(first).toBe(second);
  });
});
