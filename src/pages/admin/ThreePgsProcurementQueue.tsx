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

type AssemblyRequirement = {
  id: string;
  requirement_number: string;
  sku: string;
  source_store_code: string;
  requested_qty: number;
  fulfilled_qty: number;
  status: string;
  priority: string;
};

type AssemblyReservation = {
  id: string;
  reservation_number: string;
  reserved_qty: number;
  demand_reference: string;
};

type AssemblyIssueEvent = {
  id: string;
  reservation_id: string;
  issued_qty: number;
  issued_by: string | null;
  destination_reference: string;
};

/**
 * 3PGS procurement/vendor-shortage queue -- gives the governed
 * b2b_3pgs_pending_demand_priority view and create_procurement_requirement/
 * assign_procurement_vendor (20260820100000) real, reachable callers. Before
 * this screen, both had zero callers anywhere in Central (confirmed by a
 * full reachability audit) -- schema-only despite looking wired.
 *
 * The vendor-shortage bridge section is deliberately scoped to raising a
 * requirement and assigning a vendor only. The inbound-receipt lifecycle it
 * links against (create_b2b_inventory_receipt / record_b2b_inventory_receipt /
 * accept_b2b_inventory_receipt / link_procurement_receipt) still has zero
 * callers today -- wiring those is a separate, later slice once a real
 * receiving screen exists to drive them, not something to bolt on here.
 *
 * The P&A assembly-shortfall section wires the OTHER bridge in the same
 * migration: reserve_3pgs_requirement_stock / issue_3pgs_requirement_stock /
 * acknowledge_3pgs_requirement_receipt. This is the migration's own designed
 * closure path for a b2b_assembly_3pgs_requirements row -- NOT a direct call
 * to fulfil_assembly_3pgs_requirement (an earlier version of this file did
 * that, and it was a genuine bug: it bypassed the real stock movement AND
 * acknowledge_3pgs_requirement_receipt's distinct-actor safeguard, which
 * fails closed if the same identity both issues and acknowledges so P&A can
 * never self-fulfil its own requirement). acknowledge_3pgs_requirement_receipt
 * calls the existing, unmodified fulfil_assembly_3pgs_requirement internally
 * once receipt is genuinely acknowledged by a different actor -- this file
 * never calls it directly.
 * Route: /admin/3pgs-procurement-queue.
 */
export default function ThreePgsProcurementQueue() {
  const [pendingDemand, setPendingDemand] = useState<PendingDemandRow[]>([]);
  const [requirements, setRequirements] = useState<ProcurementRequirement[]>([]);
  const [assemblyRequirements, setAssemblyRequirements] = useState<AssemblyRequirement[]>([]);
  const [assemblyReservations, setAssemblyReservations] = useState<AssemblyReservation[]>([]);
  const [assemblyIssueEvents, setAssemblyIssueEvents] = useState<AssemblyIssueEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [raising, setRaising] = useState<string | null>(null);

  const [vendorDrafts, setVendorDrafts] = useState<Record<string, { reference: string; expectedAt: string }>>({});
  const [assigning, setAssigning] = useState<string | null>(null);

  const [reserving, setReserving] = useState<string | null>(null);
  const [issueDrafts, setIssueDrafts] = useState<Record<string, string>>({});
  const [issuing, setIssuing] = useState<string | null>(null);
  const [ackDrafts, setAckDrafts] = useState<Record<string, string>>({});
  const [acknowledging, setAcknowledging] = useState<string | null>(null);

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const [{ data: demand, error: demandError }, { data: reqs, error: reqError }, { data: assemblyReqs, error: assemblyError }] = await Promise.all([
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
        procurementDb
          .from("b2b_assembly_3pgs_requirements")
          .select("id, requirement_number, sku, source_store_code, requested_qty, fulfilled_qty, status, priority")
          .in("status", ["open", "partially_fulfilled"])
          .order("created_at", { ascending: true })
          .limit(50),
      ]);
      if (demandError) throw demandError;
      if (reqError) throw reqError;
      if (assemblyError) throw assemblyError;
      const assemblyRows = (assemblyReqs ?? []) as AssemblyRequirement[];
      const requirementNumbers = assemblyRows.map((row) => row.requirement_number);

      // These two queries are only meaningful once at least one open
      // assembly requirement exists -- an empty .in() array would otherwise
      // either error or (worse, silently) return every row depending on the
      // client, so skip them entirely rather than rely on that.
      let reservationRows: AssemblyReservation[] = [];
      let issueEventRows: AssemblyIssueEvent[] = [];
      if (requirementNumbers.length > 0) {
        const [{ data: reservations, error: reservationError }, { data: issueEvents, error: issueEventError }] = await Promise.all([
          procurementDb
            .from("inventory_reservations")
            .select("id, reservation_number, reserved_qty, demand_reference")
            .eq("demand_source_type", "pna")
            .in("demand_reference", requirementNumbers)
            .gt("reserved_qty", 0),
          procurementDb
            .from("rgs_issue_events")
            .select("id, reservation_id, issued_qty, issued_by, destination_reference")
            .eq("destination_type", "pna")
            .eq("status", "issued")
            .in("destination_reference", requirementNumbers),
        ]);
        if (reservationError) throw reservationError;
        if (issueEventError) throw issueEventError;
        reservationRows = (reservations ?? []) as AssemblyReservation[];
        issueEventRows = (issueEvents ?? []) as AssemblyIssueEvent[];
      }

      setPendingDemand((demand ?? []) as PendingDemandRow[]);
      setRequirements((reqs ?? []) as ProcurementRequirement[]);
      setAssemblyRequirements(assemblyRows);
      setAssemblyReservations(reservationRows);
      setAssemblyIssueEvents(issueEventRows);
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

  // reserve_3pgs_requirement_stock bridges a b2b_assembly_3pgs_requirements
  // row into the existing reserve_rgs_stock pipeline -- the same mechanism
  // outlet/b2b/internal 3PGS demand already uses. A single fixed-argument
  // call per requirement (no user-entered payload to rotate against), so a
  // stable correlation id persisted across retries is sufficient.
  const reserveCorrelationRef = useRef<Record<string, string>>({});
  const handleReserveStock = useCallback(async (requirement: AssemblyRequirement) => {
    if (!reserveCorrelationRef.current[requirement.id]) reserveCorrelationRef.current[requirement.id] = crypto.randomUUID();
    const correlationId = reserveCorrelationRef.current[requirement.id];
    setReserving(requirement.id);
    try {
      const { error: rpcError } = await threePgsProcurementRpc.rpc("reserve_3pgs_requirement_stock", {
        p_requirement_id: requirement.id,
        p_priority: requirement.priority || "normal",
        p_correlation_id: correlationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Stock reserved against the 3PGS requirement.");
      if (await fetchData()) delete reserveCorrelationRef.current[requirement.id];
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reserve stock.");
    } finally {
      setReserving(null);
    }
  }, [fetchData]);

  // issue_3pgs_requirement_stock bridges the reservation into the existing
  // issue_rgs_stock pipeline. Dispatch alone does not fulfil the
  // requirement -- acknowledge_3pgs_requirement_receipt (below) is the only
  // path that does, and it requires a genuinely different receiving actor.
  const issueCorrelationRef = useRef<Record<string, { qty: number; id: string }>>({});
  const handleIssueStock = useCallback(async (requirement: AssemblyRequirement, reservation: AssemblyReservation) => {
    const raw = issueDrafts[reservation.id] ?? "";
    const qty = Number(raw);
    if (!raw || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid issue quantity.");
      return;
    }
    const alreadyIssued = assemblyIssueEvents
      .filter((event) => event.reservation_id === reservation.id)
      .reduce((sum, event) => sum + event.issued_qty, 0);
    const remainingReserved = reservation.reserved_qty - alreadyIssued;
    if (qty > remainingReserved) {
      toast.error(`Issue quantity (${qty}) exceeds what remains reserved (${remainingReserved}).`);
      return;
    }
    const existing = issueCorrelationRef.current[reservation.id];
    const correlationId = existing && existing.qty === qty ? existing.id : crypto.randomUUID();
    issueCorrelationRef.current[reservation.id] = { qty, id: correlationId };
    setIssuing(reservation.id);
    try {
      const { error: rpcError } = await threePgsProcurementRpc.rpc("issue_3pgs_requirement_stock", {
        p_requirement_id: requirement.id,
        p_reservation_id: reservation.id,
        p_issue_qty: qty,
        p_correlation_id: correlationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Stock issued -- awaiting receiver acknowledgement.");
      if (await fetchData()) {
        delete issueCorrelationRef.current[reservation.id];
        setIssueDrafts((current) => { const next = { ...current }; delete next[reservation.id]; return next; });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue stock.");
    } finally {
      setIssuing(null);
    }
  }, [fetchData, issueDrafts, assemblyIssueEvents]);

  // acknowledge_3pgs_requirement_receipt is the ONLY path that advances a
  // requirement's fulfilled_qty -- it calls the existing acknowledge_rgs_issue
  // and fulfil_assembly_3pgs_requirement internally once a genuinely
  // different actor than the issuer confirms receipt (server-side, fails
  // closed on self-acknowledgement; this UI cannot and does not attempt to
  // pre-check that client-side).
  const ackCorrelationRef = useRef<Record<string, { qty: number; id: string }>>({});
  const handleAcknowledgeReceipt = useCallback(async (issueEvent: AssemblyIssueEvent) => {
    const raw = ackDrafts[issueEvent.id] ?? "";
    const qty = Number(raw);
    if (!raw || !Number.isFinite(qty) || qty <= 0) {
      toast.error("Enter a valid received quantity.");
      return;
    }
    if (qty > issueEvent.issued_qty) {
      toast.error(`Received quantity (${qty}) cannot exceed what was issued (${issueEvent.issued_qty}).`);
      return;
    }
    const existing = ackCorrelationRef.current[issueEvent.id];
    const correlationId = existing && existing.qty === qty ? existing.id : crypto.randomUUID();
    ackCorrelationRef.current[issueEvent.id] = { qty, id: correlationId };
    setAcknowledging(issueEvent.id);
    try {
      const { error: rpcError } = await threePgsProcurementRpc.rpc("acknowledge_3pgs_requirement_receipt", {
        p_issue_event_id: issueEvent.id,
        p_received_qty: qty,
        p_correlation_id: correlationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      toast.success("Receipt acknowledged -- 3PGS requirement fulfilment recorded.");
      if (await fetchData()) {
        delete ackCorrelationRef.current[issueEvent.id];
        setAckDrafts((current) => { const next = { ...current }; delete next[issueEvent.id]; return next; });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge receipt.");
    } finally {
      setAcknowledging(null);
    }
  }, [fetchData, ackDrafts]);

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
          <CardTitle className="text-sm">P&amp;A assembly shortfalls awaiting 3PGS fulfilment</CardTitle>
          <CardDescription className="text-xs">
            Raised directly against a blocked assembly job/component (distinct from the vendor-shortage bridge below).
            Reserve stock, issue it, then have a DIFFERENT receiving actor acknowledge receipt -- acknowledgement is
            what actually records fulfilment and resumes nothing on its own for the P&amp;A job.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && assemblyRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open P&amp;A assembly requirements.</p>
          ) : (
            <div className="space-y-3">
              {assemblyRequirements.map((requirement) => {
                const remaining = requirement.requested_qty - requirement.fulfilled_qty;
                const reservations = assemblyReservations.filter((r) => r.demand_reference === requirement.requirement_number);
                const issueEvents = assemblyIssueEvents.filter((e) => e.destination_reference === requirement.requirement_number);
                const alreadyReserved = reservations.reduce((sum, r) => sum + r.reserved_qty, 0);
                return (
                  <div key={requirement.id} className="rounded-lg border p-3 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span>
                        {requirement.requirement_number} · {requirement.sku} · {requirement.source_store_code} ·{" "}
                        {requirement.fulfilled_qty} / {requirement.requested_qty}
                      </span>
                      <Badge variant="secondary" className="uppercase">{requirement.status.replace(/_/g, " ")}</Badge>
                    </div>

                    {remaining - alreadyReserved > 0 ? (
                      <div className="mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={reserving === requirement.id}
                          onClick={() => void handleReserveStock(requirement)}
                        >
                          Reserve stock ({remaining - alreadyReserved} outstanding)
                        </Button>
                      </div>
                    ) : null}

                    {reservations.map((reservation) => {
                      const alreadyIssued = assemblyIssueEvents
                        .filter((e) => e.reservation_id === reservation.id)
                        .reduce((sum, e) => sum + e.issued_qty, 0);
                      const remainingReserved = reservation.reserved_qty - alreadyIssued;
                      return (
                        <div key={reservation.id} className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
                          <span className="text-muted-foreground">
                            Reserved {reservation.reservation_number}: {reservation.reserved_qty}
                          </span>
                          <Input
                            className="h-7 w-24 text-xs"
                            type="number"
                            min={0}
                            max={remainingReserved}
                            step="any"
                            placeholder={`Up to ${remainingReserved}`}
                            value={issueDrafts[reservation.id] ?? ""}
                            onChange={(e) => setIssueDrafts((current) => ({ ...current, [reservation.id]: e.target.value }))}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-[10px]"
                            disabled={issuing === reservation.id}
                            onClick={() => void handleIssueStock(requirement, reservation)}
                          >
                            Issue to P&amp;A
                          </Button>
                        </div>
                      );
                    })}

                    {issueEvents.map((issueEvent) => (
                      <div key={issueEvent.id} className="mt-2 flex flex-wrap items-center gap-1 border-t pt-2">
                        <span className="text-muted-foreground">Issued {issueEvent.issued_qty} -- awaiting receipt</span>
                        <Input
                          className="h-7 w-24 text-xs"
                          type="number"
                          min={0}
                          max={issueEvent.issued_qty}
                          step="any"
                          placeholder={`Up to ${issueEvent.issued_qty}`}
                          value={ackDrafts[issueEvent.id] ?? ""}
                          onChange={(e) => setAckDrafts((current) => ({ ...current, [issueEvent.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[10px]"
                          disabled={acknowledging === issueEvent.id}
                          onClick={() => void handleAcknowledgeReceipt(issueEvent)}
                        >
                          Acknowledge receipt
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
