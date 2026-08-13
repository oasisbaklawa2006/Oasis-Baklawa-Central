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
      "src/components/whatsapp/OperatorInboxDraftOrderPanel.tsx",
    ]) {
      const content = readRepoFile(panel);
      expect(content).toMatch(/read-only/);
      expect(content).toMatch(/not persisted/);
    }
  });

  it("draft order panel does not invoke orders write paths", () => {
    const panel = readRepoFile("src/components/whatsapp/OperatorInboxDraftOrderPanel.tsx");
    expect(panel).not.toMatch(/from\("orders"\)/);
    expect(panel).toMatch(/does not create Sales Orders/);
    const localState = readRepoFile("src/components/whatsapp/operatorInboxDraftOrderLocalState.ts");
    expect(localState).toMatch(/never writes to orders/);
  });

  it("sales order draft section persists to sales_order_drafts only", () => {
    const section = readRepoFile("src/components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx");
    expect(section).not.toMatch(/from\("orders"\)/);
    expect(section).toMatch(/sales_order_drafts/);
    expect(section).toMatch(/Does not create live Sales Orders/);
    const hook = readRepoFile("src/components/whatsapp/useOperatorInboxSalesOrderDraft.ts");
    expect(hook).not.toMatch(/from\("orders"\)/);
    expect(scanRepoFileForForbiddenPostgrestWrites(REPO_ROOT, "src/components/whatsapp/useOperatorInboxSalesOrderDraft.ts")).toEqual([]);
    expect(scanRepoFileForForbiddenPostgrestWrites(REPO_ROOT, "src/components/whatsapp/OperatorInboxSalesOrderDraftSection.tsx")).toEqual([]);
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

  it("operator replies consume the Core-governed retry-safe contract", () => {
    const edge = readRepoFile("supabase/functions/whatsapp-operator-reply/index.ts");
    const inbox = readRepoSource(REPO_ROOT, WHATSAPP_INBOX_INVOKE_SCAN_FILE);
    expect(edge).toContain('rpc("enqueue_whatsapp_operator_reply"');
    expect(edge).toContain('rpc("claim_whatsapp_operator_reply"');
    expect(edge).toContain('rpc("complete_whatsapp_operator_reply"');
    expect(edge).toContain('rpc("fail_whatsapp_operator_reply"');
    expect(edge).toContain("p_acceptance_unknown: true");
    expect(edge).not.toMatch(/console\.(log|error).*CLICK2API_(API_KEY|ACCESS_TOKEN)/);
    expect(inbox).toContain('whatsappAuthority.has("wa.reply.send")');
    expect(inbox).toContain("idempotency_key: replyIdempotencyRef.current.key");
    expect(inbox).not.toContain("operator_id:");
  });

  it("provider status callbacks reconcile the Core outbox", () => {
    const webhook = readRepoFile("supabase/functions/whatsapp-webhook/index.ts");
    expect(webhook).toContain('rpc("record_whatsapp_operator_reply_status"');
    expect(webhook).toContain('["ACCEPTED", "DELIVERED", "READ"]');
  });

  it("WhatsApp ingress authenticates handshakes and POSTs without logging secrets or payloads", () => {
    const webhook = readRepoFile("supabase/functions/whatsapp-webhook/index.ts");
    const click2ApiAuth = readRepoFile("supabase/functions/_shared/click2apiWebhookAuth.ts");
    expect(webhook).toContain('Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN")');
    expect(webhook).toContain('Deno.env.get("WHATSAPP_WEBHOOK_SECRET")');
    expect(webhook).toContain("authenticateClick2ApiWebhook(");
    expect(click2ApiAuth).toContain('request.headers.get("x-webhook-secret")');
    expect(click2ApiAuth).toContain('searchParams.get("echo")');
    expect(webhook).toContain('.from("whatsapp_inbound_messages")');
    expect(webhook).toContain('rpc("capture_whatsapp_potential_order"');
    expect(webhook).toContain("commercial_eligible: input.orderLike");
    expect(webhook.indexOf("ensureCorePotentialCapture(supabaseAdmin")).toBeLessThan(webhook.indexOf("WAMID IDEMPOTENCY GUARD"));
    expect(webhook).toContain('status: 503');
    expect(webhook).toContain('status: 401');
    expect(webhook).toContain('status: 403');
    expect(webhook).not.toContain("Handshake Token Candidates");
    expect(webhook).not.toContain('console.log("Incoming WhatsApp webhook:", JSON.stringify(payload)');
  });
});
