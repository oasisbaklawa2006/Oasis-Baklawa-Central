import { Shield } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface OperationalReadOnlyBannerProps {
  warnings?: string[];
}

export function OperationalReadOnlyBanner({ warnings = [] }: OperationalReadOnlyBannerProps) {
  return (
    <Alert className="border-amber-200/80 bg-amber-50/40 dark:bg-amber-950/20">
      <Shield className="h-4 w-4" aria-hidden />
      <AlertTitle className="text-sm">Read-only operational projection</AlertTitle>
      <AlertDescription className="text-xs text-muted-foreground">
        No approve, release, dispatch, notify, stock deduction, or queue claim actions. Data is loaded with select-only
        reads.
        {warnings.length > 0 ? (
          <ul className="mt-2 list-inside list-disc">
            {warnings.slice(0, 5).map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        ) : null}
      </AlertDescription>
    </Alert>
  );
}
