/** Governed TEST_* prefix aliases — names only; values never logged. */

export const PERSONA_PREFIX_CANDIDATES = {
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

export const ROUTE_PREFIX = [
  [/^\/operations-controller/, ["TEST_OPERATIONS"]],
  [/^\/admin\/dispatch/, ["TEST_DISPATCH"]],
  [/^\/tv\/3pgs/, ["TEST_TV_PRODUCTION"]],
  [/^\/tv\//, ["TEST_TV_RGS"]],
];

export function secretNamesForPrefix(prefix) {
  return [`${prefix}_EMAIL`, `${prefix}_PASSWORD`];
}

export function prefixWired(prefix) {
  const [email, password] = secretNamesForPrefix(prefix);
  return Boolean(process.env[email]?.trim() && process.env[password]?.trim());
}

/** Preferred missing-secret names when no alias prefix is wired. */
export function resolvePrefixCandidates(persona, route) {
  const routeMatch = ROUTE_PREFIX.find(([pattern]) => pattern.test(route));
  if (routeMatch) return routeMatch[1];
  return PERSONA_PREFIX_CANDIDATES[persona] ?? null;
}

export function resolveCredentialBlocker(persona, route) {
  const candidates = resolvePrefixCandidates(persona, route);
  if (!candidates?.length) {
    return {
      wired: false,
      preferredPrefix: `TEST_${persona}`,
      missingSecretNames: [`TEST_${persona}_EMAIL`, `TEST_${persona}_PASSWORD`],
      wiredPrefix: null,
    };
  }
  for (const prefix of candidates) {
    if (prefixWired(prefix)) {
      return { wired: true, preferredPrefix: candidates[0], missingSecretNames: [], wiredPrefix: prefix };
    }
  }
  const preferred = candidates[0];
  return {
    wired: false,
    preferredPrefix: preferred,
    missingSecretNames: secretNamesForPrefix(preferred).filter((name) => !process.env[name]?.trim()),
    wiredPrefix: null,
  };
}

/** Audit list — canonical names plus alias keys checked at runtime. */
export const SECRET_AUDIT_NAMES = [
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
];

export const CREDENTIAL_PREFIX_UNBLOCK_UAT_IDS = [
  "UAT-0003",
  "UAT-0062",
  "UAT-0063",
  "UAT-0064",
  "UAT-0065",
  "UAT-0067",
  "UAT-0082",
  "UAT-0087",
  "UAT-0097",
  "UAT-0098",
  "UAT-0099",
  "UAT-0100",
  "UAT-0101",
];
