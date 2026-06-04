import { describe, expect, it } from "vitest";
import {
  ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS,
  countFunctionsInvokeSlug,
  scanFunctionsInvokeSlugs,
} from "@/lib/wa-governance/stage1InvokeScan";

describe("stage1InvokeScan", () => {
  it("detects functions.invoke slugs from AST, not regex over comments", () => {
    const source = `
      // supabase.functions.invoke("fake-in-comment")
      const note = "functions.invoke(\\"string-literal\\")";
      async function send() {
        await client.functions.invoke("whatsapp-operator-reply", { body: {} });
        await client.functions.invoke("whatsapp-classify-intent", { body: {} });
      }
    `;

    expect(scanFunctionsInvokeSlugs(source, "fixture.ts").map((hit) => hit.slug)).toEqual([
      "whatsapp-operator-reply",
      "whatsapp-classify-intent",
    ]);
  });

  it("ignores invoke-like text inside comments and string literals", () => {
    const source = `
      // await supabase.functions.invoke("should-not-count")
      const doc = \`template with functions.invoke("ignored")\`;
    `;

    expect(scanFunctionsInvokeSlugs(source, "fixture.ts")).toEqual([]);
  });

  it("counts a specific slug occurrence", () => {
    const source = `
      await a.functions.invoke("whatsapp-operator-reply", {});
      await b.functions.invoke("whatsapp-route-packet", {});
      await c.functions.invoke("whatsapp-operator-reply", {});
    `;

    expect(countFunctionsInvokeSlug(source, "whatsapp-operator-reply", "fixture.ts")).toBe(2);
  });

  it("documents the WhatsApp inbox invoke allowlist", () => {
    expect([...ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS].sort()).toEqual(
      ["whatsapp-classify-intent", "whatsapp-operator-reply", "whatsapp-route-packet"].sort(),
    );
  });
});
