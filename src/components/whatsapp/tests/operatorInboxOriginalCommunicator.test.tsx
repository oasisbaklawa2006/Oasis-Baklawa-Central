// MC#629 activation repair: OperatorInboxCommercialLayers' ORIGINAL_COMMUNICATOR
// confirmation control. Covers the real defects fixed here: silent prefill
// from SUBMITTING_SENDER, a default verification method, a hand-typed
// canonical party UUID with no search, and an UNKNOWN path that must not
// quietly satisfy the separate commercial-customer gate.
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OperatorInboxCommercialLayers } from "@/components/whatsapp/OperatorInboxCommercialLayers";
import type { WhatsAppCaseDecisionSnapshot } from "@/lib/wa-governance/caseDecisionDesk";
import type { WhatsAppCasePartyCandidate } from "@/lib/wa-governance/caseCommercialLayers";

const hasMock = vi.fn((_permission: string) => true);

vi.mock("@/hooks/useWhatsAppPermissions", () => ({
  useWhatsAppPermissions: () => ({
    permissions: new Set(["wa.intake.triage"]),
    loading: false,
    error: null,
    has: hasMock,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));

const fetchWhatsAppCommercialLayersMock = vi.fn(async () => ({
  caseId: "case-1",
  requestedLines: [],
  interpretations: [],
  proposedChanges: [],
  confirmations: [],
  handoffs: [],
  paymentProofs: [],
}));
const fetchWhatsAppCaseInboundMessagesMock = vi.fn(async () => []);

vi.mock("@/lib/wa-governance/caseDecisionDesk", () => ({
  fetchWhatsAppCaseInboundMessages: (...args: Parameters<typeof fetchWhatsAppCaseInboundMessagesMock>) =>
    fetchWhatsAppCaseInboundMessagesMock(...args),
}));

const confirmWhatsAppOriginalCommunicatorMock = vi.fn(async () => ({}));
const searchWhatsAppCasePartiesMock = vi.fn(async (): Promise<WhatsAppCasePartyCandidate[]> => []);

vi.mock("@/lib/wa-governance/caseCommercialLayers", () => ({
  fetchWhatsAppCommercialLayers: (...args: Parameters<typeof fetchWhatsAppCommercialLayersMock>) =>
    fetchWhatsAppCommercialLayersMock(...args),
  confirmWhatsAppOriginalCommunicator: (...args: Parameters<typeof confirmWhatsAppOriginalCommunicatorMock>) =>
    confirmWhatsAppOriginalCommunicatorMock(...args),
  searchWhatsAppCaseParties: (...args: Parameters<typeof searchWhatsAppCasePartiesMock>) =>
    searchWhatsAppCasePartiesMock(...args),
  proposeWhatsAppCaseChange: vi.fn(),
  decideWhatsAppCaseProposedChange: vi.fn(),
  acceptWhatsAppCaseHandoff: vi.fn(),
  releaseReviewedWhatsAppCaseReply: vi.fn(),
  newWhatsAppCaseCommercialActionKey: (prefix: string, caseId: string) => `${prefix}:${caseId}:test-key`,
}));

function baseSnapshot(identities: Record<string, unknown>[]): WhatsAppCaseDecisionSnapshot {
  return {
    packetId: "packet-1",
    communicationCase: {
      id: "case-1",
      packet_id: "packet-1",
      case_type: "ORDER",
      status: "NEEDS_IDENTITY",
      company_id: null,
      sales_order_draft_id: null,
      accountable_team: null,
      accountable_owner_id: null,
      accountability_status: "UNASSIGNED",
      next_action: null,
      next_action_due_at: null,
      rule_version: "v1",
      closed_at: null,
    },
    latestAi: null,
    identities,
    recipientAuthorizations: [],
    outboundDecisions: [],
  } as unknown as WhatsAppCaseDecisionSnapshot;
}

const forwardingSenderIdentity = {
  identity_role: "SUBMITTING_SENDER",
  party_type: "EMPLOYEE",
  party_id: "employee-123",
  display_label: "Dispatch Employee",
  phone_e164: "+919800000001",
};

async function renderLayers(identities: Record<string, unknown>[]) {
  const result = render(
    <OperatorInboxCommercialLayers
      packetId="packet-1"
      snapshot={baseSnapshot(identities)}
      onReload={vi.fn(async () => {})}
    />,
  );
  await waitFor(() => expect(fetchWhatsAppCommercialLayersMock).toHaveBeenCalled());
  return result;
}

async function openOriginalCommunicatorPanel() {
  const summary = screen.getByText("Original human communicator");
  fireEvent.click(summary);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  hasMock.mockReturnValue(true);
});

describe("OperatorInboxCommercialLayers — ORIGINAL_COMMUNICATOR confirmation (MC#629)", () => {
  it("never silently prefills the original communicator from SUBMITTING_SENDER (forwarded-order case)", async () => {
    await renderLayers([forwardingSenderIdentity]);
    await openOriginalCommunicatorPanel();

    // The employee's transport identity must not appear as a pre-filled
    // original-communicator label/phone anywhere in the confirmation form.
    expect(screen.queryByDisplayValue("Dispatch Employee")).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue("+919800000001")).not.toBeInTheDocument();

    // No verification method is defaulted; the operator must choose one.
    const methodSelect = screen.getByDisplayValue("Select verification method…") as HTMLSelectElement;
    expect(methodSelect.value).toBe("");
  });

  it("requires an explicit action and evidence before treating the sender as the original communicator (direct message)", async () => {
    await renderLayers([forwardingSenderIdentity]);
    await openOriginalCommunicatorPanel();

    fireEvent.click(screen.getByText("Same person sent this directly (requires evidence below)"));
    expect(screen.getByDisplayValue("Dispatch Employee")).toBeInTheDocument();

    const confirmButton = screen.getByText("Confirm original communicator");
    expect(confirmButton).toBeDisabled(); // evidence not yet typed

    fireEvent.change(screen.getByPlaceholderText(/Evidence: direct message/), {
      target: { value: "Operator read the WhatsApp text directly from this number." },
    });
    await waitFor(() => expect(confirmButton).not.toBeDisabled());
  });

  it("lets the operator search and select a real party instead of typing a UUID (staff intermediary / mismatched-party case)", async () => {
    searchWhatsAppCasePartiesMock.mockResolvedValueOnce([
      { id: "contact-9", partyType: "CONTACT", displayLabel: "Real Customer Contact", phone: "+919800000099", companyId: "company-9", companyName: "Real Customer Co" },
    ]);
    await renderLayers([forwardingSenderIdentity]);
    await openOriginalCommunicatorPanel();

    // No raw UUID text box exists at all.
    expect(screen.queryByPlaceholderText("Canonical party UUID")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search name / phone…"), { target: { value: "Real Customer" } });
    fireEvent.click(screen.getByText("Search"));

    await waitFor(() => expect(screen.getByText(/Real Customer Contact/)).toBeInTheDocument());
    fireEvent.click(screen.getByText(/Real Customer Contact/));

    expect(await screen.findByText(/Selected: Real Customer Contact/)).toBeInTheDocument();
    expect(searchWhatsAppCasePartiesMock).toHaveBeenCalledWith(expect.anything(), "CONTACT", "Real Customer");
  });

  it("keeps UNKNOWN from satisfying the commercial-customer gate and does not require a party id for it", async () => {
    await renderLayers([forwardingSenderIdentity]);
    await openOriginalCommunicatorPanel();

    fireEvent.change(screen.getByDisplayValue("Contact"), { target: { value: "UNKNOWN" } });
    expect(screen.getByText(/UNKNOWN does not satisfy the separate commercial-customer verification gate/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search name / phone…")).not.toBeInTheDocument();
  });

  it("disables confirmation for an operator without wa.intake.triage", async () => {
    hasMock.mockReturnValue(false);
    await renderLayers([forwardingSenderIdentity]);
    await openOriginalCommunicatorPanel();

    fireEvent.change(screen.getByPlaceholderText("Original communicator name / label"), { target: { value: "Someone" } });
    fireEvent.change(screen.getByPlaceholderText(/Evidence: direct message/), { target: { value: "Some evidence" } });
    expect(screen.getByText("Confirm original communicator")).toBeDisabled();
  });

  it("shows the real confirmed identity and does not render the form once already confirmed", async () => {
    await renderLayers([
      forwardingSenderIdentity,
      { identity_role: "ORIGINAL_COMMUNICATOR", display_label: "Confirmed Customer Contact" },
    ]);
    await openOriginalCommunicatorPanel();

    expect(screen.getByText(/Confirmed separately: Confirmed Customer Contact/)).toBeInTheDocument();
    expect(screen.queryByText("Confirm original communicator")).not.toBeInTheDocument();
  });
});
