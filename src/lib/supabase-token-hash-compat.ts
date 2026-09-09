import { supabase } from "@/integrations/supabase/client";
import { normalizeProgrammaticTokenHashVerification } from "@/lib/token-hash-verification";

type VerifyOtp = typeof supabase.auth.verifyOtp;
type VerifyOtpParams = Parameters<VerifyOtp>[0];

let installed = false;

/**
 * Supabase's programmatic TokenHash exchange expects type="email" even when the
 * hash originated from admin.generateLink({ type: "magiclink" }). The Buyer
 * MSG91 flow historically passed type="magiclink" and therefore failed after
 * successful provider verification. Install one narrow compatibility adapter at
 * app startup without changing ordinary SMS/email OTP semantics.
 */
export function installSupabaseTokenHashCompatibility() {
  if (installed) return;

  const originalVerifyOtp = supabase.auth.verifyOtp.bind(supabase.auth) as VerifyOtp;
  supabase.auth.verifyOtp = ((params: VerifyOtpParams) =>
    originalVerifyOtp(normalizeProgrammaticTokenHashVerification(params))) as VerifyOtp;

  installed = true;
}
