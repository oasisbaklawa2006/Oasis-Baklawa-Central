import { describe, expect, it } from "vitest";
import {
  buildClientResolutionFetchInput,
  buildClientResolutionRequestDescriptor,
  buildClientResolutionRequestKey,
  buildPacketContentFingerprint,
  clientResolutionStateMatchesRequestKey,
  projectClientResolutionDisplayState,
  resolveSenderIdentityForClientResolution,
  shouldScoreSenderPhoneForClientResolution,
  type ClientResolutionPacketSnapshot,
  type ClientResolutionSenderIdentitySnapshot,
} from "@/lib/wa-governance/clientResolutionRequestKey";
import {
  getCachedClientResolutionState,
  storeCachedClientResolutionResult,
} from "@/lib/wa-governance/clientResolutionResultCache";
import type { ClientResolutionResult } from "@/lib/wa-governance/clientResolutionTypes";
import { scoreClientResolutionCandidates } from "@/lib/wa-governance/clientResolutionScoring";
import type { CompanyResolutionRow } from "@/lib/wa-governance/clientResolutionTypes";
import type { SenderIdentityViewModel } from "@/lib/wa-governance/senderIdentityTypes";

const sampleResult = (): ClientResolutionResult => ({
  candidateClients: [
    {
      companyId: "c-a",
      companyName: "Packet A Client",
      ownerId: null,
      ownerName: null,
      confidence: 80,
      reasons: ["Match A"],
    },
  ],
  bestMatch: {
    companyId: "c-a",
    companyName: "Packet A Client",
    ownerId: null,
    ownerName: null,
    confidence: 80,
    reasons: ["Match A"],
  },
  band: "suggested",
});

const packet = (
  partial: Partial<ClientResolutionPacketSnapshot> & Pick<ClientResolutionPacketSnapshot, "id">,
): ClientResolutionPacketSnapshot => ({
  phone_number: "+919876543210",
  wa_contact_id: "wa-1",
  customer_name: "Alice",
  stitched_content: { plain: "Hello from HDFC Bank" },
  messages: [
    {
      id: "m-1",
      direction: "inbound",
      content: "Hello from HDFC Bank",
      created_at: "2026-06-01T10:00:00Z",
    },
  ],
  ...partial,
});

const readyEmployeeIdentity = (): ClientResolutionSenderIdentitySnapshot => ({
  status: "ready",
  kind: "employee",
  companyName: "Oasis HQ",
  customerName: null,
});

const readyCustomerIdentity = (
  companyName: string | null = "HDFC Bank",
): ClientResolutionSenderIdentitySnapshot => ({
  status: "ready",
  kind: "customer",
  companyName,
  customerName: "Alice",
});

function descriptorFor(
  packetSnapshot: ClientResolutionPacketSnapshot,
  identity: ClientResolutionSenderIdentitySnapshot,
  stitchedPlainText = "Hello from HDFC Bank",
) {
  const descriptor = buildClientResolutionRequestDescriptor(
    packetSnapshot,
    identity,
    stitchedPlainText,
  );
  if (!descriptor) throw new Error("expected descriptor");
  return descriptor;
}

describe("clientResolutionRequestKey", () => {
  it("includes WhatsApp contact metadata in the request key", () => {
    const base = descriptorFor(packet({ id: "p-1" }), readyCustomerIdentity());
    const phoneChanged = descriptorFor(
      packet({ id: "p-1", phone_number: "+919999999999" }),
      readyCustomerIdentity(),
    );
    const contactChanged = descriptorFor(
      packet({ id: "p-1", wa_contact_id: "wa-2" }),
      readyCustomerIdentity(),
    );
    const customerChanged = descriptorFor(
      packet({ id: "p-1", customer_name: "Bob" }),
      readyCustomerIdentity(),
    );

    const baseKey = buildClientResolutionRequestKey(base);
    expect(buildClientResolutionRequestKey(phoneChanged)).not.toBe(baseKey);
    expect(buildClientResolutionRequestKey(contactChanged)).not.toBe(baseKey);
    expect(buildClientResolutionRequestKey(customerChanged)).not.toBe(baseKey);
  });

  it("changes request key when waCompanyName changes", () => {
    const first = descriptorFor(packet({ id: "p-1" }), readyCustomerIdentity("Alpha Corp"));
    const second = descriptorFor(packet({ id: "p-1" }), readyCustomerIdentity("Beta Corp"));

    expect(buildClientResolutionRequestKey(first)).not.toBe(buildClientResolutionRequestKey(second));
  });

  it("uses distinct key values for identity error vs ready unknown", () => {
    const errorKey = buildClientResolutionRequestKey(
      descriptorFor(packet({ id: "p-1" }), { status: "error" }),
    );
    const unknownReadyKey = buildClientResolutionRequestKey(
      descriptorFor(packet({ id: "p-1" }), {
        status: "ready",
        kind: "unknown",
        companyName: null,
        customerName: null,
      }),
    );

    expect(errorKey).toContain("identity:error");
    expect(unknownReadyKey).toContain("identity:ready:unknown");
    expect(errorKey).not.toBe(unknownReadyKey);
  });

  it("does not show packet A ready result under packet B request key", () => {
    const packetAKey = buildClientResolutionRequestKey(
      descriptorFor(packet({ id: "packet-a" }), readyCustomerIdentity()),
    );
    const packetBKey = buildClientResolutionRequestKey(
      descriptorFor(packet({ id: "packet-b" }), readyCustomerIdentity()),
    );

    const staleReady = {
      status: "ready" as const,
      requestKey: packetAKey,
      result: sampleResult(),
    };

    expect(projectClientResolutionDisplayState(staleReady, packetBKey)).toEqual({
      status: "loading",
      requestKey: packetBKey,
    });
    expect(
      clientResolutionStateMatchesRequestKey(
        projectClientResolutionDisplayState(staleReady, packetBKey),
        packetBKey,
      ),
    ).toBe(true);
  });

  it("restores cached packet A result when returning to packet A", () => {
    const cache = new Map<string, ClientResolutionResult>();
    const packetAKey = buildClientResolutionRequestKey(
      descriptorFor(packet({ id: "packet-a" }), readyCustomerIdentity()),
    );

    storeCachedClientResolutionResult(cache, packetAKey, sampleResult());
    const restored = getCachedClientResolutionState(packetAKey, cache);

    expect(restored).toEqual({
      status: "ready",
      requestKey: packetAKey,
      result: sampleResult(),
    });
  });

  it("treats identity error as unknown for fetch input and sender phone scoring", () => {
    const descriptor = descriptorFor(packet({ id: "p-1" }), { status: "error" });
    const input = buildClientResolutionFetchInput(
      packet({ id: "p-1" }),
      descriptor,
      "Hello from HDFC Bank",
      null,
    );

    expect(input.senderIdentity?.kind).toBe("unknown");
    expect(shouldScoreSenderPhoneForClientResolution(input.senderIdentity ?? null)).toBe(true);

    const company: CompanyResolutionRow = {
      id: "c-phone",
      business_name: "Direct Customer Ltd",
      account_manager_id: null,
      phone: "+91 9876543210",
      gst_number: null,
      status: "active",
      registered_address: null,
    };

    const scored = scoreClientResolutionCandidates({
      signals: {
        combinedText: "",
        nameCandidates: [],
        gstNumbers: [],
        phoneLast10: [],
        orderReferences: [],
        numericCodes: [],
        locationTokens: [],
      },
      companies: [company],
      ownerProfiles: new Map(),
      senderPhoneLast10: "9876543210",
      senderIsEmployee: false,
    });

    expect(scored.bestMatch?.reasons.some((reason) => reason.includes("Sender phone ending"))).toBe(
      true,
    );
  });

  it("does not score sender phone for employee identity", () => {
    const descriptor = descriptorFor(packet({ id: "p-1" }), readyEmployeeIdentity());
    const employeeIdentity: SenderIdentityViewModel = {
      kind: "employee",
      confidence: 99,
      normalizedPhone: "+919876543210",
      employeeProfile: null,
      roleFromEdge: "staff",
      matchedVia: "users",
      contactId: null,
      customerName: null,
      companyName: "Oasis HQ",
      reason: null,
    };

    const input = buildClientResolutionFetchInput(
      packet({ id: "p-1" }),
      descriptor,
      "Hello",
      employeeIdentity,
    );

    expect(input.senderIdentity?.kind).toBe("employee");
    expect(shouldScoreSenderPhoneForClientResolution(input.senderIdentity ?? null)).toBe(false);
  });

  it("resolves identity error to unknown sender view model", () => {
    const resolved = resolveSenderIdentityForClientResolution({ status: "error" }, null);
    expect(resolved?.kind).toBe("unknown");
  });

  it("changes content fingerprint when stitched text changes", () => {
    const first = buildPacketContentFingerprint(
      packet({ id: "p-1" }).messages,
      "Hello from HDFC Bank",
    );
    const second = buildPacketContentFingerprint(
      packet({ id: "p-1" }).messages,
      "Completely different stitched body",
    );

    expect(first).not.toBe(second);
  });

  it("returns the same cached payload for an unchanged request key", () => {
    const cache = new Map<string, ClientResolutionResult>();
    const key = buildClientResolutionRequestKey(
      descriptorFor(packet({ id: "p-1" }), readyCustomerIdentity()),
    );
    const payload = sampleResult();

    storeCachedClientResolutionResult(cache, key, payload);
    const firstHit = getCachedClientResolutionState(key, cache);
    const secondHit = getCachedClientResolutionState(key, cache);

    expect(firstHit?.result).toBe(payload);
    expect(secondHit?.result).toBe(payload);
    expect(cache.has(key)).toBe(true);
  });
});
