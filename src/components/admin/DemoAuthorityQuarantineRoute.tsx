import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { NonAuthoritativeDemoBanner } from "@/components/admin/NonAuthoritativeDemoBanner";
import {
  getDemoAuthorityQuarantineEntry,
} from "@/lib/appverse/demoAuthorityQuarantine";

type Props = {
  route: string;
  children: ReactNode;
};

/**
 * Production: redirect demo/preview routes to canonical live authority.
 * Development: render legacy surface behind an explicit non-authoritative banner.
 */
export function DemoAuthorityQuarantineRoute({ route, children }: Props) {
  const entry = getDemoAuthorityQuarantineEntry(route);
  if (!entry) return <>{children}</>;

  const redirectInDev = import.meta.env.PROD || entry.action === "redirect";
  if (redirectInDev) {
    return <Navigate to={entry.canonicalRedirect} replace />;
  }

  return (
    <>
      <NonAuthoritativeDemoBanner entry={entry} />
      {children}
    </>
  );
}
