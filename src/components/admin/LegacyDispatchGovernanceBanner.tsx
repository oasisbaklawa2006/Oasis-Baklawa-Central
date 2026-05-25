import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { DISPATCH_FINALIZATION_ROUTE } from "@/lib/dispatch-finalization/legacyDispatchGuard";

interface LegacyDispatchGovernanceBannerProps {
  /** e.g. AdminPackingDispatch, Security Gate */
  pageLabel: string;
  className?: string;
}

export function LegacyDispatchGovernanceBanner({ pageLabel, className }: LegacyDispatchGovernanceBannerProps) {
  return (
    <div
      className={`flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100 ${className ?? ""}`}
      role="status"
    >
      <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" aria-hidden />
      <div className="space-y-1">
        <p className="font-semibold">Legacy dispatch actions moved to governed finalization</p>
        <p className="text-xs leading-relaxed opacity-90">
          {pageLabel} no longer sets <code className="text-[11px]">orders.status</code> to dispatched. Use the
          governed board after readiness (4B), finance (4C), and completion attestation (4D).
        </p>
        <Link
          to={DISPATCH_FINALIZATION_ROUTE}
          className="inline-block text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          Open dispatch finalization →
        </Link>
      </div>
    </div>
  );
}
