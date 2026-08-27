/**
 * Factory Operations certification credential policy.
 *
 * This module contains metadata only. It never reads environment variables and
 * never stores credentials. The Playwright harness resolves each canonical
 * application role to a distinct environment-variable pair at runtime.
 */

export type FactoryCertificationCredentialSpec = {
  role: string;
  emailEnv: string;
  passwordEnv: string;
};

export function factoryCertificationCredentialSpec(role: string): FactoryCertificationCredentialSpec {
  const canonical = role.trim().toUpperCase();
  if (!/^[A-Z0-9_]+$/.test(canonical)) {
    throw new Error(`Invalid Factory certification role key: ${role}`);
  }
  return {
    role: canonical,
    emailEnv: `FACTORY_CERT_${canonical}_EMAIL`,
    passwordEnv: `FACTORY_CERT_${canonical}_PASSWORD`,
  };
}

export function factoryCertificationCredentialSpecs(roles: readonly string[]): FactoryCertificationCredentialSpec[] {
  return Array.from(new Set(roles.map((role) => role.trim().toUpperCase())))
    .sort()
    .map(factoryCertificationCredentialSpec);
}

export type FactoryCertificationCredentialIdentity = {
  role: string;
  email: string;
};

/**
 * A single QA email must never stand in for multiple role identities. This is
 * deliberately fail-closed because role-reuse would make route isolation tests
 * meaningless.
 */
export function findDuplicateCertificationEmails(
  identities: readonly FactoryCertificationCredentialIdentity[],
): Array<{ email: string; roles: string[] }> {
  const byEmail = new Map<string, Set<string>>();
  for (const identity of identities) {
    const email = identity.email.trim().toLowerCase();
    if (!email) continue;
    const roles = byEmail.get(email) ?? new Set<string>();
    roles.add(identity.role.trim().toUpperCase());
    byEmail.set(email, roles);
  }

  return Array.from(byEmail.entries())
    .filter(([, roles]) => roles.size > 1)
    .map(([email, roles]) => ({ email, roles: Array.from(roles).sort() }))
    .sort((a, b) => a.email.localeCompare(b.email));
}
