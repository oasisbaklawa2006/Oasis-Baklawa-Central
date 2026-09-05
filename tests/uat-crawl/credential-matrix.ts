/**
 * UAT crawl credential matrix — reuses existing TEST_* secret naming from
 * lane1-live-smoke, dispatch-rls-production-cert, buyer-certification, and
 * sales-dashboard specs. No parallel identity system.
 */

export type CredentialPrefix =
  | "TEST_ADMIN"
  | "TEST_BUYER"
  | "TEST_SALES"
  | "TEST_FINANCE"
  | "TEST_ASSEMBLY"
  | "TEST_DISPATCH"
  | "TEST_OPERATIONS"
  | "TEST_GATE_SECURITY";

export type CredentialResolution = {
  prefix: CredentialPrefix | null;
  missingSecretNames: string[];
  wired: boolean;
};

const PERSONA_PREFIX: Record<string, CredentialPrefix> = {
  ADMIN_STAFF: "TEST_ADMIN",
  ADMIN_SALES: "TEST_SALES",
  BUYER: "TEST_BUYER",
  FINANCE: "TEST_FINANCE",
  P_AND_A: "TEST_ASSEMBLY",
  DISPATCH: "TEST_DISPATCH",
  GATE_SECURITY: "TEST_GATE_SECURITY",
};

/** Route-level overrides when persona alone is ambiguous. */
const ROUTE_PREFIX: Array<{ pattern: RegExp; prefix: CredentialPrefix }> = [
  { pattern: /^\/operations-controller/, prefix: "TEST_OPERATIONS" },
  { pattern: /^\/admin\/dispatch/, prefix: "TEST_DISPATCH" },
];

export function secretNamesForPrefix(prefix: CredentialPrefix): [string, string] {
  return [`${prefix}_EMAIL`, `${prefix}_PASSWORD`];
}

export function hasCredentialPrefix(prefix: CredentialPrefix): boolean {
  const [emailKey, passwordKey] = secretNamesForPrefix(prefix);
  return Boolean(process.env[emailKey]?.trim() && process.env[passwordKey]?.trim());
}

export function resolveCredentials(persona: string, route: string): CredentialResolution {
  const routeOverride = ROUTE_PREFIX.find((r) => r.pattern.test(route));
  const prefix = routeOverride?.prefix ?? PERSONA_PREFIX[persona] ?? null;

  if (!prefix) {
    return { prefix: null, missingSecretNames: [`TEST_${persona}_EMAIL`, `TEST_${persona}_PASSWORD`], wired: false };
  }

  const missingSecretNames = secretNamesForPrefix(prefix).filter((name) => !process.env[name]?.trim());
  return {
    prefix,
    missingSecretNames,
    wired: missingSecretNames.length === 0,
  };
}

export function getCredentials(prefix: CredentialPrefix): { email: string; password: string } {
  const [emailKey, passwordKey] = secretNamesForPrefix(prefix);
  const email = process.env[emailKey]?.trim();
  const password = process.env[passwordKey]?.trim();
  if (!email || !password) {
    throw new Error(`CREDENTIAL_REQUIRED: missing ${emailKey} and/or ${passwordKey}`);
  }
  return { email, password };
}

/** All secret names referenced by the auth-rerun matrix (for workflow precondition reporting). */
export const UAT_CRAWL_SECRET_NAMES = [
  "TEST_PREVIEW_URL",
  "TEST_ADMIN_EMAIL",
  "TEST_ADMIN_PASSWORD",
  "TEST_BUYER_EMAIL",
  "TEST_BUYER_PASSWORD",
  "TEST_SALES_EMAIL",
  "TEST_SALES_PASSWORD",
  "TEST_FINANCE_EMAIL",
  "TEST_FINANCE_PASSWORD",
  "TEST_ASSEMBLY_EMAIL",
  "TEST_ASSEMBLY_PASSWORD",
  "TEST_DISPATCH_EMAIL",
  "TEST_DISPATCH_PASSWORD",
  "TEST_OPERATIONS_EMAIL",
  "TEST_OPERATIONS_PASSWORD",
  "TEST_GATE_SECURITY_EMAIL",
  "TEST_GATE_SECURITY_PASSWORD",
] as const;
