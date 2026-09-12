import { supabase } from "@/integrations/supabase/client";
import {
  APPROVED_B2B_IDENTITY_CLAIM_RPC,
  claimApprovedB2bIdentity,
  verifyTokenHashThenClaimApprovedB2bIdentity,
} from "@/lib/b2b-approved-identity-claim";
import { normalizeProgrammaticTokenHashVerification } from "@/lib/token-hash-verification";

type VerifyOtp = typeof supabase.auth.verifyOtp;
type VerifyOtpParams = Parameters<VerifyOtp>[0];
type ClaimRpcResponse = {
  data: unknown;
  error: { message?: string } | null;
};

let installed = false;

async function invokeApprovedBuyerIdentityClaim(): Promise<ClaimRpcResponse> {
  // The deployed Core RPC predates this generated Central client snapshot.
  // Keep this narrow cast local until the next generated-types refresh; no args
  // are accepted because Core derives phone/application authority from auth.uid().
  const rpc = supabase.rpc as unknown as (
    name: string,
  ) => PromiseLike<ClaimRpcResponse>;
  return await rpc(APPROVED_B2B_IDENTITY_CLAIM_RPC);
}

/**
 * Supabase's programmatic TokenHash exchange expects type="email" even when the
 * hash originated from admin.generateLink({ type: "magiclink" }). The Buyer
 * MSG91 flow historically passed type="magiclink" and therefore failed after
 * successful provider verification.
 *
 * UAT #561 also requires the already-deployed Core post-approval claim to run
 * after the verified Supabase session exists and before Login resolves public
 * role/company state. The claim receives no client phone or application id and
 * is a safe no-op when no approved application matches the authenticated user.
 */
export function installSupabaseTokenHashCompatibility() {
  if (installed) return;

  const originalVerifyOtp = supabase.auth.verifyOtp.bind(supabase.auth) as VerifyOtp;
  supabase.auth.verifyOtp = (async (params: VerifyOtpParams) =>
    await verifyTokenHashThenClaimApprovedB2bIdentity(
      params,
      () => originalVerifyOtp(normalizeProgrammaticTokenHashVerification(params)),
      () => claimApprovedB2bIdentity(invokeApprovedBuyerIdentityClaim),
    )) as VerifyOtp;

  installed = true;
}
