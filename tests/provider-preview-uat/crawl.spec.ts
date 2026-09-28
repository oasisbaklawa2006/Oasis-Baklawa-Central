import { test } from "@playwright/test";
import { targetsForTranche } from "../../src/lib/provider-preview-uat/catalogue";
import { crawlProviderPreviewTarget, recordSecretPresenceAudit } from "./crawl";

const tranche = (process.env.PROVIDER_PREVIEW_RUN_TRANCHE?.trim() || "all") as
  | "ai-studio"
  | "trace"
  | "all";

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  recordSecretPresenceAudit();
});

for (const target of targetsForTranche(tranche)) {
  test(`${target.uatId} — ${target.app} ${target.route} (${target.state})`, async ({ page }) => {
    await crawlProviderPreviewTarget(page, target);
  });
}
