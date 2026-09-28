import {
  AUTH_BLOCK_CLASSIFICATIONS,
  type AuthBlockClassification,
} from "../auth/auth-contract";
import type { CredentialPrefix } from "./credential-matrix";

/** Classify Supabase 400 on wired test prefix as TEST_CREDENTIAL_GATE (values never logged). */
export function resolveLoginBlockClassification(
  loginClassification: AuthBlockClassification | null,
  creds: { prefix: CredentialPrefix | null; missingSecretNames: string[] },
  consoleErrors: string[],
  networkErrors: string[],
): AuthBlockClassification {
  const base = loginClassification ?? AUTH_BLOCK_CLASSIFICATIONS.AUTH_FLOW_FAILED;
  if (base !== AUTH_BLOCK_CLASSIFICATIONS.AUTH_FLOW_FAILED) return base;
  const haystack = [...consoleErrors, ...networkErrors].join(" ");
  if (
    creds.prefix &&
    creds.missingSecretNames.length === 0 &&
    ((haystack.includes("400") && haystack.includes("auth/v1/token")) ||
      haystack.includes("SESSION_CREATE_FAILED"))
  ) {
    return AUTH_BLOCK_CLASSIFICATIONS.TEST_CREDENTIAL_GATE;
  }
  return base;
}
