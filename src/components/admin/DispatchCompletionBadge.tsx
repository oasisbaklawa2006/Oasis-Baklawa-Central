import { Badge } from "@/components/ui/badge";
import {
  projectDispatchCompletion,
  type DispatchCompletionInput,
  type DispatchCompletionStatus,
} from "@/lib/dispatch-completion";

const STATUS_VARIANT: Record<
  DispatchCompletionStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_eligible: "secondary",
  prerequisites_pending: "outline",
  completion_eligible: "default",
  completion_attested: "default",
  completion_blocked: "destructive",
  already_dispatched: "secondary",
};

interface DispatchCompletionBadgeProps {
  input: DispatchCompletionInput;
  className?: string;
}

/** Read-only completion governance — attestation does not mutate order status. */
export function DispatchCompletionBadge({ input, className }: DispatchCompletionBadgeProps) {
  const projection = projectDispatchCompletion(input);
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className ?? ""}`}>
      <Badge variant={STATUS_VARIANT[projection.completionStatus]} className="text-[10px] uppercase">
        {projection.completionStatus.replace(/_/g, " ")}
      </Badge>
      {projection.completionStatus === "completion_eligible" && (
        <Badge variant="outline" className="text-[10px] uppercase">
          Governed attest only
        </Badge>
      )}
    </div>
  );
}
