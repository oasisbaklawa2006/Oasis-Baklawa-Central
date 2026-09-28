import type { ProviderApp } from "./catalogue";
import { PROVIDER_PREVIEW_SECRET_BY_APP } from "./catalogue";

const E2E_HOST_HELP =
  "Use https://*.vercel.app, localhost, or 127.0.0.1 for provider preview crawls.";

export function assertSafePreviewHost(hostname: string): void {
  if (process.env.ALLOW_UNSAFE_E2E_URL === "true") return;
  const h = hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return;
  if (h.endsWith(".vercel.app")) return;
  throw new Error(`Provider preview hostname "${hostname}" is not allowed. ${E2E_HOST_HELP}`);
}

export function normalizeProviderPreviewUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Provider preview URL is empty.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("Provider preview URL is not a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Provider preview URL must be http or https, got "${url.protocol}".`);
  }
  if (url.username || url.password) {
    throw new Error("Provider preview URL must not embed credentials in the URL.");
  }
  assertSafePreviewHost(url.hostname);
  return `${url.origin}${url.pathname}`.replace(/\/$/, "") || url.origin;
}

/** Evidence-safe URL (origin + pathname only). */
export function redactUrlForEvidence(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return "";
  }
}

export function resolveProviderPreviewBaseUrl(app: ProviderApp, env: NodeJS.ProcessEnv = process.env): string | null {
  const secretName = PROVIDER_PREVIEW_SECRET_BY_APP[app];
  const raw = env[secretName]?.trim();
  if (!raw) return null;
  return normalizeProviderPreviewUrl(raw);
}

export function secretNameForApp(app: ProviderApp): string {
  return PROVIDER_PREVIEW_SECRET_BY_APP[app];
}
