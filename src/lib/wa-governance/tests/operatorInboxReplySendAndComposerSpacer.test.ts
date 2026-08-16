import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

function readInboxSource(): string {
  return readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
}

function sliceHandleSendReply(inbox: string): string {
  const start = inbox.indexOf("const handleSendReply = useCallback");
  expect(start).toBeGreaterThan(-1);
  const end = inbox.indexOf("const handleClassifyIntent = useCallback", start);
  expect(end).toBeGreaterThan(start);
  return inbox.slice(start, end);
}

describe("WhatsApp reply send no longer holds the spinner through the background reload", () => {
  it("reloads packets in the background instead of blocking on the reply invoke result", () => {
    const handler = sliceHandleSendReply(readInboxSource());
    expect(handler).not.toContain("await loadPackets({ silent: true })");
    expect(handler.match(/void loadPackets\(\{ silent: true \}\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it("stops the spinner via finally rather than waiting on the reload", () => {
    const handler = sliceHandleSendReply(readInboxSource());
    const finallyIndex = handler.lastIndexOf("finally {");
    expect(finallyIndex).toBeGreaterThan(-1);
    const finallyBlock = handler.slice(finallyIndex, finallyIndex + 120);
    expect(finallyBlock).toContain("setReplySending(false)");
  });
});

describe("WhatsApp reply send has a bounded client-side watchdog", () => {
  it("races the invoke against a bounded timeout instead of awaiting it unconditionally", () => {
    const inbox = readInboxSource();
    expect(inbox).toContain("const REPLY_SEND_WATCHDOG_MS = ");
    const handler = sliceHandleSendReply(inbox);
    expect(handler).toContain("Promise.race([invokePromise, watchdogPromise])");
  });

  it("on watchdog timeout, stops the spinner and shows packet-scoped pending feedback without resending", () => {
    const handler = sliceHandleSendReply(readInboxSource());
    const timeoutBranchStart = handler.indexOf("if (raced === watchdogTimeout)");
    expect(timeoutBranchStart).toBeGreaterThan(-1);
    const timeoutBranchEnd = handler.indexOf("return;", timeoutBranchStart);
    const timeoutBranch = handler.slice(timeoutBranchStart, timeoutBranchEnd);
    expect(timeoutBranch).toContain("PENDING: Do not resend; delivery is being reconciled.");
    // The idempotency key must survive the watchdog so a resend is deduped, not duplicated.
    expect(timeoutBranch).not.toContain("replyIdempotencyRef.current = null");
  });

  it("only clears the idempotency ref when it still points at the send that is finishing", () => {
    const handler = sliceHandleSendReply(readInboxSource());
    expect(handler).toContain("const clearIdempotencyIfUnchanged = () => {");
    expect(handler).toContain("if (replyIdempotencyRef.current?.key === idempotencyKey) replyIdempotencyRef.current = null;");
  });

  it("a late-resolving invoke still updates packet-scoped feedback without clearing another packet's draft", () => {
    const handler = sliceHandleSendReply(readInboxSource());
    expect(handler).toContain("void invokePromise.then(");
    expect(handler).toContain("finalizeReplyResult(data, invokeError)");
  });

  it("does not clear a same-packet draft that changed after the watchdog handed the composer back", () => {
    const inbox = readInboxSource();
    // replyTextRef must track the live draft so a late resolution can tell a
    // stale sent draft apart from text the operator has since typed.
    expect(inbox).toContain('const replyTextRef = useRef("");');
    expect(inbox).toContain("replyTextRef.current = replyText;");
    const handler = sliceHandleSendReply(inbox);
    expect(handler).toContain(
      "if (selectedPacketIdRef.current === packetId && replyTextRef.current.trim() === trimmed) {",
    );
  });
});

describe("WhatsApp mobile composer reserves its real height in the message scroll area", () => {
  it("measures the composer with a ResizeObserver instead of assuming a fixed height", () => {
    const inbox = readInboxSource();
    expect(inbox).toContain("const composerRef = useRef<HTMLDivElement | null>(null);");
    expect(inbox).toContain("const [composerHeight, setComposerHeight] = useState(0);");
    expect(inbox).toContain("new ResizeObserver((entries) => {");
    const composerIndex = inbox.indexOf("data-operator-inbox-reply-composer");
    const composerOpening = inbox.slice(inbox.lastIndexOf("<div", composerIndex), composerIndex + 220);
    expect(composerOpening).toContain("ref={composerRef}");
  });

  it("the message/context scroll area's bottom spacing tracks the measured composer height, not a hard-coded value", () => {
    const inbox = readInboxSource();
    const scrollAreaIndex = inbox.indexOf('className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain scroll-pt-2 scroll-pb-3 p-4"');
    expect(scrollAreaIndex).toBeGreaterThan(-1);
    const scrollAreaOpening = inbox.slice(scrollAreaIndex, scrollAreaIndex + 300);
    expect(scrollAreaOpening).toContain("style={isNarrow && composerHeight > 0 ? { paddingBottom: composerHeight + 16 } : undefined}");
  });
});
