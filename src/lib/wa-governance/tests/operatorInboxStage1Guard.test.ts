import { join } from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  isWaWebhookAutoOrderWritesEnabled,
  isWaWebhookOwnerReassignmentEnabled,
} from "@/config/waFlags";
import {
  ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS,
  countFunctionsInvokeSlug,
  findInboxTreeInvokeViolations,
  scanDynamicFunctionsInvokes,
  scanFunctionsInvokeSlugs,
  WHATSAPP_INBOX_INVOKE_SCAN_FILE,
} from "@/lib/wa-governance/stage1InvokeScan";
import {
  collectInboxPostgrestWriteScanFiles,
  INBOX_POSTGREST_WRITE_SCAN_ROOTS,
  readRepoSource,
  scanOrderTableMutations,
  scanRepoFileForForbiddenPostgrestWrites,
} from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

function readRepoFile(pathFromRoot: string): string {
  return readFileSync(join(REPO_ROOT, pathFromRoot), "utf8");
}

describe("operator inbox Stage-1 guardrails", () => {
  const inboxPostgrestWriteScanFiles = collectInboxPostgrestWriteScanFiles(REPO_ROOT);

  it("documents the PostgREST write scan paths", () => {
    expect(INBOX_POSTGREST_WRITE_SCAN_ROOTS).toEqual([
      "src/components/WhatsAppInbox.tsx",
      "src/components/whatsapp",
      "src/lib/wa-governance",
    ]);
    expect(inboxPostgrestWriteScanFiles).toContain("src/components/WhatsAppInbox.tsx");
  });

  it("inbox module trees including WhatsAppInbox.tsx have no forbidden PostgREST writes (AST)", () => {
    const violations: string[] = [];

    for (const file of inboxPostgrestWriteScanFiles) {
      const hits = scanRepoFileForForbiddenPostgrestWrites(REPO_ROOT, file);
      if (hits.length > 0) {
        violations.push(`${file}:${hits.map((hit) => `${hit.method}@${hit.line}`).join(",")}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("inbox-tree invoke scan has no dynamic or unallowlisted slugs (AST)", () => {
    expect(
      findInboxTreeInvokeViolations(inboxPostgrestWriteScanFiles, (file) =>
        readRepoSource(REPO_ROOT, file),
      ),
    ).toEqual([]);
  });

  it("WhatsAppInbox has no dynamic functions.invoke slugs (AST)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(scanDynamicFunctionsInvokes(inbox, WHATSAPP_INBOX_INVOKE_SCAN_FILE)).toEqual([]);
  });

  it("WhatsAppInbox has no direct order table mutations (AST)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(scanOrderTableMutations(inbox, WHATSAPP_INBOX_INVOKE_SCAN_FILE)).toEqual([]);
    expect(inbox).not.toMatch(/admin-create-draft/);
  });

  it("WhatsAppInbox invoke slugs are limited to the three TOOL 1/3/4 handlers (AST)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    const slugs = scanFunctionsInvokeSlugs(inbox, WHATSAPP_INBOX_INVOKE_SCAN_FILE).map((hit) => hit.slug);
    expect(slugs.sort()).toEqual([...ALLOWED_WHATSAPP_INBOX_INVOKE_SLUGS].sort());
  });

  it("governance bar keeps automation and draft approval disabled", () => {
    const panel = readRepoFile("src/components/whatsapp/OperatorInboxReadOnlyPanels.tsx");
    expect(panel).toContain('DisabledGovernanceAction label="Reassign"');
    expect(panel).toContain('DisabledGovernanceAction label="Approve Draft"');
    expect(panel).toContain('DisabledGovernanceAction label="Send Automation"');
    expect(panel).toContain('aria-disabled="true"');
  });

  it("resolution panels declare read-only not persisted", () => {
    for (const panel of [
      "src/components/whatsapp/OperatorInboxSenderIdentityPanel.tsx",
      "src/components/whatsapp/OperatorInboxClientResolutionPanel.tsx",
      "src/components/whatsapp/OperatorInboxProductResolutionPanel.tsx",
      "src/components/whatsapp/OperatorInboxQuantityResolutionPanel.tsx",
    ]) {
      const content = readRepoFile(panel);
      expect(content).toMatch(/read-only/);
      expect(content).toMatch(/not persisted/);
    }
  });

  it("webhook auto-order and owner reassignment flags default to disabled", () => {
    expect(isWaWebhookAutoOrderWritesEnabled(() => undefined)).toBe(false);
    expect(isWaWebhookOwnerReassignmentEnabled(() => undefined)).toBe(false);
  });

  it("operator reply is only triggered from explicit send handler (AST)", () => {
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(countFunctionsInvokeSlug(inbox, "whatsapp-operator-reply", WHATSAPP_INBOX_INVOKE_SCAN_FILE)).toBe(1);
    expect(inbox).toMatch(/handleSendReply/);
    expect(scanFunctionsInvokeSlugs(inbox, WHATSAPP_INBOX_INVOKE_SCAN_FILE).map((hit) => hit.slug)).not.toContain(
      "send-whatsapp-automation",
    );
  });
});
