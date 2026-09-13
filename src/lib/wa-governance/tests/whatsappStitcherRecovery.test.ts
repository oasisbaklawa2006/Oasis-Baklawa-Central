import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readRepoSource } from "@/lib/wa-governance/stage1PostgrestWriteScan";

const REPO_ROOT = join(import.meta.dirname, "../../../..");

describe("whatsapp stitcher recovery", () => {
  it("quarantines invalid contact rows instead of aborting the stitcher batch", () => {
    const stitcher = readRepoSource(REPO_ROOT, "supabase/functions/whatsapp-message-stitcher/index.ts");
    expect(stitcher).toContain("partitionUnstitchedByContactAuthority");
    expect(stitcher).toContain("messagesQuarantined");
    expect(stitcher).not.toContain("throw new Error(`Unstitched inbound messages missing contact authority");
  });

  it("reuses the pg_cron slot for governed stitcher recovery without Banyan writes", () => {
    const parser = readRepoSource(REPO_ROOT, "supabase/functions/banyan-central-parser/index.ts");
    const liveHandler = parser.split("/* c8 ignore start")[0];
    expect(liveHandler).toContain("whatsapp-message-stitcher");
    expect(liveHandler).toContain("cron-stitcher-recovery");
    expect(liveHandler).toContain("retired_banyan_ai");
    expect(liveHandler).not.toContain("status: 410");
    expect(liveHandler).not.toMatch(/\.from\(\s*["']suggested_orders["']\s*\)/);
  });
});
