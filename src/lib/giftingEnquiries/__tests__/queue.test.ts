import { describe, expect, it, vi } from "vitest";
import {
  GiftingQueueError,
  classifyGiftingQueueError,
  listGiftingEnquiries,
  setGiftingEnquiryStatus,
  type GiftingQueueRpcClient,
} from "../queue";

const row = {
  id: "11111111-1111-1111-1111-111111111111",
  kind: "corporate",
  name: "Synthetic Buyer",
  company: "",
  email: "buyer@example.invalid",
  phone: null,
  message: "200 boxes",
  source: "business-page",
  marketing_consent: false,
  status: "received",
  receipt_count: 2,
  environment: "staging",
  first_received_at: "2026-11-19T10:00:00Z",
  last_received_at: "2026-11-19T10:05:00Z",
  status_changed_at: null,
};

const client = (result: { data: unknown; error: { message?: string; code?: string } | null }) => {
  const rpc = vi.fn().mockResolvedValue(result);
  return { rpc, api: { rpc } as unknown as GiftingQueueRpcClient };
};

describe("listGiftingEnquiries", () => {
  it("calls the Core RPC with explicit paging and maps rows to the UI model", async () => {
    const { rpc, api } = client({ data: [row], error: null });
    const result = await listGiftingEnquiries(api, { status: "received", limit: 20, offset: 40 });
    expect(rpc).toHaveBeenCalledWith("gifting_enquiry_queue_list_v1", { p_status: "received", p_limit: 20, p_offset: 40 });
    expect(result).toEqual([
      expect.objectContaining({
        id: row.id,
        company: null, // empty string is normalised to null
        phone: null,
        marketingConsent: false,
        receiptCount: 2,
        firstReceivedAt: row.first_received_at,
        statusChangedAt: null,
      }),
    ]);
  });

  it("defaults to all statuses with a bounded page", async () => {
    const { rpc, api } = client({ data: [], error: null });
    await listGiftingEnquiries(api);
    expect(rpc).toHaveBeenCalledWith("gifting_enquiry_queue_list_v1", { p_status: null, p_limit: 50, p_offset: 0 });
  });

  it("rejects malformed rows instead of rendering partial personal data", async () => {
    for (const bad of [{ ...row, status: "deleted" }, { ...row, marketing_consent: "no" }, { ...row, id: 5 }, null]) {
      const { api } = client({ data: [bad], error: null });
      await expect(listGiftingEnquiries(api)).rejects.toMatchObject({ kind: "unavailable" });
    }
    const { api } = client({ data: { not: "an array" }, error: null });
    await expect(listGiftingEnquiries(api)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("classifies Core errors and never exposes backend text", async () => {
    const forbidden = client({ data: null, error: { message: "GIFTING_QUEUE_FORBIDDEN", code: "42501" } });
    await expect(listGiftingEnquiries(forbidden.api)).rejects.toMatchObject({ kind: "forbidden" });
    const down = client({ data: null, error: { message: "connection to db-secret.internal refused", code: "08006" } });
    const error = await listGiftingEnquiries(down.api).catch((e) => e);
    expect(error).toBeInstanceOf(GiftingQueueError);
    expect(error.kind).toBe("unavailable");
    expect(String(error.message)).not.toContain("db-secret");
  });
});

describe("setGiftingEnquiryStatus", () => {
  it("sends the enquiry id and status and returns the confirmed state", async () => {
    const { rpc, api } = client({ data: { id: row.id, status: "triaged", statusChangedAt: "2026-11-19T11:00:00Z" }, error: null });
    await expect(setGiftingEnquiryStatus(api, row.id, "triaged")).resolves.toEqual({
      id: row.id,
      status: "triaged",
      statusChangedAt: "2026-11-19T11:00:00Z",
    });
    expect(rpc).toHaveBeenCalledWith("gifting_enquiry_queue_set_status_v1", { p_enquiry_id: row.id, p_status: "triaged" });
  });

  it("does not trust an unconfirmed or malformed response", async () => {
    for (const data of [null, {}, { id: row.id, status: "weird" }]) {
      const { api } = client({ data, error: null });
      await expect(setGiftingEnquiryStatus(api, row.id, "closed")).rejects.toMatchObject({ kind: "unavailable" });
    }
  });

  it("classifies forbidden, invalid and not-found", async () => {
    expect(classifyGiftingQueueError({ code: "42501" }).kind).toBe("forbidden");
    expect(classifyGiftingQueueError({ message: "GIFTING_QUEUE_INVALID" }).kind).toBe("invalid");
    expect(classifyGiftingQueueError({ code: "P0002" }).kind).toBe("not_found");
    expect(classifyGiftingQueueError({ message: "boom" }).kind).toBe("unavailable");
  });
});
