import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { WHATSAPP_INBOX_INVOKE_SCAN_FILE } from "@/lib/wa-governance/stage1InvokeScan";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";
import {
  OPERATOR_INBOX_INITIAL_PACKET_LIMIT,
  OPERATOR_INBOX_PACKET_PAGE_SIZE,
} from "@/components/whatsapp/operatorInboxPacketsLoader";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

describe("operator inbox bounded initial load guardrails", () => {
  it("the initial and paginated windows are conservative (100-200 packets), not the old 1000-row fetch", () => {
    expect(OPERATOR_INBOX_INITIAL_PACKET_LIMIT).toBeGreaterThanOrEqual(100);
    expect(OPERATOR_INBOX_INITIAL_PACKET_LIMIT).toBeLessThanOrEqual(200);
    expect(OPERATOR_INBOX_PACKET_PAGE_SIZE).toBeGreaterThanOrEqual(100);
    expect(OPERATOR_INBOX_PACKET_PAGE_SIZE).toBeLessThanOrEqual(200);
  });

  it("WhatsAppInbox no longer requests an unbounded 1000-packet window", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).not.toContain("PACKET_FETCH_LIMIT = 1000");
    expect(inbox).not.toMatch(/\.limit\(PACKET_FETCH_LIMIT\)/);
  });

  it("the initial load and explicit pagination both request bounded, newest-first pages", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(inbox).toContain("fetchOpenPacketsPage(0, OPERATOR_INBOX_INITIAL_PACKET_LIMIT)");
    expect(inbox).toContain("fetchOpenPacketsPage(offset, OPERATOR_INBOX_PACKET_PAGE_SIZE)");
    // hasMorePackets only clears once a page comes back short of a full page — never claims
    // all history is loaded just because the initial window was consumed.
    expect(inbox).toContain("setHasMorePackets(rows.length === OPERATOR_INBOX_INITIAL_PACKET_LIMIT)");
    expect(inbox).toContain("setHasMorePackets(moreRows.length === OPERATOR_INBOX_PACKET_PAGE_SIZE)");
  });

  it("a stalled Supabase dependency cannot hang the skeleton: every packet/messages/governed-context fetch is time-bounded", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const withTimeoutCalls = inbox.match(/await withTimeout\(/g) ?? [];
    // fetchOpenPacketsPage + fetchMessagesForPacketIdsBatch + governed Promise.all, x2 (initial load + load more).
    expect(withTimeoutCalls.length).toBeGreaterThanOrEqual(6);
  });

  it("loading always exits in the finally block regardless of success or failure", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const finallyBlock = inbox.slice(
      inbox.indexOf("} catch (err) {", inbox.indexOf("const loadPackets = useCallback")),
      inbox.indexOf("}, []);", inbox.indexOf("const loadPackets = useCallback")),
    );
    expect(finallyBlock).toContain("finally {");
    expect(finallyBlock).toContain("setLoading(false);");
    // Failure path surfaces a recoverable error rather than leaving state unexplained.
    expect(finallyBlock).toContain("setError(msg);");
  });

  it("governed context failures fail closed in both the initial load and pagination, never fail open", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);

    // Initial load: every dependency's failure unconditionally feeds governanceWarnings.
    expect(inbox).toContain(
      "...batchMessageErrors.map(\n          (messageError) => `Governed context unavailable because message history is incomplete: ${messageError}`,\n        ),\n        potentialError ? `Governed potential-order context unavailable: ${potentialError.message}` : null,\n        evidenceError ? `Governed evidence links unavailable: ${evidenceError.message}` : null,",
    );
    expect(inbox).toContain(
      "setGovernedContextError(governanceWarnings.length > 0 ? governanceWarnings.join(\" \") : null);",
    );

    // Pagination ("load more") merges new warnings into governedContextError instead of clearing it.
    expect(inbox).toContain(
      "...moreBatchMessageErrors.map(\n          (messageError) => `Governed context unavailable because message history is incomplete: ${messageError}`,\n        ),\n        morePotentialError ? `Governed potential-order context unavailable: ${morePotentialError.message}` : null,\n        moreEvidenceError ? `Governed evidence links unavailable: ${moreEvidenceError.message}` : null,",
    );
    expect(inbox).toContain(
      "setGovernedContextError((prev) => (prev ? `${prev} ${moreGovernanceWarnings.join(\" \")}` : moreGovernanceWarnings.join(\" \")));",
    );

    // handleSendReply blocks before ever invoking the reply edge function once governedContextError is set.
    const handleSendReplyStart = inbox.indexOf("const handleSendReply = useCallback");
    const governedGuardIndex = inbox.indexOf("if (governedContextError) {", handleSendReplyStart);
    const invokeIndex = inbox.indexOf('functions.invoke("whatsapp-operator-reply"', handleSendReplyStart);
    expect(governedGuardIndex).toBeGreaterThan(handleSendReplyStart);
    expect(invokeIndex).toBeGreaterThan(governedGuardIndex);
  });
});
