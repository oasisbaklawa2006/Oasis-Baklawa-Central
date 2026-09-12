export const APPROVED_B2B_IDENTITY_CLAIM_RPC = "claim_approved_b2b_access_request_v2";

export type ApprovedB2bIdentityClaimRow = {
  application_id: string | null;
  claimed: boolean;
  company_id: string | null;
  already_active: boolean;
};

export type ApprovedB2bIdentityClaimOutcome = {
  applicationId: string | null;
  companyId: string | null;
  claimed: boolean;
  alreadyActive: boolean;
};

type RpcErrorLike = { message?: string } | null;
type ClaimRpcResult = { data: unknown; error: RpcErrorLike };

/**
 * The only Central auth exchange that needs the post-session buyer claim is the
 * programmatic TokenHash handoff used by the MSG91 bridge. Ordinary SMS/email
 * OTP verification is not changed by this compatibility path.
 */
export function shouldClaimApprovedB2bIdentityAfterTokenHash(params: unknown): boolean {
  if (!params || typeof params !== "object") return false;
  const record = params as Record<string, unknown>;
  return record.type === "magiclink" &&
    typeof record.token_hash === "string" &&
    record.token_hash.trim().length > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

/** Validates Core's single-row claim contract without converting malformed success into a no-op. */
export function isApprovedB2bIdentityClaimRow(value: unknown): value is ApprovedB2bIdentityClaimRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.prototype.hasOwnProperty.call(row, "application_id") &&
    Object.prototype.hasOwnProperty.call(row, "claimed") &&
    Object.prototype.hasOwnProperty.call(row, "company_id") &&
    Object.prototype.hasOwnProperty.call(row, "already_active") &&
    isNullableString(row.application_id) &&
    typeof row.claimed === "boolean" &&
    isNullableString(row.company_id) &&
    typeof row.already_active === "boolean";
}

/**
 * Calls Core's authenticated post-approval identity authority. A structurally
 * valid null/false row is the deliberate no-match result for fresh/pending
 * applicants; malformed successful payloads and RPC errors both fail closed.
 */
export async function claimApprovedB2bIdentity(
  invoke: () => Promise<ClaimRpcResult>,
): Promise<ApprovedB2bIdentityClaimOutcome> {
  const { data, error } = await invoke();
  if (error) {
    throw new Error("APPROVED_B2B_IDENTITY_CLAIM_FAILED");
  }

  const candidate = Array.isArray(data) && data.length === 1 ? data[0] : !Array.isArray(data) ? data : null;
  if (!isApprovedB2bIdentityClaimRow(candidate)) {
    throw new Error("APPROVED_B2B_IDENTITY_CLAIM_FAILED");
  }

  return {
    applicationId: candidate.application_id,
    companyId: candidate.company_id,
    claimed: candidate.claimed,
    alreadyActive: candidate.already_active,
  };
}

/**
 * Preserves the required ordering for UAT #561:
 * verified Supabase session -> Core approved-application claim -> account/role
 * resolution in the caller. No application id or phone is supplied by Central;
 * Core derives both from the authenticated provider-confirmed session.
 */
export async function verifyTokenHashThenClaimApprovedB2bIdentity<T extends {
  data?: { user?: unknown } | null;
  error?: unknown;
}>(
  originalParams: unknown,
  verify: () => Promise<T>,
  claim: () => Promise<ApprovedB2bIdentityClaimOutcome>,
): Promise<T> {
  const verified = await verify();
  if (verified.error || !verified.data?.user) return verified;
  if (!shouldClaimApprovedB2bIdentityAfterTokenHash(originalParams)) return verified;

  await claim();
  return verified;
}
