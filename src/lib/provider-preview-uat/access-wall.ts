/**
 * Fail closed when governed previews hit Vercel deployment protection instead of the app shell.
 */

export const DEPLOYMENT_PROTECTION_CLASS = "DEPLOYMENT_PROTECTION" as const;

export type AccessWallResult = {
  blocked: boolean;
  classification: typeof DEPLOYMENT_PROTECTION_CLASS | null;
  reason: string;
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

const PROVIDER_APP_MARKERS = [/trace/i, /scan/i, /studio/i, /catalogue/i, /media/i, /oasis/i, /baklawa/i];

export function classifyAccessWallFromSignals(title: string, url: string, bodyText: string): AccessWallResult {
  const bodyLower = bodyText.toLowerCase();
  const markers: string[] = [];

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

  const hasAppMarker = PROVIDER_APP_MARKERS.some((pattern) => pattern.test(`${title} ${bodyLower}`));
  const urlWall = markers.some((marker) => marker.startsWith("url:"));

  if (urlWall || (markers.length > 0 && !hasAppMarker)) {
    return {
      blocked: true,
      classification: DEPLOYMENT_PROTECTION_CLASS,
      reason: `Vercel deployment-protection wall detected (${markers.join("; ")})`,
    };
  }

  return { blocked: false, classification: null, reason: "" };
}
