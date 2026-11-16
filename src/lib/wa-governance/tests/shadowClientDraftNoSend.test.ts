import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/components/warroom/ShadowClientSection.tsx"),
  "utf8",
);

describe("WA-100 Shadow Client draft recipient safety", () => {
  it("preserves the authorized draft creation call", () => {
    expect(source).toContain('supabase.functions.invoke("admin-create-draft"');
    expect(source).toContain("company_id: editingCompany.id");
    expect(source).toContain("sku_items: skuItems");
  });

  it("never sends the shadow client's arbitrary phone to a legacy WhatsApp endpoint", () => {
    expect(source).not.toContain("send_whatsapp_to");
    expect(source).not.toContain("whatsapp_message");
    expect(source).not.toContain('supabase.functions.invoke("send-whatsapp"');
  });

  it("states that WhatsApp was not sent, separately from draft success", () => {
    expect(source).toContain(
      "WhatsApp not sent: recipient consent and protected notification authority are pending.",
    );
    expect(source).toContain("is now queued for governance approval");
  });
});
