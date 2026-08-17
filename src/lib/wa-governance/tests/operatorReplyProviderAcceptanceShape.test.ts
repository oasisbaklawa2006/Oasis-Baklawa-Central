import { describe, expect, it } from "vitest";
import { selectClick2ApiProviderMessageId } from "../../../../supabase/functions/_shared/whatsappProviderAcceptance";

describe("Click2API provider acceptance response shapes", () => {
  it("selects the nested queue_id shape observed during physical staging", () => {
    const providerId = selectClick2ApiProviderMessageId({
      messaging_channel: "whatsapp",
      message: {
        queue_id: "queue-physical-staging-1",
        message_status: "queued",
      },
    });

    expect(providerId).toBe("queue-physical-staging-1");
  });

  it.each([
    [{ message_id: "top-message" }, "top-message"],
    [{ id: "top-id" }, "top-id"],
    [{ queue_id: "top-queue" }, "top-queue"],
    [{ message: { message_id: "nested-message" } }, "nested-message"],
    [{ message: { id: "nested-id" } }, "nested-id"],
  ])("retains support for provider acceptance shape %#", (payload, expected) => {
    expect(selectClick2ApiProviderMessageId(payload)).toBe(expected);
  });

  it("fails closed when a successful-looking body contains no provider identifier", () => {
    expect(selectClick2ApiProviderMessageId({ message: { message_status: "queued" } })).toBeNull();
    expect(selectClick2ApiProviderMessageId(null)).toBeNull();
  });
});
