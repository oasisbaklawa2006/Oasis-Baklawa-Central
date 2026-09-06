import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import type { DemoAuthorityQuarantineEntry } from "@/lib/appverse/demoAuthorityQuarantine";

/** Explicit non-authoritative notice for dev-only demo/preview surfaces (Point 58). */
export function NonAuthoritativeDemoBanner({ entry }: { entry: DemoAuthorityQuarantineEntry }) {
  return (
    <div
      className="mb-4 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
      role="alert"
      data-testid="non-authoritative-demo-banner"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        <strong>Non-authoritative preview — dev only.</strong> {entry.label} is quarantined and must
        not be used for operational decisions. Canonical live authority:{" "}
        <Link to={entry.canonicalRedirect} className="font-semibold underline">
          {entry.canonicalRedirect}
        </Link>
        {entry.notes ? ` — ${entry.notes}` : null}
      </span>
    </div>
  );
}
