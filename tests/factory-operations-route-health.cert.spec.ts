import { test, expect } from "@playwright/test";
import {
  FACTORY_OPERATIONS_ROUTES,
  getAllReferencedRoles,
  type FactoryRouteEntry,
} from "../src/lib/factoryOperationsRouteRegistry";
import { compareExactDestination } from "../src/lib/factoryCertificationHelpers";
import { resolveEffectiveFactoryCertificationRole } from "../src/lib/factoryCertificationEffectiveAccess";
import { factoryCertificationCredentialSpec } from "../src/lib/factoryCertificationCredentialPolicy";
import {
  assertNoProvidedCredentialReuse,
  certificationViewports,
  expectedDestinationFor,
  hasFactoryCertificationBackend,
  hasFactoryCertificationTarget,
  loginToFactoryCertificationTarget,
  readFactoryCertificationCredentials,
  resolveFactoryCertificationTarget,
  verifyAuthenticatedRole,
} from "./factory-certification/support";

/**
 * FACTORY OPERATIONS ROLE × ROUTE × DEVICE HEALTH CERTIFICATION
 *
 * Safe by construction:
 * - only an explicitly-approved disposable certification target is accepted;
 * - Vercel previews and known production hosts are rejected by policy;
 * - every route is authenticated with a role that passes the complete runtime
 *   authorization chain, including AdminRouteGuard module access for /admin/*;
 * - supplied emails may not be reused across multiple roles;
 * - the authenticated role is proven against public.users before route checks;
 * - no mutation action is invoked.
 *
 * Missing environment/role credentials produce explicit skips, never PASS.
 */

const CERTIFIED_ROUTE_STATUSES = new Set<FactoryRouteEntry["status"]>([
  "FACTORY_CURRENT",
  "LEGACY_REDIRECT",
]);

const routeEntries = FACTORY_OPERATIONS_ROUTES.filter((entry) => CERTIFIED_ROUTE_STATUSES.has(entry.status));
const referencedRoles = getAllReferencedRoles();

function criticalConsoleErrors(errors: string[]): string[] {
  return errors.filter((line) => {
    const lower = line.toLowerCase();
    return !lower.includes("favicon") && !lower.includes("failed to load resource");
  });
}

test.describe("Factory Operations route health certification", () => {
  test("provided Factory certification identities are role-unique", () => {
    assertNoProvidedCredentialReuse(referencedRoles);
  });

  for (const entry of routeEntries) {
    for (const viewport of certificationViewports(entry)) {
      // Resolution can throw NO_EFFECTIVE_CERTIFICATION_ROLE for a malformed
      // registry entry. Resolving only for the title here, in a try/catch,
      // keeps that throw from aborting collection of every other test in
      // this file; the real (re-thrown) resolution happens per-test below,
      // so only the offending route's own test fails.
      let titleRole: string;
      try {
        titleRole = resolveEffectiveFactoryCertificationRole(entry);
      } catch {
        titleRole = "UNRESOLVED_ROLE";
      }

      test(`${entry.route} :: ${titleRole} :: ${viewport.name}`, async ({ page }) => {
        const role = resolveEffectiveFactoryCertificationRole(entry);
        const credentialSpec = factoryCertificationCredentialSpec(role);

        test.skip(
          !hasFactoryCertificationTarget(),
          "CERTIFICATION_ENV_REQUIRED: FACTORY_CERT_TARGET_URL is not configured",
        );
        test.skip(
          !hasFactoryCertificationBackend(),
          "CERTIFICATION_ENV_REQUIRED: authenticated role proof requires Factory certification Supabase URL + anon key",
        );

        const credentials = readFactoryCertificationCredentials(role);
        test.skip(
          !credentials,
          `CREDENTIAL_REQUIRED: ${credentialSpec.emailEnv} + ${credentialSpec.passwordEnv}`,
        );

        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await loginToFactoryCertificationTarget(page, credentials!);
        await verifyAuthenticatedRole(page, role);

        const consoleErrors: string[] = [];
        const pageErrors: string[] = [];
        page.on("console", (message) => {
          if (message.type() === "error") consoleErrors.push(message.text());
        });
        page.on("pageerror", (error) => pageErrors.push(error.message));

        const target = resolveFactoryCertificationTarget();
        await page.goto(`${target}${entry.route}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
        await page.waitForLoadState("networkidle", { timeout: 15_000 }).catch(() => undefined);

        const destination = compareExactDestination(expectedDestinationFor(entry), page.url());
        expect(destination.passed, destination.reason).toBe(true);

        const bodyText = (await page.locator("body").innerText()).trim();
        expect(bodyText.length, `${entry.route} must not render a blank shell`).toBeGreaterThan(20);
        expect(pageErrors, `${entry.route} emitted page errors`).toEqual([]);
        expect(criticalConsoleErrors(consoleErrors), `${entry.route} emitted critical console errors`).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        expect(overflow, `${entry.route} overflows horizontally at ${viewport.name}`).toBe(false);

        if (entry.deviceClass === "TV") {
          const mutatingControls = page.getByRole("button", {
            name: /^(start|complete|dispatch|issue|accept|reject|reserve|allocate|handover|acknowledge)$/i,
          });
          expect(await mutatingControls.count(), `${entry.route} TV surface must remain read-only`).toBe(0);
        }
      });
    }
  }
});