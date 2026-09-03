import { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, LockKeyhole, ReceiptText, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  decideFinanceDispatchClearance,
  issueFinalInvoice,
  receiveSubmittedB2bDpls,
  recordEwayEvidence,
  type FinanceExitFacts,
} from "@/lib/order-authority/financeExitAuthorityClient";
import {
  buildFinalPaymentPiCorrelationId,
  buildFinalPaymentPiIdempotencyKey,
  issueFinalPaymentPiRevision,
  type FinalPaymentPiFacts,
  type FinalPaymentPiPaymentAction,
} from "@/lib/order-authority/finalPaymentPiAuthorityClient";
import {
  financeExitStage,
  loadGovernedFinanceExitProjection,
} from "@/lib/order-authority/financeExitProjection";
import { isGovernedHttpsPaymentLink } from "@/lib/order-authority/governedPaymentLink";
import { clearOrderForDispatch } from "@/lib/order-authority/orderAuthorityClient";

type FinanceOrder = Pick<
  Database["public"]["Tables"]["orders"]["Row"],
  "id" | "status" | "company_id" | "sales_order_value"
> & { company?: { business_name: string } | null };

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function localCalendarDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function deadlineLabel(value: string | null) {
  if (!value) return "Pending final invoice";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(date);
}

function stage(facts: FinanceExitFacts | null, finalPaymentPi: FinalPaymentPiFacts | null) {
  return financeExitStage(facts, finalPaymentPi);
}

const AdminAccountsRelease = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
  const [selected, setSelected] = useState<FinanceOrder | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [facts, setFacts] = useState<FinanceExitFacts | null>(null);
  const [finalPaymentPi, setFinalPaymentPi] = useState<FinalPaymentPiFacts | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const [finalPaymentDocumentReference, setFinalPaymentDocumentReference] = useState("");
  const [finalPaymentAction, setFinalPaymentAction] = useState<FinalPaymentPiPaymentAction>("BANK_TRANSFER");
  const [finalPaymentLink, setFinalPaymentLink] = useState("");
  const [finalPaymentInstructions, setFinalPaymentInstructions] = useState("Transfer the exact balance due using the governed bank details on file.");
  const [finalPaymentReason, setFinalPaymentReason] = useState("Finance DPL and frozen commercial terms verified");

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(localCalendarDate);
  const [invoiceDocumentReference, setInvoiceDocumentReference] = useState("");
  const [invoiceReason, setInvoiceReason] = useState("Final DPL and frozen commercial terms verified");

  const [ewayStatus, setEwayStatus] = useState<"VALIDATED" | "NOT_REQUIRED">("NOT_REQUIRED");
  const [ewayNumber, setEwayNumber] = useState("");
  const [ewayDocumentReference, setEwayDocumentReference] = useState("");
  const [ewayReason, setEwayReason] = useState("E-way applicability reviewed against the final invoice movement");
  const [ewayValidUntil, setEwayValidUntil] = useState("");

  const loadOrders = useCallback(async (selectedId?: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id,status,company_id,sales_order_value,company:companies(business_name)")
      .not("status", "in", '("draft","cart")')
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    const rows = (data ?? []) as FinanceOrder[];
    setOrders(rows);
    if (selectedId && selectedIdRef.current === selectedId) {
      const fresh = rows.find((order) => order.id === selectedId);
      if (fresh) setSelected(fresh);
    }
    setLoading(false);
  }, []);

  const refreshFacts = useCallback(async (order: FinanceOrder) => {
    try {
      const projection = await loadGovernedFinanceExitProjection(order.id);
      if (selectedIdRef.current === order.id) {
        setFacts(projection.facts);
        setFinalPaymentPi(projection.finalPaymentPi);
      }
    } catch (error) {
      if (selectedIdRef.current === order.id) {
        setFacts(null);
        setFinalPaymentPi(null);
        toast.error(error instanceof Error ? error.message : "Finance Exit facts unavailable");
      }
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const run = async (name: string, action: () => Promise<unknown>) => {
    const actionOrder = selected;
    const actionOrderId = actionOrder?.id ?? null;
    setActing(name);
    try {
      await action();
      toast.success("Governed Finance action recorded");
      if (actionOrder && selectedIdRef.current === actionOrderId) {
        await refreshFacts(actionOrder);
        await loadOrders(actionOrderId ?? undefined);
      } else {
        await loadOrders();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Finance action failed");
    } finally {
      setActing(null);
    }
  };

  const choose = async (order: FinanceOrder) => {
    selectedIdRef.current = order.id;
    setSelected(order);
    setFacts(null);
    setFinalPaymentPi(null);
    await refreshFacts(order);
  };

  const actorId = user?.id ?? "";
  const finalPaymentInputIncomplete =
    !finalPaymentDocumentReference.trim() ||
    !finalPaymentInstructions.trim() ||
    !finalPaymentReason.trim() ||
    (finalPaymentAction === "PAY_NOW" && !isGovernedHttpsPaymentLink(finalPaymentLink));
  const invoiceInputIncomplete =
    !invoiceNumber.trim() ||
    !invoiceDate.trim() ||
    !invoiceDocumentReference.trim() ||
    !invoiceReason.trim();
  const ewayInputIncomplete =
    ewayStatus === "VALIDATED" && (!ewayNumber.trim() || !ewayDocumentReference.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-h2 text-foreground">Finance Exit Board</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Canonical post-factory commercial authority through release to the independent physical gate. DPL/carton truth comes only from governed Dispatch; payment verification is not Finance Clearance.
          </p>
        </div>
        <Button variant="outline" onClick={() => void loadOrders(selected?.id)} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="rounded-xl border border-amber-300/50 bg-amber-50/60 p-4 text-sm text-amber-950">
        <div className="flex items-center gap-2 font-semibold">
          <LockKeyhole className="h-4 w-4" /> Legacy mutation paths retired
        </div>
        <p className="mt-1">
          This surface does not create shipment records or cartons, estimate packing truth, mutate wallet balances, fabricate movement evidence, process complaints, or perform post-window commercial closure.
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(320px,0.8fr)_minmax(540px,1.2fr)]">
        <section className="rounded-xl border bg-card">
          <div className="border-b px-4 py-3 font-semibold">Orders</div>
          <div className="max-h-[680px] divide-y overflow-auto">
            {loading && (
              <div className="p-6 text-sm text-muted-foreground">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading orders…
              </div>
            )}
            {!loading && orders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => void choose(order)}
                disabled={acting !== null}
                className={`w-full p-4 text-left transition-colors hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-60 ${selected?.id === order.id ? "bg-muted" : ""}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{order.company?.business_name ?? "Company"}</span>
                  <Badge variant="outline">{order.status}</Badge>
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{order.id.slice(0, 8)}…</span>
                  <span>{money(order.sales_order_value)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          {!selected ? (
            <div className="rounded-xl border bg-card p-10 text-center text-muted-foreground">
              Select an order to load canonical Finance Exit facts.
            </div>
          ) : (
            <>
              <div className="rounded-xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Current governed stage</p>
                    <p className="mt-1 text-lg font-semibold">{stage(facts, finalPaymentPi)}</p>
                  </div>
                  <Button variant="outline" onClick={() => void refreshFacts(selected)} disabled={acting !== null}>
                    <RefreshCw className="mr-2 h-4 w-4" />Facts
                  </Button>
                </div>

                {facts && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">DPL receipt</p>
                      <p className="mt-1 font-medium">{facts.financeDplReceiptId ? "Frozen" : "Pending"}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Final-payment PI</p>
                      <p className="mt-1 font-medium">
                        {finalPaymentPi?.available
                          ? `${finalPaymentPi.customerVisiblePiNumber ?? "PI"} · rev ${finalPaymentPi.revisionNumber ?? "?"}`
                          : "Pending"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {finalPaymentPi?.settled ? "Settled" : finalPaymentPi?.available ? money(finalPaymentPi.balanceDue) : ""}
                      </p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Final invoice</p>
                      <p className="mt-1 font-medium">{facts.invoiceNumber ?? "Pending"}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground">{facts.invoiceDate ?? ""}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Dispatch Clearance</p>
                      <p className="mt-1 font-medium">{facts.dispatchClearanceDecision ?? "Pending"}</p>
                    </div>
                    <div className="rounded-lg bg-muted p-3">
                      <p className="text-muted-foreground">Ticket-raise window</p>
                      <p className="mt-1 font-medium">
                        {facts.complaintWindowOpen == null ? "Pending invoice" : facts.complaintWindowOpen ? "Open" : "Expired"}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">Deadline: {deadlineLabel(facts.complaintDeadline)}</p>
                      {facts.invoiceDate && <p className="mt-1 text-[10px] text-muted-foreground">Invoice date = Day 1</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <ReceiptText className="h-4 w-4" />1. Receive governed Dispatch DPL
                </div>
                <p className="text-xs text-muted-foreground">
                  Core aggregates every current submitted FACT-C2 DPL for this SO. No quantities or carton IDs are accepted from this browser.
                </p>
                <Button
                  disabled={!actorId || !!facts?.financeDplReceiptId || acting !== null}
                  onClick={() => void run("dpl", () => receiveSubmittedB2bDpls(selected.id, `central-finance-dpl-review:${selected.id}`, actorId))}
                >
                  {acting === "dpl" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Accept submitted DPLs
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4" />2. Issue DPL-bound final-payment PI revision
                </div>
                <p className="text-xs text-muted-foreground">
                  PI requests final payment. Final invoice does not request payment. Core derives the exact payable from the immutable Finance DPL receipt and frozen commercial version.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="md:col-span-2">
                    <Label>Document reference</Label>
                    <Input
                      value={finalPaymentDocumentReference}
                      onChange={(event) => setFinalPaymentDocumentReference(event.target.value)}
                      placeholder="Immutable storage/document reference for the final-payment PI"
                    />
                  </div>
                  <div>
                    <Label>Payment action</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={finalPaymentAction}
                      onChange={(event) => setFinalPaymentAction(event.target.value as FinalPaymentPiPaymentAction)}
                    >
                      <option value="BANK_TRANSFER">Bank transfer</option>
                      <option value="PAY_NOW">Pay now</option>
                      <option value="CONTACT_FINANCE">Contact finance</option>
                    </select>
                  </div>
                  <div>
                    <Label>Payment link</Label>
                    <Input
                      disabled={finalPaymentAction !== "PAY_NOW"}
                      value={finalPaymentLink}
                      onChange={(event) => setFinalPaymentLink(event.target.value)}
                      placeholder="Required for Pay now"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Payment instructions</Label>
                    <Input value={finalPaymentInstructions} onChange={(event) => setFinalPaymentInstructions(event.target.value)} />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Reason</Label>
                    <Input value={finalPaymentReason} onChange={(event) => setFinalPaymentReason(event.target.value)} />
                  </div>
                </div>
                <Button
                  disabled={
                    !actorId ||
                    !facts?.financeDplReceiptId ||
                    !facts.piId ||
                    !facts.commercialVersionId ||
                    !!facts.finalInvoiceId ||
                    acting !== null ||
                    finalPaymentInputIncomplete
                  }
                  onClick={() => void run("final-payment-pi", async () => {
                    const identity = JSON.stringify({
                      orderId: selected.id,
                      piId: facts!.piId,
                      commercialVersionId: facts!.commercialVersionId,
                      financeDplReceiptId: facts!.financeDplReceiptId,
                      documentReference: finalPaymentDocumentReference.trim(),
                      paymentAction: finalPaymentAction,
                      paymentLink: finalPaymentLink.trim() || null,
                      paymentInstructions: finalPaymentInstructions.trim(),
                      reason: finalPaymentReason.trim(),
                    });
                    return issueFinalPaymentPiRevision({
                      orderId: selected.id,
                      piId: facts!.piId!,
                      commercialVersionId: facts!.commercialVersionId!,
                      financeDplReceiptId: facts!.financeDplReceiptId!,
                      documentReference: finalPaymentDocumentReference.trim(),
                      paymentAction: finalPaymentAction,
                      paymentLink: finalPaymentLink.trim() || null,
                      paymentInstructions: finalPaymentInstructions.trim(),
                      reason: finalPaymentReason.trim(),
                      sourceChannel: "CENTRAL",
                      sourceReference: `accounts-release:${selected.id}`,
                      correlationId: await buildFinalPaymentPiCorrelationId("issue", identity),
                      idempotencyKey: await buildFinalPaymentPiIdempotencyKey("issue", identity),
                      actorId,
                    });
                  })}
                >
                  {acting === "final-payment-pi" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Issue final-payment PI revision
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <FileText className="h-4 w-4" />3. Issue final tax invoice
                </div>
                <p className="text-xs text-muted-foreground">
                  The governed 10-calendar-day ticket-raise window is anchored to this final invoice date. Invoice date is Day 1; delivery cannot start or extend the clock.
                </p>
                <div className="grid gap-3 md:grid-cols-2">
                  <div><Label>Invoice number</Label><Input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} placeholder="Actual invoice number" /></div>
                  <div><Label>Invoice date</Label><Input type="date" value={invoiceDate} onChange={(event) => setInvoiceDate(event.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Document reference</Label><Input value={invoiceDocumentReference} onChange={(event) => setInvoiceDocumentReference(event.target.value)} placeholder="Immutable storage/document reference" /></div>
                  <div className="md:col-span-2"><Label>Reason</Label><Input value={invoiceReason} onChange={(event) => setInvoiceReason(event.target.value)} /></div>
                </div>
                <Button
                  disabled={
                    !actorId ||
                    !facts?.financeDplReceiptId ||
                    !facts.piId ||
                    !facts.commercialVersionId ||
                    !finalPaymentPi?.available ||
                    finalPaymentPi.settled !== true ||
                    !!facts.finalInvoiceId ||
                    acting !== null ||
                    invoiceInputIncomplete
                  }
                  onClick={() => void run("invoice", () => issueFinalInvoice({
                    orderId: selected.id,
                    piId: facts!.piId!,
                    commercialVersionId: facts!.commercialVersionId!,
                    financeDplReceiptId: facts!.financeDplReceiptId!,
                    invoiceNumber,
                    invoiceDate,
                    documentReference: invoiceDocumentReference,
                    reason: invoiceReason,
                    actorId,
                  }))}
                >
                  {acting === "invoice" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Issue final invoice
                </Button>
              </div>

              <div className="space-y-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-4 w-4" />4. E-way evidence & Finance Dispatch Clearance
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div>
                    <Label>E-way decision</Label>
                    <select
                      className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={ewayStatus}
                      onChange={(event) => setEwayStatus(event.target.value as "VALIDATED" | "NOT_REQUIRED")}
                    >
                      <option value="NOT_REQUIRED">Not required</option>
                      <option value="VALIDATED">Validated</option>
                    </select>
                  </div>
                  <div><Label>E-way number</Label><Input disabled={ewayStatus === "NOT_REQUIRED"} value={ewayNumber} onChange={(event) => setEwayNumber(event.target.value)} /></div>
                  <div><Label>Document reference</Label><Input value={ewayDocumentReference} onChange={(event) => setEwayDocumentReference(event.target.value)} placeholder="Required when validated" /></div>
                  <div><Label>Valid until</Label><Input type="datetime-local" disabled={ewayStatus === "NOT_REQUIRED"} value={ewayValidUntil} onChange={(event) => setEwayValidUntil(event.target.value)} /></div>
                  <div className="md:col-span-2"><Label>Policy reason</Label><Input value={ewayReason} onChange={(event) => setEwayReason(event.target.value)} /></div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    disabled={!actorId || !facts?.finalInvoiceId || !!facts.ewayEvidenceId || acting !== null || ewayInputIncomplete}
                    onClick={() => void run("eway", () => recordEwayEvidence({
                      finalInvoiceId: facts!.finalInvoiceId!,
                      status: ewayStatus,
                      ewayBillNumber: ewayStatus === "VALIDATED" ? ewayNumber : null,
                      documentReference: ewayStatus === "VALIDATED" ? ewayDocumentReference || null : null,
                      policyReason: ewayReason,
                      validUntil: ewayStatus === "VALIDATED" && ewayValidUntil ? new Date(ewayValidUntil).toISOString() : null,
                      actorId,
                    }))}
                  >
                    {acting === "eway" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Record E-way decision
                  </Button>
                  <Button
                    disabled={!actorId || !facts?.finalInvoiceId || !facts.ewayEvidenceId || facts.dispatchCleared || acting !== null}
                    onClick={() => void run("clearance", () => decideFinanceDispatchClearance({
                      finalInvoiceId: facts!.finalInvoiceId!,
                      decision: "GRANTED",
                      reason: "Final settlement and governed movement evidence verified",
                      evidenceReference: `central-finance-dispatch-review:${selected.id}`,
                      actorId,
                    }))}
                  >
                    {acting === "clearance" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Grant Finance Dispatch Clearance
                  </Button>
                  <Button
                    disabled={!facts?.dispatchCleared || selected.status === "cleared_for_dispatch" || acting !== null}
                    onClick={() => void run("order-clear", () => clearOrderForDispatch(selected.id))}
                  >
                    {acting === "order-clear" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Release order to independent gate
                  </Button>
                </div>
                {facts?.settlement && (
                  <pre className="max-h-44 overflow-auto rounded-lg bg-muted p-3 text-[11px]">
                    {JSON.stringify(facts.settlement, null, 2)}
                  </pre>
                )}
              </div>

              <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                Finance authority stops after release to the independent gate. Physical exit, immutable dispatch proof and governed customer dispatch communication complete the Finance/Security handoff. Any ticket raised afterward is routed into CRM/cross-department handling.
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminAccountsRelease;
