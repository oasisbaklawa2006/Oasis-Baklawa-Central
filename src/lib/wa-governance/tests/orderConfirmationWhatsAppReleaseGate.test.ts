import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const orderPageSource = readFileSync(
  new URL("../../../pages/admin/OrderManagement.tsx", import.meta.url),
  "utf8",
);

describe("WA-100: Central order confirmation fail-closed WhatsApp gate", () => {
  it("does not invoke the legacy sender on either order transition", () => {
    expect(orderPageSource).not.toContain(
      'supabase.functions.invoke("send-whatsapp"',
    );
  });

  it("preserves governed credit and prepaid transitions", () => {
    expect(orderPageSource).toContain(
      'await releaseOrderToInProduction(orderId, "on_credit")',
    );
    expect(orderPageSource).toContain(
      "await confirmPrepaidOrderAwaitingAdvance(orderId)",
    );
  });

  it("clearly warns staff that no message was sent or queued", () => {
    expect(
      orderPageSource.match(/WhatsApp not sent: recipient authorization/g),
    ).toHaveLength(2);
    expect(orderPageSource).not.toContain(
      'toast.success("WhatsApp notification queued"',
    );
  });
});
