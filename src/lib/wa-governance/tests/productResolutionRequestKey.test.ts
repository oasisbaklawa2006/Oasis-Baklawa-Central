import { describe, expect, it } from "vitest";
import {
  buildProductResolutionRequestDescriptor,
  buildProductResolutionRequestKey,
  projectProductResolutionDisplayState,
  productResolutionStateMatchesRequestKey,
  serializeClientResolutionBestMatch,
} from "@/lib/wa-governance/productResolutionRequestKey";
import type { OperatorInboxClientResolutionState } from "@/lib/wa-governance/clientResolutionRequestKey";
import type { ProductResolutionResult } from "@/lib/wa-governance/productResolutionTypes";

const sampleResult = (): ProductResolutionResult => ({
  candidateProducts: [
    {
      productId: "p-a",
      productName: "Packet A Product",
      sku: "A-1",
      confidence: 88,
      reasons: ["Match A"],
    },
  ],
  bestMatch: {
    productId: "p-a",
    productName: "Packet A Product",
    sku: "A-1",
    confidence: 88,
    reasons: ["Match A"],
  },
  band: "suggested",
});

const packet = (id: string) => ({
  id,
  phone_number: "+919876543210",
  wa_contact_id: "wa-1",
  customer_name: "Alice",
  stitched_content: { plain: "Need 25 baklava tins" },
  messages: [
    {
      id: "m-1",
      direction: "inbound" as const,
      content: "Need 25 baklava tins",
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

const readyClient = (
  companyId = "c-1",
  companyName = "HDFC Bank",
): OperatorInboxClientResolutionState => ({
  status: "ready",
  requestKey: "client-key",
  result: {
    candidateClients: [],
    bestMatch: {
      companyId,
      companyName,
      ownerId: null,
      ownerName: null,
      confidence: 96,
      reasons: [],
    },
    band: "auto_highlight",
  },
});

describe("productResolutionRequestKey", () => {
  it("includes client resolution best match in the request key", () => {
    const first = buildProductResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 25 baklava tins",
      readyClient("c-1", "Alpha Corp"),
    );
    const second = buildProductResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 25 baklava tins",
      readyClient("c-2", "Beta Corp"),
    );

    expect(buildProductResolutionRequestKey(first!)).not.toBe(
      buildProductResolutionRequestKey(second!),
    );
  });

  it("changes key when content fingerprint changes", () => {
    const first = buildProductResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 25 baklava tins",
      readyClient(),
    );
    const second = buildProductResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 50 chocolate trays",
      readyClient(),
    );

    expect(buildProductResolutionRequestKey(first!)).not.toBe(
      buildProductResolutionRequestKey(second!),
    );
  });

  it("does not show packet A ready result under packet B request key", () => {
    const packetAKey = buildProductResolutionRequestKey(
      buildProductResolutionRequestDescriptor(
        packet("packet-a"),
        readyIdentity,
        "Need 25 baklava tins",
        readyClient(),
      )!,
    );
    const packetBKey = buildProductResolutionRequestKey(
      buildProductResolutionRequestDescriptor(
        packet("packet-b"),
        readyIdentity,
        "Need 25 baklava tins",
        readyClient(),
      )!,
    );

    const staleReady = {
      status: "ready" as const,
      requestKey: packetAKey,
      result: sampleResult(),
    };

    expect(projectProductResolutionDisplayState(staleReady, packetBKey)).toEqual({
      status: "loading",
      requestKey: packetBKey,
    });
    expect(productResolutionStateMatchesRequestKey(staleReady, packetBKey)).toBe(false);
  });

  it("serializes pending and error client resolution segments distinctly", () => {
    expect(
      serializeClientResolutionBestMatch({ status: "loading", requestKey: "rk" }),
    ).toBe("client:pending");
    expect(
      serializeClientResolutionBestMatch({ status: "error", requestKey: "rk", message: "x" }),
    ).toBe("client:error");
    expect(serializeClientResolutionBestMatch(readyClient())).toBe("client:c-1:HDFC Bank");
  });

  it("uses stable key for unchanged upstream inputs", () => {
    const descriptor = buildProductResolutionRequestDescriptor(
      packet("p-1"),
      readyIdentity,
      "Need 25 baklava tins",
      readyClient(),
    )!;
    const first = buildProductResolutionRequestKey(descriptor);
    const second = buildProductResolutionRequestKey(descriptor);
    expect(first).toBe(second);
  });
});
