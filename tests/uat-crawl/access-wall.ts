/**
 * Application-origin guard — fail closed when the crawler hits Vercel deployment
 * protection instead of the Oasis Central application.
 */
import type { Page } from "@playwright/test";

export const DEPLOYMENT_PROTECTION_CLASS = "DEPLOYMENT_PROTECTION" as const;
export const DEPLOY_BLOCKED_CLASS = "DEPLOY_BLOCKED" as const;

export type AccessWallClassification =
  | typeof DEPLOYMENT_PROTECTION_CLASS
  | typeof DEPLOY_BLOCKED_CLASS
  | null;

export type AccessWallResult = {
  blocked: boolean;
  classification: AccessWallClassification;
  reason: string;
  markers: string[];
};

const VERCEL_WALL_TITLE_PATTERNS = [/login\s*[–-]\s*vercel/i, /^vercel$/i];
const VERCEL_WALL_URL_PATTERNS = [/vercel\.com\/login/i, /vercel\.com\/sso/i, /vercel\.app\/_vercel/i];
const VERCEL_WALL_BODY_PATTERNS = [
  /log in to vercel/i,
  /deployment protection/i,
  /this deployment is protected/i,
  /authenticate to access/i,
  /vercel authentication/i,
];

const OASIS_APP_MARKERS = [
  /oasis/i,
  /baklawa/i,
  /operations controller/i,
  /sign in to your account/i,
  /reset password/i,
  /catalogue/i,
];

export function classifyAccessWallFromSignals(
  title: string,
  url: string,
  bodyText: string,
): AccessWallResult {
  const markers: string[] = [];
  const bodyLower = bodyText.toLowerCase();

  for (const pattern of VERCEL_WALL_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      markers.push(`title:${title}`);
      break;
    }
  }
  for (const pattern of VERCEL_WALL_URL_PATTERNS) {
    if (pattern.test(url)) {
      markers.push(`url:${url}`);
      break;
    }
  }
  for (const pattern of VERCEL_WALL_BODY_PATTERNS) {
    if (pattern.test(bodyLower)) {
      markers.push(`body:${pattern.source}`);
      break;
    }
  }

  const hasOasisMarker = OASIS_APP_MARKERS.some((pattern) => pattern.test(`${title} ${bodyLower}`));
  const onPublicAlias =
    url.includes("oasis-baklawa-central.vercel.app") || url.includes("b2b.oasisbaklawa.com");

  if (markers.length > 0 && (!hasOasisMarker || !onPublicAlias)) {
    return {
      blocked: true,
      classification: DEPLOYMENT_PROTECTION_CLASS,
      reason: `Vercel authentication/deployment-protection wall detected (${markers.join("; ")})`,
      markers,
    };
  }

  if (onPublicAlias && markers.length > 0 && !hasOasisMarker) {
    return {
      blocked: true,
      classification: DEPLOYMENT_PROTECTION_CLASS,
      reason: `Public alias reached but Oasis application markers missing (${markers.join("; ")})`,
      markers,
    };
  }

  return { blocked: false, classification: null, reason: "", markers: [] };
}

export async function detectAccessWall(page: Page): Promise<AccessWallResult> {
  const title = await page.title();
  const url = page.url();
  const bodyText = (await page.locator("body").innerText().catch(() => "")).slice(0, 4000);
  return classifyAccessWallFromSignals(title, url, bodyText);
}

export type ScreenshotHashRow = {
  uatId: string;
  screenshotSha256?: string;
  visualStatus?: string;
  route?: string;
};

/** Many unrelated routes sharing one screenshot hash suggests an auth/interstitial wall. */
export function detectScreenshotHashWall(
  rows: ScreenshotHashRow[],
  opts: { minRoutes: number; excludeHashes?: Set<string> } = { minRoutes: 5 },
): { wallDetected: boolean; dominantHash: string | null; affectedIds: string[] } {
  const byHash = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.screenshotSha256 || row.visualStatus === "BLOCKED") continue;
    if (opts.excludeHashes?.has(row.screenshotSha256)) continue;
    const list = byHash.get(row.screenshotSha256) ?? [];
    list.push(row.uatId);
    byHash.set(row.screenshotSha256, list);
  }

  let dominantHash: string | null = null;
  let affectedIds: string[] = [];
  for (const [hash, ids] of byHash) {
    const uniqueRoutes = new Set(rows.filter((r) => r.screenshotSha256 === hash).map((r) => r.route));
    if (ids.length >= opts.minRoutes && uniqueRoutes.size >= opts.minRoutes) {
      if (ids.length > affectedIds.length) {
        dominantHash = hash;
        affectedIds = ids;
      }
    }
  }

  return { wallDetected: dominantHash !== null, dominantHash, affectedIds };
}
