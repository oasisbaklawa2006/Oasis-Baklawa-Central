export const APPROVED_B2B_IDENTITY_CLAIM_RPC = "claim_approved_b2b_access_request_v2";

export type ApprovedB2bIdentityClaimRow = {
  application_id?: string | null;
  claimed?: boolean | null;
  company_id?: string | null;
  already_active?: boolean | null;
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

/**
 * Calls Core's authenticated post-approval identity authority. A no-match row
 * is a valid no-op for a fresh/pending applicant; RPC errors fail closed.
 */
export async function claimApprovedB2bIdentity(
  invoke: () => Promise<ClaimRpcResult>,
): Promise<ApprovedB2bIdentityClaimOutcome> {
  const { data, error } = await invoke();
  if (error) {
    throw new Error("APPROVED_B2B_IDENTITY_CLAIM_FAILED");
  }

  const row = (Array.isArray(data) ? data[0] : data) as ApprovedB2bIdentityClaimRow | null | undefined;
  return {
    applicationId: row?.application_id ?? null,
    companyId: row?.company_id ?? null,
    claimed: row?.claimed === true,
    alreadyActive: row?.already_active === true,
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
