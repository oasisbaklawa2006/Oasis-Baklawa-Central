import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isWaWebhookAutoOrderWritesEnabled,
  isWaWebhookOwnerReassignmentEnabled,
} from "@/config/waFlags";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

const WRITE_PATTERN = /\.(insert|update|delete|upsert|rpc)\(/;
const ORDER_WRITE_PATTERN = /from\(["']orders["']\)[\s\S]{0,120}\.(insert|update|upsert|delete)\(/;

function collectSourceFiles(dir: string): string[] {
  const abs = join(REPO_ROOT, dir);
  const out: string[] = [];

  for (const entry of readdirSync(abs)) {
    const full = join(abs, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(relative(REPO_ROOT, full)));
      continue;
    }
    if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts") && !entry.endsWith(".test.tsx")) {
      out.push(relative(REPO_ROOT, full));
    }
  }

  return out;
}

function readRepoFile(pathFromRoot: string): string {
  return readFileSync(join(REPO_ROOT, pathFromRoot), "utf8");
}

describe("operator inbox Stage-1 guardrails", () => {
  const whatsappComponentFiles = collectSourceFiles("src/components/whatsapp");
  const waGovernanceFiles = collectSourceFiles("src/lib/wa-governance").filter(
    (path) => !path.includes("/tests/") && !path.includes("/__tests__/"),
  );

  it("wa-governance and whatsapp component trees have no PostgREST writes", () => {
    const violations: string[] = [];

    for (const file of [...whatsappComponentFiles, ...waGovernanceFiles]) {
      const content = readRepoFile(file);
      if (WRITE_PATTERN.test(content)) {
        violations.push(file);
      }
    }

    expect(violations).toEqual([]);
  });

  it("WhatsAppInbox has no direct order table mutations", () => {
    const inbox = readRepoFile("src/components/WhatsAppInbox.tsx");
    expect(ORDER_WRITE_PATTERN.test(inbox)).toBe(false);
    expect(inbox).not.toMatch(/admin-create-draft/);
  });

  it("WhatsAppInbox invoke slugs are limited to the three TOOL 1/3/4 handlers", () => {
    const inbox = readRepoFile("src/components/WhatsAppInbox.tsx");
    const slugs = [...inbox.matchAll(/functions\.invoke\("([^"]+)"/g)].map((match) => match[1]);
    expect(slugs.sort()).toEqual(
      ["whatsapp-classify-intent", "whatsapp-operator-reply", "whatsapp-route-packet"].sort(),
    );
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

  it("operator reply is only triggered from explicit send handler", () => {
    const inbox = readRepoFile("src/components/WhatsAppInbox.tsx");
    const replyInvokeCount = (inbox.match(/functions\.invoke\("whatsapp-operator-reply"/g) ?? []).length;
    expect(replyInvokeCount).toBe(1);
    expect(inbox).toMatch(/handleSendReply/);
    expect(inbox).not.toMatch(/send-whatsapp-automation/);
  });
});
