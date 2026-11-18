import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import { fetchPacketById } from "@/components/whatsapp/operatorInboxPacketsLoader";
import { findOperatorInboxSourcePackets, OperatorInboxSourceHandoff } from
  "@/components/whatsapp/OperatorInboxSourceHandoff";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));
vi.mock("@/components/whatsapp/operatorInboxPacketsLoader", () => ({
  fetchPacketById: vi.fn(),
}));

const PACKET = "00000000-0000-4000-8000-000000000001";
const ANOTHER_PACKET = "00000000-0000-4000-8000-000000000002";

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(cleanup);

describe("governed Operator Inbox source handoff", () => {
  it("resolves an exact provider message ID to its governed packet without a department task", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ packet_id: PACKET }], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
    vi.mocked(fetchPacketById).mockResolvedValue({
      id: PACKET,
      contact_id: "contact-1",
      fragment_count: 1,
      status: "open",
      first_message_at: "2026-11-18T08:00:00Z",
      last_message_at: "2026-11-18T09:00:00Z",
      stitched_content: null,
      phone_number: "+919876543210",
      customer_name: "Example Bakery",
    });

    const packets = await findOperatorInboxSourcePackets("provider", "wamid.test.123");
    expect(supabase.from).toHaveBeenCalledWith("whatsapp_messages");
    expect(query.eq).toHaveBeenCalledWith("provider_message_id", "wamid.test.123");
    expect(fetchPacketById).toHaveBeenCalledWith(PACKET);
    expect(packets).toEqual([{
      id: PACKET, customer: "Example Bakery", phone: "+919876543210",
      lastMessageAt: "2026-11-18T09:00:00Z", status: "open",
    }]);
  });

  it("lists all available matching packets for a phone and requires the operator to choose", async () => {
    const contacts = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [{ id: "contact-1", phone_number: "+919876543210", customer_name: "Example Bakery" }],
        error: null,
      }),
    };
    const packets = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({
        data: [
          { id: PACKET, contact_id: "contact-1", status: "open", last_message_at: "2026-11-18T09:00:00Z" },
          { id: ANOTHER_PACKET, contact_id: "contact-1", status: "closed", last_message_at: "2026-11-17T09:00:00Z" },
        ],
        error: null,
      }),
    };
    vi.mocked(supabase.from).mockImplementation((table) =>
      (String(table) === "whatsapp_contacts" ? contacts : packets) as unknown as ReturnType<typeof supabase.from>,
    );
    const results = await findOperatorInboxSourcePackets("phone", "9876543210");
    expect(contacts.in).toHaveBeenCalledWith("phone_number", expect.arrayContaining(["+919876543210"]));
    expect(packets.in).toHaveBeenCalledWith("contact_id", ["contact-1"]);
    expect(results.map((p) => p.id)).toEqual([PACKET, ANOTHER_PACKET]);
  });

  it("renders a packet-specific link to the existing reader-accessible Inbox route", async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [{ packet_id: PACKET }], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(query as unknown as ReturnType<typeof supabase.from>);
    vi.mocked(fetchPacketById).mockResolvedValue({
      id: PACKET,
      contact_id: "contact-1",
      fragment_count: 1,
      status: "open",
      first_message_at: "2026-11-18T08:00:00Z",
      last_message_at: "2026-11-18T09:00:00Z",
      stitched_content: null,
      customer_name: "Example Bakery",
    });

    render(<MemoryRouter><OperatorInboxSourceHandoff /></MemoryRouter>);
    fireEvent.click(screen.getByText("Find a conversation without a department task"));
    fireEvent.change(screen.getByRole("textbox", { name: "Exact provider message ID" }), {
      target: { value: "wamid.test.123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Find packets" }));
    await waitFor(() => expect(screen.getByRole("link", { name: "Review this packet" }))
      .toHaveAttribute("href", `/admin/operator-inbox?packet=${PACKET}`));
  });

  it("fails closed for invalid phone input and does not query customer data", async () => {
    await expect(findOperatorInboxSourcePackets("phone", "123")).rejects.toThrow("8–15 digits");
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
