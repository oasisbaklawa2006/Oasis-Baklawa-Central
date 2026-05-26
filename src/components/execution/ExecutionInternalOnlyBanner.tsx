import { Shield } from "lucide-react";
import { EXECUTION_UX_LABELS } from "@/lib/execution-ux/executionUxConstants";

/** Shared internal-only notice for execution surfaces. */
export function ExecutionInternalOnlyBanner({ extra }: { extra?: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-50"
      role="status"
      aria-label={EXECUTION_UX_LABELS.internalOnly}
    >
      <Shield className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>
        {EXECUTION_UX_LABELS.internalOnly}
        {extra ? ` — ${extra}` : null}
      </span>
    </div>
  );
}
