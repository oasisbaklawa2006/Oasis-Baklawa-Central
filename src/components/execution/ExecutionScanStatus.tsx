import { ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ExecutionScanStatus({
  status,
  issue,
}: {
  status: string | null;
  issue?: boolean;
}) {
  if (!status) {
    return <span className="text-[10px] text-muted-foreground">No scan</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px]">
      <ScanLine className="h-3 w-3" aria-hidden />
      <Badge variant={issue ? "destructive" : "secondary"} className="text-[9px]">
        {status}
      </Badge>
    </span>
  );
}
