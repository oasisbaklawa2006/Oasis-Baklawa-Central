import { Badge } from "@/components/ui/badge";

export function ExecutionRiskBadge({ internal }: { internal?: boolean }) {
  if (!internal) return null;
  return (
    <Badge variant="outline" className="text-[9px] uppercase">
      Customer risk (internal)
    </Badge>
  );
}
