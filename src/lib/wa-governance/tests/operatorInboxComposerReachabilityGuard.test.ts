import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

/**
 * Gate E/G regression guard.
 *
 * Root cause (proven by structural read of the component): on narrow/mobile
 * layouts, the read-only insights aside (a stack of governed AI/resolution
 * panels) defaulted to expanded and had NO height bound outside the `lg:`
 * breakpoint. Because the aside sat `shrink-0` inside the same flex column as
 * the message timeline + reply composer, and the whole detail region is
 * clipped to a fixed 100dvh viewport with no outer scroll, a tall aside could
 * squeeze the composer down to zero visible height — reproducing "no
 * discoverable/reachable operator reply composer" during physical mobile
 * testing, even though the governed whatsapp-operator-reply wiring was
 * already correct and present in the same file.
 */
describe("operator inbox composer reachability guardrail (narrow/mobile)", () => {
  it("the insights aside defaults to collapsed on narrow layouts so the composer is immediately visible, unless the operator explicitly expanded it", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("if (insightsAsideUserCollapsed) return;");
    expect(inbox).toContain("setInsightsAsideExpanded(!isNarrow);");
  });

  it("the insights aside is height-bounded and independently scrollable on every breakpoint, not just lg:", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const asideMarkerIndex = inbox.indexOf("data-operator-inbox-local-insights");
    expect(asideMarkerIndex).toBeGreaterThan(-1);
    const asideClassName = inbox.slice(asideMarkerIndex, inbox.indexOf("</aside", asideMarkerIndex));
    // Base (mobile-first) classes must bound height and allow independent scroll —
    // previously these constraints only existed behind the lg: breakpoint.
    expect(asideClassName).toMatch(/className="[^"]*\bmax-h-\[45vh\]/);
    expect(asideClassName).toMatch(/className="[^"]*\boverflow-y-auto\b/);
  });

  it("the governed reply composer is marked and lives in the message column, not inside the insights aside", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer");
    const asideIndex = inbox.indexOf("data-operator-inbox-local-insights");
    expect(composerIndex).toBeGreaterThan(-1);
    expect(asideIndex).toBeGreaterThan(-1);
    // The composer must appear before the insights aside in DOM order (same
    // message-column flex child, ahead of the separate aside sibling) so it is
    // never a descendant of the (independently scrollable, collapsible) aside.
    expect(composerIndex).toBeLessThan(asideIndex);
  });

  it("the composer's Send control and input remain gated by wa.reply.send and governedContextError (no regression to fail-closed reply gating)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer");
    const composerBlock = inbox.slice(composerIndex, inbox.indexOf("Send WhatsApp reply") + 40);
    expect(composerBlock).toContain('whatsappAuthority.has("wa.reply.send")');
    expect(composerBlock).toContain("Boolean(governedContextError)");
  });
});
