import { useMemo } from "react";
import { Box } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CartonLifecycleState } from "@/lib/inventory-operating-system/inventoryTypes";
import { CARTON_VALID_NEXT, deriveCartonRisk } from "@/lib/inventory-operating-system/cartonLifecycle";

const DEMO_STATES: CartonLifecycleState[] = ["created", "labeled", "scanned_in", "packed", "dispatched"];

export default function CartonExplorer() {
  const cards = useMemo(
    () =>
      DEMO_STATES.map((s) => ({
        state: s,
        risk: deriveCartonRisk(s),
        next: CARTON_VALID_NEXT[s],
      })),
    [],
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Box className="h-7 w-7 text-primary" aria-hidden />
        <h1 className="text-xl font-bold tracking-tight">Carton explorer</h1>
        <Badge variant="outline" className="text-[10px] uppercase">
          Lifecycle design
        </Badge>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.state} className="shadow-none ring-1 ring-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold capitalize">{c.state.replace(/_/g, " ")}</CardTitle>
              <Badge variant="secondary" className="w-fit text-[10px] uppercase">
                Risk · {c.risk}
              </Badge>
            </CardHeader>
            <CardContent className="text-[11px] text-muted-foreground">
              <p className="font-medium text-foreground">Valid next</p>
              <p>{c.next.length ? c.next.join(", ") : "Terminal"}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
