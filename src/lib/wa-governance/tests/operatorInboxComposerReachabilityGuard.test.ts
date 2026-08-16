import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

describe("operator inbox composer reachability guardrail (narrow/mobile)", () => {
  it("the insights aside defaults to collapsed on narrow layouts so the composer is immediately visible", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("if (insightsAsideUserCollapsed) return;");
    expect(inbox).toContain("setInsightsAsideExpanded(!isNarrow);");
  });

  it("the insights aside is height-bounded and independently scrollable on every breakpoint", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const asideMarkerIndex = inbox.indexOf("data-operator-inbox-local-insights");
    expect(asideMarkerIndex).toBeGreaterThan(-1);
    const asideClassName = inbox.slice(asideMarkerIndex, inbox.indexOf("</aside", asideMarkerIndex));
    expect(asideClassName).toMatch(/className="[^"]*\bmax-h-\[45vh\]/);
    expect(asideClassName).toMatch(/className="[^"]*\boverflow-y-auto\b/);
  });

  it("the governed reply composer is sticky at the visual bottom and outside the insights aside", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer");
    const asideIndex = inbox.indexOf("data-operator-inbox-local-insights");
    expect(composerIndex).toBeGreaterThan(-1);
    expect(composerIndex).toBeLessThan(asideIndex);
    const composerOpening = inbox.slice(composerIndex, composerIndex + 220);
    expect(composerOpening).toContain("sticky bottom-0");
    expect(composerOpening).toContain("shrink-0");
  });

  it("exposes native focusable input and Send button with visible keyboard focus treatment", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer");
    const composerBlock = inbox.slice(composerIndex, inbox.indexOf("data-operator-inbox-local-insights", composerIndex));
    expect(composerBlock).toContain('<input\n                      type="text"');
    expect(composerBlock).toContain('aria-label="Operator reply message draft"');
    expect(composerBlock).toContain('aria-label="Send WhatsApp reply"');
    expect(composerBlock).toContain("focus-visible:ring-2");
    expect(composerBlock).not.toContain('tabIndex={-1}');
  });

  it("the Send control and input remain gated by wa.reply.send and governedContextError", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer");
    const composerBlock = inbox.slice(composerIndex, inbox.indexOf("Send WhatsApp reply") + 80);
    expect(composerBlock).toContain('whatsappAuthority.has("wa.reply.send")');
    expect(composerBlock).toContain("Boolean(governedContextError)");
  });
});
