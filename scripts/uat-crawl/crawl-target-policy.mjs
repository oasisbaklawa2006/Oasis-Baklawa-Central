/** Shared crawl target policy for Node evidence scripts (mirrors tests/uat-crawl constants). */
export const CENTRAL_PUBLIC_PRODUCTION_ALIAS = "https://oasis-baklawa-central.vercel.app";
export const CENTRAL_CRAWL_TARGET_TYPE_PUBLIC = "PUBLIC_PRODUCTION_ALIAS";
export const CENTRAL_CRAWL_TARGET_TYPE_DEPLOYMENT_URL = "PROTECTED_DEPLOYMENT_URL";

export function buildDeployProvenanceLabel(mainSha) {
  const sha = mainSha?.trim() || "unknown";
  return `Current-main authority @ ${sha} (resolved dynamically at run time) — prior pinned-SHA evidence preserved append-only.`;
}
