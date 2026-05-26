import { Badge } from "@/components/ui/badge";

export function ExecutionSlaBadge({ severity }: { severity: string }) {
  const variant =
    severity === "critical" || severity === "breached"
      ? "destructive"
      : severity === "aging"
        ? "default"
        : "secondary";
  return (
    <Badge variant={variant} className="text-[10px] uppercase">
      SLA {severity}
    </Badge>
  );
}
