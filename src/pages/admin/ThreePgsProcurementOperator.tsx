import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, PackageSearch, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { threePgsProcurementRpc } from "@/lib/threePgsProcurementRpc";
import {
  EMPTY_THREE_PGS_RECEIPT_DRAFT,
  parseThreePgsReceiptDisposition,
  receiptDispositionFingerprint,
  type ThreePgsReceiptDispositionDraft,
} from "@/lib/threePgsReceiptDisposition";
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
  product_id: string;
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

type InventoryReceipt = {
  id: string;
  status: string;
  destination_store_code: string;
};

type InventoryReceiptLine = {
  id: string;
  product_id: string;
  sku: string;
};

type ReceivingState = {
  receiptCorrelationId: string;
  linkCorrelationId: string;
  payloadFingerprint: string;
};

// Receipt correlations must survive a reload after create but before
// record/accept completes (a lost response), or a retry mints a fresh
// correlation id and Core's idempotency can no longer recognize it as the
// same physical delivery -- creating a duplicate receipt. sessionStorage is
// deliberately per-tab (never localStorage): an in-progress receive is a
// single operator's in-flight action, not something that should silently
// resume in a different tab. This is client-side retry bookkeeping only --
// it grants no authority Core doesn't already enforce via p_correlation_id.
export const RECEIVING_CORRELATION_STORAGE_KEY = "3pgs-receiving-correlations:v1";
// An entry older than this is treated as abandoned (e.g. the tab crashed
// before the success path could clear it) so it can never permanently block
// a legitimate later receipt on the same requirement.
const RECEIVING_CORRELATION_TTL_MS = 24 * 60 * 60 * 1000;

type StoredReceivingState = ReceivingState & { storedAt: number };
type StoredReceivingCorrelations = Record<string, StoredReceivingState>;

function readStoredReceivingCorrelations(): StoredReceivingCorrelations {
  try {
    const raw = window.sessionStorage.getItem(RECEIVING_CORRELATION_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const result: StoredReceivingCorrelations = {};
    for (const [requirementId, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const candidate = value as Record<string, unknown>;
      const { receiptCorrelationId, linkCorrelationId, payloadFingerprint, storedAt } = candidate;
      if (
        typeof receiptCorrelationId !== "string" || receiptCorrelationId.length === 0
        || typeof linkCorrelationId !== "string" || linkCorrelationId.length === 0
        || typeof payloadFingerprint !== "string"
        || typeof storedAt !== "number" || !Number.isFinite(storedAt)
      ) {
        continue;
      }
      if (now - storedAt > RECEIVING_CORRELATION_TTL_MS) continue;
      result[requirementId] = { receiptCorrelationId, linkCorrelationId, payloadFingerprint, storedAt };
    }
    return result;
  } catch {
    // Malformed or inaccessible storage never widens authority -- treat it
    // as empty and let fresh correlation ids be minted.
    return {};
  }
}

function loadReceivingCorrelations(): Record<string, ReceivingState> {
  const stored = readStoredReceivingCorrelations();
  const result: Record<string, ReceivingState> = {};
  for (const [requirementId, entry] of Object.entries(stored)) {
    result[requirementId] = {
      receiptCorrelationId: entry.receiptCorrelationId,
      linkCorrelationId: entry.linkCorrelationId,
      payloadFingerprint: entry.payloadFingerprint,
    };
  }
  return result;
}

function persistReceivingState(requirementId: string, state: ReceivingState | null): void {
  try {
    const stored = readStoredReceivingCorrelations();
    if (state) {
      stored[requirementId] = { ...state, storedAt: Date.now() };
    } else {
      delete stored[requirementId];
    }
    window.sessionStorage.setItem(RECEIVING_CORRELATION_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // sessionStorage unavailable (private mode, quota) -- persistence
    // degrades to in-memory-only for this tab; still correct, just loses
    // reload survival.
  }
}

function emptyReceivingDraft(): ThreePgsReceiptDispositionDraft {
  return { ...EMPTY_THREE_PGS_RECEIPT_DRAFT };
}

/**
 * 3PGS procurement/vendor-shortage queue.
 *
 * Two independent governed bridges are composed here:
 * - vendor shortage -> procurement requirement -> physical receipt -> receipt
 *   disposition -> accepted quantity linked to the procurement requirement;
 * - P&A shortfall -> reserve -> issue -> distinct receiver acknowledgement.
 *
 * They intentionally reuse Core's existing receipt/reservation/issue stock
 * authorities. This page never writes stock tables directly.
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

  const [receivingDrafts, setReceivingDrafts] = useState<Record<string, ThreePgsReceiptDispositionDraft>>({});
  const [receiving, setReceiving] = useState<string | null>(null);
  const receivingCorrelationRef = useRef<Record<string, ReceivingState> | null>(null);
  if (receivingCorrelationRef.current === null) {
    receivingCorrelationRef.current = loadReceivingCorrelations();
  }

  const fetchData = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const [
        { data: demand, error: demandError },
        { data: reqs, error: reqError },
        { data: assemblyReqs, error: assemblyError },
      ] = await Promise.all([
        procurementDb
          .from("b2b_3pgs_pending_demand_priority")
          .select("*")
          .order("priority_rank", { ascending: true })
          .order("created_at", { ascending: true })
          .limit(100),
        procurementDb
          .from("b2b_procurement_requirements")
          .select("id, requirement_number, product_id, sku, destination_store_code, shortage_qty, fulfilled_qty, vendor_reference, expected_at, status")
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
      let reservationRows: AssemblyReservation[] = [];
      let issueEventRows: AssemblyIssueEvent[] = [];

      if (requirementNumbers.length > 0) {
        const [
          { data: reservations, error: reservationError },
          { data: issueEvents, error: issueEventError },
        ] = await Promise.all([
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
      if (await fetchData()) delete raiseCorrelationRef.current[row.demand_id];
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
        setVendorDrafts((current) => {
          const next = { ...current };
          delete next[requirementId];
          return next;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to assign the vendor.");
    } finally {
      setAssigning(null);
    }
  }, [fetchData, vendorDrafts]);

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
        setIssueDrafts((current) => {
          const next = { ...current };
          delete next[reservation.id];
          return next;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to issue stock.");
    } finally {
      setIssuing(null);
    }
  }, [fetchData, issueDrafts, assemblyIssueEvents]);

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
      toast.success("Receipt acknowledged -- 3PGS fulfilment recorded and eligible P&A work may resume.");
      if (await fetchData()) {
        delete ackCorrelationRef.current[issueEvent.id];
        setAckDrafts((current) => {
          const next = { ...current };
          delete next[issueEvent.id];
          return next;
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to acknowledge receipt.");
    } finally {
      setAcknowledging(null);
    }
  }, [fetchData, ackDrafts]);

  const handleReceive = useCallback(async (requirement: ProcurementRequirement) => {
    const remaining = requirement.shortage_qty - requirement.fulfilled_qty;
    const draft = receivingDrafts[requirement.id] ?? emptyReceivingDraft();
    const parsed = parseThreePgsReceiptDisposition(draft, remaining);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }
    const disposition = parsed.value;
    const payloadFingerprint = receiptDispositionFingerprint(disposition);
    const correlations = receivingCorrelationRef.current ?? (receivingCorrelationRef.current = loadReceivingCorrelations());
    const previousState = correlations[requirement.id];

    if (previousState && previousState.payloadFingerprint !== payloadFingerprint) {
      toast.error(
        "A previous receive attempt is pending. Restore the original receipt quantities or refresh after reconciliation before changing the disposition.",
      );
      return;
    }

    const state = previousState ?? {
      receiptCorrelationId: crypto.randomUUID(),
      linkCorrelationId: crypto.randomUUID(),
      payloadFingerprint,
    };
    correlations[requirement.id] = state;
    persistReceivingState(requirement.id, state);
    const { receiptCorrelationId, linkCorrelationId } = state;

    setReceiving(requirement.id);
    // Tracks whether create_b2b_inventory_receipt is confirmed to have
    // produced a receipt row. A validation failure here means no receipt
    // exists server-side, so the reserved correlation carries no meaning and
    // must not block a corrected resubmission. A lost response leaves this
    // false too, which is exactly right -- we can't tell whether a receipt
    // was created, so the correlation must be kept and reused on retry.
    let receiptCreated = false;
    try {
      const { data: receiptData, error: createError } = await threePgsProcurementRpc.rpc<InventoryReceipt>(
        "create_b2b_inventory_receipt",
        {
          p_receipt_number: `${requirement.requirement_number}-RCV-${receiptCorrelationId.slice(0, 8)}`,
          // Core PR #129 keeps procurement-backed vendor inward inside the
          // canonical supplier receipt vocabulary. The governed procurement
          // requirement is the source document; no fake supplier UUID is used.
          p_receipt_source: "supplier",
          p_destination_store_code: requirement.destination_store_code,
          p_source_document_type: "procurement_requirement",
          p_source_document_reference: requirement.requirement_number,
          p_lines: [{
            product_id: requirement.product_id,
            sku: requirement.sku,
            expected_qty: disposition.receivedQty,
            supplier_batch_lot: disposition.supplierBatchLot,
            expiry_date: disposition.expiryDate,
          }],
          p_correlation_id: receiptCorrelationId,
          p_notes: disposition.notes,
        },
      );
      if (createError) throw new Error(createError.message);
      if (!receiptData) throw new Error("The inventory receipt could not be created.");
      receiptCreated = true;
      const receiptId = receiptData.id;

      const { data: receiptLine, error: lineError } = await procurementDb
        .from("b2b_inventory_receipt_lines")
        .select("id, product_id, sku")
        .eq("receipt_id", receiptId)
        .limit(1)
        .maybeSingle();
      if (lineError) throw new Error(lineError.message);
      const line = receiptLine as InventoryReceiptLine | null;
      if (!line) throw new Error("The inventory receipt has no line to record against.");

      // Core requires the exact correlation carried by the receipt for both
      // record and accept. A single stable id also makes lost-response retries
      // resolve through the server row's current status instead of duplicating
      // physical evidence.
      if (receiptData.status === "expected") {
        const { error: recordError } = await threePgsProcurementRpc.rpc("record_b2b_inventory_receipt", {
          p_receipt_id: receiptId,
          p_lines: [{
            line_id: line.id,
            received_qty: disposition.receivedQty,
            supplier_batch_lot: disposition.supplierBatchLot,
            expiry_date: disposition.expiryDate,
            notes: disposition.notes,
          }],
          p_correlation_id: receiptCorrelationId,
        });
        if (recordError) throw new Error(recordError.message);
      }

      if (receiptData.status === "expected" || receiptData.status === "received") {
        let expectedBalanceVersion = 0;
        if (disposition.acceptedQty > 0) {
          const { data: balance, error: balanceError } = await procurementDb
            .from("inventory_stock_balances")
            .select("version")
            .eq("product_id", line.product_id)
            .eq("sku", line.sku)
            .eq("location_code", requirement.destination_store_code)
            .maybeSingle();
          if (balanceError) throw new Error(balanceError.message);
          expectedBalanceVersion = (balance as { version: number } | null)?.version ?? 0;
        }

        const { error: acceptError } = await threePgsProcurementRpc.rpc("accept_b2b_inventory_receipt", {
          p_receipt_id: receiptId,
          p_lines: [{
            line_id: line.id,
            accepted_qty: disposition.acceptedQty,
            damaged_qty: disposition.damagedQty,
            rejected_qty: disposition.rejectedQty,
            expected_balance_version: expectedBalanceVersion,
          }],
          p_correlation_id: receiptCorrelationId,
        });
        if (acceptError) throw new Error(acceptError.message);
      }

      // Procurement fulfilment is physical accepted quantity, never merely
      // what arrived at the door. A fully damaged/rejected receipt therefore
      // creates discrepancy evidence but leaves the shortage open.
      if (disposition.acceptedQty > 0) {
        const { error: linkError } = await threePgsProcurementRpc.rpc("link_procurement_receipt", {
          p_requirement_id: requirement.id,
          p_receipt_id: receiptId,
          p_fulfilled_qty: disposition.acceptedQty,
          p_correlation_id: linkCorrelationId,
        });
        if (linkError) throw new Error(linkError.message);
      }

      toast.success(
        disposition.acceptedQty > 0
          ? "Receipt disposition recorded. Accepted stock is held pending put-away/GRN and accepted quantity is linked to the requirement."
          : "Receipt disposition recorded. No quantity was accepted; procurement shortage remains open.",
      );
      if (await fetchData()) {
        if (receivingCorrelationRef.current) delete receivingCorrelationRef.current[requirement.id];
        persistReceivingState(requirement.id, null);
        setReceivingDrafts((current) => {
          const next = { ...current };
          delete next[requirement.id];
          return next;
        });
      }
    } catch (err) {
      if (!receiptCreated) {
        if (receivingCorrelationRef.current) delete receivingCorrelationRef.current[requirement.id];
        persistReceivingState(requirement.id, null);
      }
      toast.error(err instanceof Error ? err.message : "Failed to record the inbound receipt.");
    } finally {
      setReceiving(null);
    }
  }, [fetchData, receivingDrafts]);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PackageSearch className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">3PGS procurement queue</h1>
          <Badge variant="outline" className="text-[10px] uppercase">Vendor-shortage bridge</Badge>
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
            Governed 3PGS vendor shortage and inward
          </CardTitle>
          <CardDescription className="text-xs">
            Vendor arrival is recorded separately from accepted stock. Accepted, damaged and rejected quantities must
            reconcile to what physically arrived; accepted stock remains held until governed put-away and GRN.
          </CardDescription>
        </CardHeader>
      </Card>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">P&amp;A assembly shortfalls awaiting 3PGS fulfilment</CardTitle>
          <CardDescription className="text-xs">
            Reserve stock, issue it, then have a different receiving actor acknowledge receipt. Core credits the
            assembly component and resumes eligible P&amp;A work only after the governed acknowledgement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && assemblyRequirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open P&amp;A assembly requirements.</p>
          ) : (
            <div className="space-y-3">
              {assemblyRequirements.map((requirement) => {
                const remaining = requirement.requested_qty - requirement.fulfilled_qty;
                const reservations = assemblyReservations.filter((row) => row.demand_reference === requirement.requirement_number);
                const issueEvents = assemblyIssueEvents.filter((row) => row.destination_reference === requirement.requirement_number);
                const alreadyReserved = reservations.reduce((sum, row) => sum + row.reserved_qty, 0);
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
                        .filter((event) => event.reservation_id === reservation.id)
                        .reduce((sum, event) => sum + event.issued_qty, 0);
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
                            onChange={(event) => setIssueDrafts((current) => ({ ...current, [reservation.id]: event.target.value }))}
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
                          onChange={(event) => setAckDrafts((current) => ({ ...current, [issueEvent.id]: event.target.value }))}
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
          <CardDescription className="text-xs">
            Accepted quantity fulfils the shortage. Damaged/rejected quantity remains exception evidence and never
            becomes available stock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!loading && requirements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No procurement requirements yet.</p>
          ) : (
            <div className="space-y-3">
              {requirements.map((requirement) => {
                const vendorDraft = vendorDrafts[requirement.id] ?? { reference: "", expectedAt: "" };
                const setVendorDraft = (patch: Partial<typeof vendorDraft>) =>
                  setVendorDrafts((current) => ({ ...current, [requirement.id]: { ...vendorDraft, ...patch } }));
                const canAssignVendor = requirement.status === "open" || requirement.status === "vendor_assigned";
                const remaining = requirement.shortage_qty - requirement.fulfilled_qty;
                const canReceive = remaining > 0 && requirement.status !== "received" && requirement.status !== "cancelled";
                const receiptDraft = receivingDrafts[requirement.id] ?? emptyReceivingDraft();
                const setReceiptDraft = (patch: Partial<ThreePgsReceiptDispositionDraft>) =>
                  setReceivingDrafts((current) => ({
                    ...current,
                    [requirement.id]: { ...(current[requirement.id] ?? emptyReceivingDraft()), ...patch },
                  }));
                const setReceivedQty = (value: string) => {
                  const current = receivingDrafts[requirement.id] ?? emptyReceivingDraft();
                  const wasDefaultFullAcceptance =
                    current.acceptedQty === current.receivedQty
                    && (current.damagedQty === "" || Number(current.damagedQty) === 0)
                    && (current.rejectedQty === "" || Number(current.rejectedQty) === 0);
                  const hasNoDisposition =
                    current.acceptedQty === "" && current.damagedQty === "" && current.rejectedQty === "";
                  setReceiptDraft(
                    wasDefaultFullAcceptance || hasNoDisposition
                      ? { receivedQty: value, acceptedQty: value, damagedQty: "0", rejectedQty: "0" }
                      : { receivedQty: value },
                  );
                };

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
                        {requirement.expected_at
                          ? ` · ETA ${new Date(requirement.expected_at).toLocaleDateString(undefined, { timeZone: "UTC" })}`
                          : ""}
                      </p>
                    ) : canAssignVendor ? (
                      <div className="mt-2 flex flex-wrap items-center gap-1">
                        <Input
                          className="h-7 w-40 text-xs"
                          placeholder="Vendor reference"
                          value={vendorDraft.reference}
                          onChange={(event) => setVendorDraft({ reference: event.target.value })}
                        />
                        <Input
                          className="h-7 w-36 text-xs"
                          type="date"
                          value={vendorDraft.expectedAt}
                          onChange={(event) => setVendorDraft({ expectedAt: event.target.value })}
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

                    {canReceive ? (
                      <div className="mt-3 space-y-2 border-t pt-3">
                        <p className="font-medium">Receive &amp; disposition</p>
                        <div className="grid gap-2 sm:grid-cols-4">
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={0}
                            step="any"
                            placeholder={`Qty (of ${remaining})`}
                            aria-label="Received quantity"
                            value={receiptDraft.receivedQty}
                            onChange={(event) => setReceivedQty(event.target.value)}
                          />
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Accepted"
                            aria-label="Accepted quantity"
                            value={receiptDraft.acceptedQty}
                            onChange={(event) => setReceiptDraft({ acceptedQty: event.target.value })}
                          />
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Damaged"
                            aria-label="Damaged quantity"
                            value={receiptDraft.damagedQty}
                            onChange={(event) => setReceiptDraft({ damagedQty: event.target.value })}
                          />
                          <Input
                            className="h-8 text-xs"
                            type="number"
                            min={0}
                            step="any"
                            placeholder="Rejected"
                            aria-label="Rejected quantity"
                            value={receiptDraft.rejectedQty}
                            onChange={(event) => setReceiptDraft({ rejectedQty: event.target.value })}
                          />
                        </div>
                        <div className="grid gap-2 sm:grid-cols-3">
                          <Input
                            className="h-8 text-xs"
                            placeholder="Supplier batch / lot"
                            aria-label="Supplier batch or lot"
                            value={receiptDraft.supplierBatchLot}
                            onChange={(event) => setReceiptDraft({ supplierBatchLot: event.target.value })}
                          />
                          <Input
                            className="h-8 text-xs"
                            type="date"
                            aria-label="Expiry date"
                            value={receiptDraft.expiryDate}
                            onChange={(event) => setReceiptDraft({ expiryDate: event.target.value })}
                          />
                          <Input
                            className="h-8 text-xs"
                            placeholder="Receiving note / evidence reference"
                            aria-label="Receiving note"
                            value={receiptDraft.notes}
                            onChange={(event) => setReceiptDraft({ notes: event.target.value })}
                          />
                        </div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[11px] text-muted-foreground">
                            Accepted + damaged + rejected must equal received. Accepted stock remains held until put-away/GRN.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-3 text-[10px]"
                            disabled={receiving === requirement.id}
                            onClick={() => void handleReceive(requirement)}
                          >
                            Receive
                          </Button>
                        </div>
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
