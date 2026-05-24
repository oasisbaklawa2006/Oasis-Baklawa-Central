import { useMemo } from "react";
import { ScanLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OperationalTimeline } from "@/components/admin/OperationalTimeline";
import { buildBarcodeOperationalFeed } from "@/lib/operational-events/barcodeOperationalFeed";
import { dedupeOperationalEventsById } from "@/lib/operational-events/normalize";

export default function ScanTimeline() {
  const events = useMemo(
    () =>
      dedupeOperationalEventsById(
        buildBarcodeOperationalFeed({
          scans: [
            { id: "s1", domain: "carton", barcodeText: "CTN-100", sequence: 1 },
            { id: "s2", domain: "carton", barcodeText: "CTN-100", sequence: 2 },
            { id: "s3", domain: "dispatch", barcodeText: "DSP-9", sequence: 1 },
          ],
          financeReleased: false,
        }),
      ),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <ScanLine className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Scan timeline</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Demo window
        </Badge>
      </header>
      <p className="text-xs text-muted-foreground">
        Sample scan rows intentionally trigger duplicate + finance gating anomalies for UI validation — replace with bounded inbox/export feed when available.
      </p>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Barcode anomaly projections</CardTitle>
        </CardHeader>
        <CardContent>
          <OperationalTimeline events={events} showFilters={false} defaultFilter="all" ariaLabel="Scan anomaly timeline" />
        </CardContent>
      </Card>
    </div>
  );
}
