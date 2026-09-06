import type { Customer360IdentityFailure, Customer360ViewerContext } from "./customer360Types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class Customer360IdentityError extends Error {
  readonly failure: Customer360IdentityFailure;

  constructor(failure: Customer360IdentityFailure, message: string) {
    super(message);
    this.name = "Customer360IdentityError";
    this.failure = failure;
  }
}

export function normalizeCompanyId(raw: string | null | undefined): string {
  const trimmed = raw?.trim();
  if (!trimmed) {
    throw new Customer360IdentityError("invalid_company_id", "Customer identity is required.");
  }
  if (!UUID_PATTERN.test(trimmed)) {
    throw new Customer360IdentityError("invalid_company_id", "Customer identity must be a valid company UUID.");
  }
  return trimmed.toLowerCase();
}

/** Fail closed when a storefront viewer attempts cross-company access. */
export function assertCustomer360CompanyAccess(
  companyId: string,
  viewer: Customer360ViewerContext,
): void {
  if (!viewer.isStorefrontViewer) return;
  if (!viewer.viewerCompanyId) {
    throw new Customer360IdentityError(
      "ambiguous_identity",
      "Buyer identity is unresolved; Customer 360 access is blocked.",
    );
  }
  if (viewer.viewerCompanyId.toLowerCase() !== companyId.toLowerCase()) {
    throw new Customer360IdentityError(
      "cross_company_access_denied",
      "Cross-company Customer 360 access is not authorized.",
    );
  }
}

export function customer360RouteForCompany(companyId: string): string {
  return `/admin/clients/${normalizeCompanyId(companyId)}`;
}
