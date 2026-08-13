import { describe, expect, it } from "vitest";
import { normalizeWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";

describe("normalizeWhatsAppPermissions", () => {
  it("accepts only Core-defined WhatsApp capabilities", () => {
    const result = normalizeWhatsAppPermissions(["wa.intake.read", "wa.draft.promote", "wa.reply.send", "admin", null]);
    expect([...result]).toEqual(["wa.intake.read", "wa.draft.promote", "wa.reply.send"]);
  });

  it("fails closed for malformed authority responses", () => {
    expect([...normalizeWhatsAppPermissions(null)]).toEqual([]);
    expect([...normalizeWhatsAppPermissions({ permission: "wa.intake.read" })]).toEqual([]);
  });
});
