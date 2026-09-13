import { AuthFlowError, getCustomerAuthUserMessage } from "@/lib/auth-flow";

/** Ops-safe post-mint failure codes surfaced in auth_logs; never include secrets. */
export type BuyerPostMintFailureStage =
  | "session_token"
  | "approved_b2b_claim"
  | "account_resolution"
  | "buyer_membership"
  | "provider"
  | "unknown";

function classifyPostMintStage(rawMessage: string): BuyerPostMintFailureStage {
  const message = rawMessage.toLowerCase();
  if (message.includes("approved_b2b_identity_claim_failed") || message.includes("session_missing")) return "approved_b2b_claim";
  if (
    message.includes("session_token") ||
    message.includes("session_create") ||
    message.includes("verifyotp") ||
    message.includes("token_hash") ||
    message.includes("email link") ||
    message.includes("invalid login credentials") ||
    message.includes("otp_expired")
  ) {
    return "session_token";
  }
  if (message.includes("account_resolution_failed") || message.includes("phone_not_linked") || message.includes("profile_missing")) {
    return "account_resolution";
  }
  if (message.includes("buyer_membership_required") || message.includes("staff_membership_required")) {
    return "buyer_membership";
  }
  if (message.includes("provider_verification") || message.includes("msg91")) return "provider";
  return "unknown";
}

/**
 * Maps MSG91/provider-stage OTP errors for the Buyer mobile channel.
 * Post-mint session/claim/account failures should use mapBuyerPostMintAuthError instead.
 */
export function mapBuyerOtpProviderError(rawMessage?: string | null): string {
  const message = (rawMessage ?? "").toLowerCase();
  if (message.includes("session_token_mint_failed") || message.includes("session_token_missing")) {
    return "MSG91 verified the OTP, but session creation failed. Please retry.";
  }
  if (message.includes("session_token_mint_timeout") || message.includes("msg91_edge_timeout")) {
    return "MSG91 verified the OTP, but Oasis session creation timed out. Please retry.";
  }
  if (message.includes("expired")) return "OTP expired. Please request a new code.";
  if (message.includes("invalid") || message.includes("incorrect")) {
    return "OTP invalid. Please enter the correct code and try again.";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "Network error. Please check your connection and try again.";
  }
  if (message.includes("phone_linked_to_missing_auth_identity")) {
    return "This mobile identity needs account reconciliation. Please contact Oasis support.";
  }
  if (message.includes("duplicate_phone_identity")) {
    return "This mobile number is linked to more than one account. Please contact Oasis support.";
  }
  if (message.includes("provider_verification_failed")) {
    return "MSG91 could not verify this OTP session. Please request a new OTP.";
  }
  return "Mobile verification failed. Please try again.";
}

/**
 * Customer-safe copy for failures after MSG91+Edge mint (verifyOtp, claim RPC,
 * redirectAfterAuth). Detailed provider/RPC text stays in auth_logs only.
 */
export function mapBuyerPostMintAuthError(error: unknown): { message: string; stage: BuyerPostMintFailureStage } {
  if (error instanceof AuthFlowError) {
    return {
      stage: error.code === "BUYER_MEMBERSHIP_REQUIRED" ? "buyer_membership" : "account_resolution",
      message: getCustomerAuthUserMessage(error),
    };
  }

  const raw = error instanceof Error ? error.message : String(error ?? "");
  const stage = classifyPostMintStage(raw);
  const message = raw.toLowerCase();

  if (stage === "approved_b2b_claim") {
    if (message.includes(":session_missing")) {
      return {
        stage,
        message: "Your session was created but could not be confirmed for B2B account linking. Please retry.",
      };
    }
    if (message.includes(":ambiguous") || message.includes("ambiguous")) {
      return {
        stage,
        message: "More than one approved B2B application matches this login. Please contact Oasis support for reconciliation.",
      };
    }
    if (message.includes(":rpc_error")) {
      return {
        stage,
        message: "Your approved B2B account could not be linked right now. Please retry in a moment or contact Oasis support.",
      };
    }
    if (message.includes(":bind_failed")) {
      return {
        stage,
        message: "Your approved B2B account could not be linked to this login. Please retry or contact Oasis support.",
      };
    }
    return {
      stage,
      message: "Your approved B2B account could not be linked to this login. Please contact Oasis support.",
    };
  }

  if (stage === "session_token") {
    if (message.includes("expired")) {
      return { stage, message: "The login link expired before the session could start. Please request a new OTP." };
    }
    if (message.includes("invalid")) {
      return { stage, message: "Session creation failed after OTP verification. Please request a new OTP and try again." };
    }
    return { stage, message: "MSG91 verified the OTP, but Oasis could not start your session. Please retry." };
  }

  if (stage === "buyer_membership") {
    return { stage, message: getCustomerAuthUserMessage(error) };
  }

  if (stage === "account_resolution") {
    if (message.includes("phone_not_linked")) {
      return { stage, message: "Phone not linked to an approved portal account." };
    }
    if (message.includes("duplicate")) {
      return { stage, message: "Duplicate identity records found. Please contact Oasis support." };
    }
    return { stage, message: "We could not resolve your Buyer account after verification. Please contact Oasis support." };
  }

  return { stage, message: mapBuyerOtpProviderError(raw) };
}
