import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, PackageSearch, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { threePgsProcurementRpc } from "@/lib/threePgsProcurementRpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Temporary typed boundary for `b2b_3pgs_pending_demand_priority` and
// `b2b_procurement_requirements`, pending regenerated project-wide
// Supabase definitions -- same escape hatch pattern used elsewhere in this
// programme (ReadyGoodsStore.tsx, ThirdPartyPackingMaterialCatalogue.tsx).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const procurementDb = supabase as unknown as { from: (relation: string) => any };

type PendingDemandRow = {
  demand_source_type: "pna" | "outlet" | "b2b" | "internal";
  priority_rank: number;
  demand_id: string;
  demand_reference: string;
  product_id: string;
  sku: string;
  location_code: string;
  outstanding_qty: number;
  priority: string;
  created_at: string;
};

type ProcurementRequirement = {
  id: string;
  requirement_number: string;
  sku: string;
  destination_store_code: string;
  shortage_qty: number;
  fulfilled_qty: number;
  vendor_reference: string | null;
  expected_at: string | null;
  status: string;
};

/**
 * 3PGS procurement/vendor-shortage queue -- gives the governed
 * b2b_3pgs_pending_demand_priority view and the create_procurement_requirement/
 * assign_procurement_vendor RPCs (added 20260820100000) real, reachable
 * callers. Before this screen, the entire 3PGS procurement bridge had zero
 * callers anywhere in Central (confirmed by a full reachability audit) --
 * schema-only despite looking wired.
 *
 * Deliberately scoped to raising a requirement and assigning a vendor only.
 * The inbound-receipt lifecycle this bridge links against
 * (create_b2b_inventory_receipt / record_b2b_inventory_receipt /
 * accept_b2b_inventory_receipt / link_procurement_receipt) and the P&A
 * reservation bridge (reserve_3pgs_requirement_stock / etc.) also have zero
 * callers today -- wiring those is a separate, later slice once a real
 * receiving screen exists to drive them, not something to bolt on here.
 * Route: /admin/3pgs-procurement-queue.
 */
export default function ThreePgsProcurementQueue() {
  const [pendingDemand, setPendingDemand] = useState<PendingDemandRow[]>([]);
  const [requirements, setRequirements] = useState<ProcurementRequirement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raising, setRaising] = useState<string | null>(null);

  const [vendorDrafts, setVendorDrafts] = useState<Record<string, { reference: string; expectedAt: string }>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: demand, error: demandError }, { data: reqs, error: reqError }] = await Promise.all([
        procurementDb
          .from("b2b_3pgs_pending_demand_priority")
          .select("*")
          .order("priority_rank", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(100),
        procurementDb
          .from("b2b_procurement_requirements")
          .select("id, requirement_number, sku, destination_store_code, shortage_qty, fulfilled_qty, vendor_reference, expected_at, status")
          .order("created_at", { ascending: false })
          .limit(50),
      ]);
      if (demandError) throw demandError;
      if (reqError) throw reqError;
      setPendingDemand((demand ?? []) as PendingDemandRow[]);
      setRequirements((reqs ?? []) as ProcurementRequirement[]);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load the 3PGS procurement queue.");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // create_procurement_requirement is idempotent by correlation_id; persist
  // one id per demand row across a failed retry so a lost-response retry
  // replays into the same call instead of raising a duplicate requirement.
  const raiseCorrelationRef = useRef<Record<string, string>>({});
  const handleRaiseRequirement = useCallback(async (row: PendingDemandRow) => {
    if (!raiseCorrelationRef.current[row.demand_id]) raiseCorrelationRef.current[row.demand_id] = crypto.randomUUID();
    const correlationId = raiseCorrelationRef.current[row.demand_id];
    setRaising(row.demand_id);
    try {
      const { error: rpcError } = await threePgsProcurementRpc.rpc("create_procurement_requirement", {
        p_source_type: row.demand_source_type === "pna" ? "assembly_3pgs_requirement" : "inventory_reservation",
        p_source_reference: row.demand_reference,
        p_product_id: row.product_id,
        p_sku: row.sku,
        p_destination_store_code: row.location_code,
        p_shortage_qty: row.outstanding_qty,
        p_correlation_id: correlationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Procurement requirement raised.");
      if (await fetchData()) {
        delete raiseCorrelationRef.current[row.demand_id];
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to raise the procurement requirement.");
    } finally {
      setRaising(null);
    }
  }, [fetchData]);

  const assignCorrelationRef = useRef<Record<string, string>>({});
  const handleAssignVendor = useCallback(async (requirementId: string) => {
    const draft = vendorDrafts[requirementId];
    const vendorReference = draft?.reference?.trim();
    if (!vendorReference) {
      toast.error("A vendor reference is required.");
      return;
    }
    const expectedAtDate = draft.expectedAt ? new Date(draft.expectedAt) : null;
    if (expectedAtDate && Number.isNaN(expectedAtDate.getTime())) {
      toast.error("The expected date is invalid.");
      return;
    }
    if (!assignCorrelationRef.current[requirementId]) assignCorrelationRef.current[requirementId] = crypto.randomUUID();
    const correlationId = assignCorrelationRef.current[requirementId];
    setAssigning(requirementId);
    try {
      const { error: rpcError } = await threePgsProcurementRpc.rpc("assign_procurement_vendor", {
        p_requirement_id: requirementId,
        p_vendor_reference: vendorReference,
        p_expected_at: expectedAtDate ? expectedAtDate.toISOString() : null,
        p_correlation_id: correlationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Vendor assigned.");
      if (await fetchData()) {
        delete assignCorrelationRef.current[requirementId];
        setVendorDrafts((current) => { const next = { ...current }; delete next[requirementId]; return next; });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign the vendor.");
    } finally {
      setAssigning(null);
    }
  }, [fetchData, vendorDrafts]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PackageSearch className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">3PGS procurement queue</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Vendor-shortage bridge
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void fetchData()} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <Card className="border-amber-500/40 bg-amber-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm text-amber-900 dark:text-amber-100">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Vendor-shortage bridge only -- no receipt linking yet
          </CardTitle>
          <CardDescription className="text-xs">
            Raises a procurement requirement and records a vendor/ETA. Linking an accepted inbound receipt back to a
            requirement is a separate, later slice.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Pending 3PGS demand (priority order: P&amp;A &gt; Outlet &gt; B2B &gt; Internal)</CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && pendingDemand.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending demand.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Store</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead>Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDemand.map((row) => (
                    <TableRow key={row.demand_id}>
                      <TableCell className="text-xs">{row.sku}</TableCell>
                      <TableCell className="text-xs uppercase">{row.demand_source_type}</TableCell>
                      <TableCell className="text-xs">{row.location_code}</TableCell>
                      <TableCell className="text-right text-xs">{row.outstanding_qty}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={raising === row.demand_id}
                          onClick={() => void handleRaiseRequirement(row)}
                        >
                          Raise procurement requirement
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Procurement requirements</CardTitle>
        </CardHeader>
        <CardContent>
          {!loading && requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No procurement requirements yet.</p>
          ) : (
            <div className="space-y-3">
              {requirements.map((requirement) => {
                const draft = vendorDrafts[requirement.id] ?? { reference: "", expectedAt: "" };
                const setDraft = (patch: Partial<typeof draft>) =>
                  setVendorDrafts((current) => ({ ...current, [requirement.id]: { ...draft, ...patch } }));
                const canAssignVendor = requirement.status === "open" || requirement.status === "vendor_assigned";
                return (
                  <div key={requirement.id} className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {requirement.requirement_number} · {requirement.sku} · {requirement.destination_store_code} ·{" "}
                        {requirement.fulfilled_qty} / {requirement.shortage_qty}
                      </span>
                      <Badge variant={requirement.status === "received" ? "outline" : "secondary"} className="uppercase">
                        {requirement.status.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    {requirement.vendor_reference ? (
                      <p className="mt-1 text-muted-foreground">
                        Vendor: {requirement.vendor_reference}
                        {requirement.expected_at ? ` · ETA ${new Date(requirement.expected_at).toLocaleDateString(undefined, { timeZone: "UTC" })}` : ""}
                      </p>
                    ) : canAssignVendor ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Input
                          className="h-7 w-40 text-xs"
                          placeholder="Vendor reference"
                          value={draft.reference}
                          onChange={(e) => setDraft({ reference: e.target.value })}
                        />
                        <Input
                          className="h-7 w-36 text-xs"
                          type="date"
                          value={draft.expectedAt}
                          onChange={(e) => setDraft({ expectedAt: e.target.value })}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={assigning === requirement.id}
                          onClick={() => void handleAssignVendor(requirement.id)}
                        >
                          Assign vendor
                        </Button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
