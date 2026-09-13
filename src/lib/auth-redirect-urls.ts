const LEGACY_B2B_PORTAL_HOST = "b2b.oasisbaklawa.com";

/**
 * Central Buyer email OTP / magic-link confirm must land on the current Central
 * deployment origin (oasis-baklawa-central.vercel.app, oasisbaklawa.com, or local
 * dev) — never the legacy B2B portal host.
 */
export function resolveBuyerEmailOtpRedirectUrl(origin = typeof window !== "undefined" ? window.location.origin : ""): string {
  if (!origin) {
    throw new Error("buyer_email_otp_redirect_origin_required");
  }

  const redirectUrl = new URL("/buyer/login", origin);
  redirectUrl.searchParams.set("manual_auth", "true");
  return redirectUrl.toString();
}

/** Guardrail for tests and static analysis — Buyer auth redirects must not target B2B. */
export function isLegacyB2bPortalAuthRedirect(url: string): boolean {
  try {
    return new URL(url).hostname === LEGACY_B2B_PORTAL_HOST;
  } catch {
    return url.includes(LEGACY_B2B_PORTAL_HOST);
  }
}
