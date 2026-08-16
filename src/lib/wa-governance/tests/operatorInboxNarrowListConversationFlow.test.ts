import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

/**
 * Narrow/mobile must use a real list -> conversation flow, not the full
 * three-zone desktop UI stacked into one page (WHATSAPP_OPERATOR_WORKSPACE_CLOSURE.md,
 * "Required operator information architecture" / narrow-mobile section).
 */
describe("operator inbox narrow list -> conversation flow", () => {
  it("the packet list panel does not render once a packet is selected on narrow layouts", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("{!isNarrow || !selectedPacket ? (");
  });

  it("the conversation/detail panel only renders when a packet is selected, or on wide layouts as an empty state", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("{selectedPacket ? (");
    expect(inbox).toContain(") : !isNarrow ? (");
    // Narrow layouts with nothing selected show the list (handled by the
    // sibling block above) instead of a redundant empty conversation pane.
    expect(inbox).toContain("list -> conversation flow) — no redundant empty pane.");
  });

  it("the narrow Back to inbox control clears the selected packet (real navigation), not just a scroll", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const backButtonIndex = inbox.indexOf("data-operator-inbox-back-to-list");
    expect(backButtonIndex).toBeGreaterThan(-1);
    const backButtonBlock = inbox.slice(backButtonIndex, inbox.indexOf("Back to inbox", backButtonIndex) + 40);
    expect(backButtonBlock).toContain("setSelectedPacket(null);");
    expect(backButtonBlock).not.toMatch(/scrollIntoView/);
  });

  it("the composer remains marked and reachable in the single-pane conversation view (no regression to composer visibility)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const detailRegionIndex = inbox.indexOf("{selectedPacket ? (");
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer", detailRegionIndex);
    expect(composerIndex).toBeGreaterThan(detailRegionIndex);
  });
});
