import { Badge } from "@/components/ui/badge";
import {
  projectDispatchReadiness,
  type DispatchReadinessInput,
  type DispatchReadinessStatus,
} from "@/lib/dispatch-readiness";

const STATUS_VARIANT: Record<
  DispatchReadinessStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_ready: "secondary",
  partially_ready: "outline",
  ready_for_review: "default",
  gate_eligible: "default",
  exception_blocked: "destructive",
};

interface DispatchReadinessBadgeProps {
  input: DispatchReadinessInput;
  className?: string;
}

/** Read-only readiness + gate eligibility — not dispatch completion. */
export function DispatchReadinessBadge({ input, className }: DispatchReadinessBadgeProps) {
  const projection = projectDispatchReadiness(input);
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      <Badge variant={STATUS_VARIANT[projection.readinessStatus]} className="text-[10px] uppercase">
        {projection.readinessStatus.replace(/_/g, " ")}
      </Badge>
      {projection.gateEligibility === "eligible_pending_review" && (
        <Badge variant="outline" className="text-[10px] uppercase">
          Gate eligible
        </Badge>
      )}
      {projection.openExceptions.length > 0 && (
        <Badge variant="destructive" className="text-[10px]">
          {projection.openExceptions.length} exception(s)
        </Badge>
      )}
    </div>
  );
}
