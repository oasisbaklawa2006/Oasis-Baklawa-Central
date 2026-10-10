import { describe, expect, it, vi, beforeEach } from "vitest";
import { submitSalesSupportTicket } from "../salesSupportHandoff";

vi.mock("@/lib/customerApp/customerAppClient", () => ({
  customerAppClient: {
    submitTicket: vi.fn(async () => "ticket-abc"),
  },
}));

describe("submitSalesSupportTicket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submits via governed Core RPC client", async () => {
    const { customerAppClient } = await import("@/lib/customerApp/customerAppClient");
    const ticketId = await submitSalesSupportTicket({
      orderId: "order-1",
      issueType: "Delivery delay",
      description: "Customer reports late dispatch for this order.",
    });
    expect(ticketId).toBe("ticket-abc");
    expect(customerAppClient.submitTicket).toHaveBeenCalledWith(
      "order-1",
      "Delivery delay",
      "Customer reports late dispatch for this order.",
    );
  });

  it("rejects missing order or short description", async () => {
    await expect(
      submitSalesSupportTicket({ orderId: "", issueType: "Other", description: "too short" }),
    ).rejects.toThrow(/required/i);
    await expect(
      submitSalesSupportTicket({ orderId: "order-1", issueType: "", description: "valid length text" }),
    ).rejects.toThrow(/required/i);
  });
});
