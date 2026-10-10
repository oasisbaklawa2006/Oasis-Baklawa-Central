import { test } from "@playwright/test";
import { targetsForTranche } from "../../src/lib/provider-preview-uat/catalogue";
import { crawlProviderPreviewTarget, recordSecretPresenceAudit } from "./crawl";

const rawTranche = process.env.PROVIDER_PREVIEW_RUN_TRANCHE?.trim() || "all";
if (!["ai-studio", "trace", "all"].includes(rawTranche)) {
  throw new Error(`Invalid PROVIDER_PREVIEW_RUN_TRANCHE: ${rawTranche}`);
}
const tranche = rawTranche as "ai-studio" | "trace" | "all";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  recordSecretPresenceAudit();
});

for (const target of targetsForTranche(tranche)) {
  test(`${target.uatId} — ${target.app} ${target.route} (${target.state})`, async ({ page }) => {
    await crawlProviderPreviewTarget(page, target);
  });
}
