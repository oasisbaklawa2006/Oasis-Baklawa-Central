import { ScanLine } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ScanAnomalyKind } from "@/lib/barcode/scanEventTypes";

/** Reference list only — not derived from any scan feed or device. */
const ANOMALY_KIND_REFERENCE: { kind: ScanAnomalyKind; description: string }[] = [
  { kind: "duplicate_scan", description: "Same barcode text seen more than once in a bounded window." },
  { kind: "out_of_order_scan", description: "Sequence regression for the same barcode text." },
  {
    kind: "dispatch_without_finance_release",
    description: "Dispatch-domain scan while finance release flag is false (policy projection).",
  },
  { kind: "carton_mismatch", description: "Reserved for when carton identity checks are wired to a feed." },
  { kind: "damaged_carton", description: "Reserved for damage attestations from operators or QC feeds." },
  { kind: "missing_barcode", description: "Empty or whitespace-only scan payload." },
];

/**
 * Scan timeline — no hardware, no persisted scan rows, no illustrative timeline events.
 */
export default function ScanTimeline() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <ScanLine className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Scan timeline</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Feed pending
        </Badge>
      </header>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base">No operational scan window</CardTitle>
          <CardDescription className="text-sm leading-relaxed">
            No real scan feed connected yet. The scan lifecycle engine in <code className="text-xs">src/lib/barcode/</code> is
            available for pure derivation only; hardware and bounded event ingestion are still pending.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>When a feed exists, this page will show a bounded, auditable timeline — never silent or fabricated scan events.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Anomaly kinds (documentation)</CardTitle>
          <CardDescription className="text-xs">
            These are the anomaly categories the engine can derive once real scan rows are supplied. No rows below are live
            or example scans.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {ANOMALY_KIND_REFERENCE.map(({ kind, description }) => (
            <div key={kind} className="rounded-md border border-border/60 bg-muted/20 px-3 py-2">
              <p className="text-xs font-mono font-medium text-foreground">{kind}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
