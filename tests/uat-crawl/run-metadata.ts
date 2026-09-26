import { CURRENT_MAIN_SHA, CRAWL_BASE_URL } from "./crawl-engine";

export type RunScopedMetadata = {
  runId: string;
  runAttempt: string;
  runTranche: string;
  targetMainSha: string;
  deploymentSha: string;
  crawlBaseUrl: string;
  timestamp: string;
};

export function readRunMetadata(): RunScopedMetadata {
  return {
    runId: process.env.GITHUB_RUN_ID?.trim() || "local",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT?.trim() || "1",
    runTranche: process.env.RUN_TRANCHE?.trim() || "local",
    targetMainSha: process.env.UAT_TARGET_SHA?.trim() || CURRENT_MAIN_SHA,
    deploymentSha:
      process.env.UAT_RESOLVED_DEPLOY_SHA?.trim() || process.env.UAT_TARGET_SHA?.trim() || CURRENT_MAIN_SHA,
    crawlBaseUrl: CRAWL_BASE_URL,
    timestamp: new Date().toISOString(),
  };
}
