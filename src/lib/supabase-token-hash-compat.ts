import { supabase } from "@/integrations/supabase/client";
import { normalizeProgrammaticTokenHashVerification } from "@/lib/token-hash-verification";

type VerifyOtp = typeof supabase.auth.verifyOtp;
type VerifyOtpParams = Parameters<VerifyOtp>[0];

let installed = false;

/**
 * Supabase's programmatic TokenHash exchange expects type="email" even when the
 * hash originated from admin.generateLink({ type: "magiclink" }). The Buyer
 * MSG91 flow passes type="magiclink"; this shim rewrites it before exchange.
 *
 * Approved-B2B claim runs explicitly in BuyerLogin.verifiedMobileSession after
 * SESSION_CREATE_SUCCESS so ops can distinguish mint vs claim vs membership
 * failures and the session is guaranteed readable before Core binds auth.uid().
 */
export function installSupabaseTokenHashCompatibility() {
  if (installed) return;

  const originalVerifyOtp = supabase.auth.verifyOtp.bind(supabase.auth) as VerifyOtp;
  supabase.auth.verifyOtp = (async (params: VerifyOtpParams) =>
    originalVerifyOtp(normalizeProgrammaticTokenHashVerification(params))) as VerifyOtp;

  installed = true;
}
