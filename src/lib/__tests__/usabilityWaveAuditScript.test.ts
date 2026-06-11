import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const AUDIT_SCRIPT = join(import.meta.dirname, "../../../scripts/usability-wave-audit.mjs");

describe("usability-wave-audit.mjs", () => {
  const source = readFileSync(AUDIT_SCRIPT, "utf8");

  it("queries whatsapp_message_packets (inbox table), not whatsapp_packets", () => {
    expect(source).toContain("whatsapp_message_packets");
    expect(source).not.toMatch(/["']whatsapp_packets["']/);
    expect(source).toContain("whatsapp_message_packets_sample_count");
  });
});
