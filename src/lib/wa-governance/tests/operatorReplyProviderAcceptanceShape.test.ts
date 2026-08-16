import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(import.meta.dirname, "../../../..");
const REPLY_FUNCTION = join(REPO_ROOT, "supabase/functions/whatsapp-operator-reply/index.ts");

function readReplyFunction(): string {
  return readFileSync(REPLY_FUNCTION, "utf8");
}

describe("Click2API provider acceptance response shapes", () => {
  it("accepts the nested queue_id shape observed during physical staging", () => {
    const source = readReplyFunction();
    expect(source).toContain("providerMessage.queue_id");
    expect(source).toContain("providerBody?.message");
  });

  it("retains support for the earlier top-level acceptance identifiers", () => {
    const source = readReplyFunction();
    expect(source).toContain("providerBody.message_id");
    expect(source).toContain("providerBody.id");
    expect(source).toContain("providerBody.queue_id");
  });
});
