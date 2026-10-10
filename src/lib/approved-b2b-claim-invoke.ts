import { supabase } from "@/integrations/supabase/client";
import {
  APPROVED_B2B_IDENTITY_CLAIM_RPC,
  type ClaimRpcResult,
} from "@/lib/b2b-approved-identity-claim";

/** Invokes Core's authenticated post-approval claim RPC (no client args). */
export async function invokeApprovedB2bIdentityClaimRpc(): Promise<ClaimRpcResult> {
  // The deployed Core RPC predates this generated Central client snapshot.
  const { data, error } = await (supabase.rpc as (
    name: string,
  ) => PromiseLike<ClaimRpcResult>)(APPROVED_B2B_IDENTITY_CLAIM_RPC);
  return { data, error };
}
