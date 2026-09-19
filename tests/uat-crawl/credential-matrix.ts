/**
 * UAT crawl credential matrix — reuses existing TEST_* secret naming from
 * lane1-live-smoke, dispatch-rls-production-cert, buyer-certification, and
 * sales-dashboard specs. No parallel identity system.
 *
 * Alias prefixes (first match wins): TEST_GATE | TEST_GATE_SECURITY;
 * TEST_3PGS | TEST_PRODUCTION. Values never logged.
 */

export type CredentialPrefix =
  | "TEST_ADMIN"
  | "TEST_BUYER"
  | "TEST_SALES"
  | "TEST_FINANCE"
  | "TEST_ASSEMBLY"
  | "TEST_DISPATCH"
  | "TEST_OPERATIONS"
  | "TEST_GATE"
  | "TEST_GATE_SECURITY"
  | "TEST_RGS"
  | "TEST_3PGS"
  | "TEST_PRODUCTION"
  | "TEST_TV_RGS"
  | "TEST_TV_PRODUCTION";

export type CredentialResolution = {
  prefix: CredentialPrefix | null;
  missingSecretNames: string[];
  wired: boolean;
  wiredPrefix?: CredentialPrefix | null;
};

const PERSONA_PREFIX_CANDIDATES: Record<string, CredentialPrefix[]> = {
  ADMIN_STAFF: ["TEST_ADMIN"],
  ADMIN_SALES: ["TEST_SALES"],
  SALES: ["TEST_SALES"],
  BUYER: ["TEST_BUYER"],
  FINANCE: ["TEST_FINANCE"],
  P_AND_A: ["TEST_ASSEMBLY"],
  DISPATCH: ["TEST_DISPATCH"],
  GATE_SECURITY: ["TEST_GATE", "TEST_GATE_SECURITY"],
  RGS: ["TEST_RGS"],
  "3PGS": ["TEST_3PGS", "TEST_PRODUCTION"],
  TV: ["TEST_TV_RGS"],
};

/** Route-level overrides when persona alone is ambiguous. */
const ROUTE_PREFIX: Array<{ pattern: RegExp; prefixes: CredentialPrefix[] }> = [
  { pattern: /^\/operations-controller/, prefixes: ["TEST_OPERATIONS"] },
  { pattern: /^\/admin\/dispatch/, prefixes: ["TEST_DISPATCH"] },
  { pattern: /^\/tv\/3pgs/, prefixes: ["TEST_TV_PRODUCTION"] },
  { pattern: /^\/tv\//, prefixes: ["TEST_TV_RGS"] },
];

export function secretNamesForPrefix(prefix: CredentialPrefix): [string, string] {
  return [`${prefix}_EMAIL`, `${prefix}_PASSWORD`];
}

export function hasCredentialPrefix(prefix: CredentialPrefix): boolean {
  const [emailKey, passwordKey] = secretNamesForPrefix(prefix);
  return Boolean(process.env[emailKey]?.trim() && process.env[passwordKey]?.trim());
}

function resolvePrefixCandidates(persona: string, route: string): CredentialPrefix[] | null {
  const routeOverride = ROUTE_PREFIX.find((r) => r.pattern.test(route));
  if (routeOverride) return routeOverride.prefixes;
  return PERSONA_PREFIX_CANDIDATES[persona] ?? null;
}

export function resolveCredentials(persona: string, route: string): CredentialResolution {
  const candidates = resolvePrefixCandidates(persona, route);

  if (!candidates?.length) {
    return {
      prefix: null,
      missingSecretNames: [`TEST_${persona}_EMAIL`, `TEST_${persona}_PASSWORD`],
      wired: false,
    };
  }

  for (const prefix of candidates) {
    if (hasCredentialPrefix(prefix)) {
      return {
        prefix: candidates[0],
        wiredPrefix: prefix,
        missingSecretNames: [],
        wired: true,
      };
    }
  }

  const preferred = candidates[0];
  const missingSecretNames = secretNamesForPrefix(preferred).filter((name) => !process.env[name]?.trim());
  return {
    prefix: preferred,
    wiredPrefix: null,
    missingSecretNames,
    wired: false,
  };
}

export function getCredentials(prefix: CredentialPrefix): { email: string; password: string } {
  const candidates =
    prefix === "TEST_GATE"
      ? (["TEST_GATE", "TEST_GATE_SECURITY"] as CredentialPrefix[])
      : prefix === "TEST_GATE_SECURITY"
        ? (["TEST_GATE_SECURITY", "TEST_GATE"] as CredentialPrefix[])
        : prefix === "TEST_3PGS"
          ? (["TEST_3PGS", "TEST_PRODUCTION"] as CredentialPrefix[])
          : prefix === "TEST_PRODUCTION"
            ? (["TEST_PRODUCTION", "TEST_3PGS"] as CredentialPrefix[])
            : ([prefix] as CredentialPrefix[]);

  for (const candidate of candidates) {
    const [emailKey, passwordKey] = secretNamesForPrefix(candidate);
    const email = process.env[emailKey]?.trim();
    const password = process.env[passwordKey]?.trim();
    if (email && password) {
      return { email, password };
    }
  }

  const [emailKey, passwordKey] = secretNamesForPrefix(prefix);
  throw new Error(`CREDENTIAL_REQUIRED: missing ${emailKey} and/or ${passwordKey}`);
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
  "TEST_GATE_EMAIL",
  "TEST_GATE_PASSWORD",
  "TEST_GATE_SECURITY_EMAIL",
  "TEST_GATE_SECURITY_PASSWORD",
  "TEST_RGS_EMAIL",
  "TEST_RGS_PASSWORD",
  "TEST_3PGS_EMAIL",
  "TEST_3PGS_PASSWORD",
  "TEST_PRODUCTION_EMAIL",
  "TEST_PRODUCTION_PASSWORD",
  "TEST_TV_RGS_EMAIL",
  "TEST_TV_RGS_PASSWORD",
  "TEST_TV_PRODUCTION_EMAIL",
  "TEST_TV_PRODUCTION_PASSWORD",
  "TEST_AI_STUDIO_PREVIEW_URL",
  "TEST_TRACE_PREVIEW_URL",
] as const;
