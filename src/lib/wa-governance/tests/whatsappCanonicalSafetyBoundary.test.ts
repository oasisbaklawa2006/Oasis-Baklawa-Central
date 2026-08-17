import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isWaWebhookAutoOrderWritesEnabled,
  isWaWebhookOwnerReassignmentEnabled,
} from "@/config/waFlags";
import {
  scanProtectedWhatsappCommercialMutations,
} from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

function readRepoFile(pathFromRoot: string): string {
  return readFileSync(join(REPO_ROOT, pathFromRoot), "utf8");
}

describe("WhatsApp canonical safety boundary", () => {
  it("permanently disables legacy webhook commercial mutation switches", () => {
    const hostileEnv = () => "true";
    expect(isWaWebhookAutoOrderWritesEnabled(hostileEnv)).toBe(false);
    expect(isWaWebhookOwnerReassignmentEnabled(hostileEnv)).toBe(false);
  });

  it("redirects the retired Central Pool route to Operator Inbox", () => {
    const app = readRepoFile("src/App.tsx");
    expect(app).not.toMatch(/import\("\.\/pages\/admin\/CentralOrderPool\.tsx"\)/);
    expect(app).toContain(
      '<Route path="central-pool" element={<Navigate to="/admin/operator-inbox" replace />} />',
    );
  });

  it("removes commercial-table promotion writes from Central Pool", () => {
    const path = "src/pages/admin/CentralOrderPool.tsx";
    expect(
      scanProtectedWhatsappCommercialMutations(readRepoFile(path), path),
    ).toEqual([]);
    expect(readRepoFile(path)).toContain("Central Pool promotion is retired");
  });

  it("stops Banyan before its retained legacy lifecycle can execute", () => {
    const parser = readRepoFile("supabase/functions/banyan-central-parser/index.ts");
    const marker = parser.indexOf("WA_CANONICAL_RETIREMENT");
    const retiredReturn = parser.indexOf("status: 410", marker);
    const serviceClient = parser.indexOf("const supabaseAdmin = createClient", marker);

    expect(marker).toBeGreaterThan(-1);
    expect(retiredReturn).toBeGreaterThan(marker);
    expect(serviceClient).toBeGreaterThan(retiredReturn);
    expect(parser.slice(marker, serviceClient)).toContain(
      "Banyan independent WhatsApp lifecycle is retired",
    );
  });

  it("keeps webhook ingress incapable of creating shadow companies", () => {
    const webhook = readRepoFile("supabase/functions/whatsapp-webhook/index.ts");
    expect(webhook).not.toContain("shadowName");
    expect(webhook).not.toMatch(/\.from\(["']companies["']\)/);
    expect(webhook).not.toMatch(/from\(["']companies["']\)[\s\S]*?\.insert\(/);
  });
});
