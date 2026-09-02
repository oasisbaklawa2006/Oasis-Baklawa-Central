import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getFinalPaymentRequest,
  issueFinalPaymentRequest,
  recordFinalPaymentDelivery,
  type FinalPaymentAction,
  type FinalPaymentRequestFacts,
} from "@/lib/order-authority/financeExitAuthorityClient";
import { sendWhatsAppMessage } from "@/utils/whatsapp";

type Props = {
  orderId: string;
  orderReference: string;
  companyId: string;
  companyName: string;
  customerPhone: string | null;
  financeDplReceiptId: string | null;
  piId: string | null;
  commercialVersionId: string | null;
  finalInvoiceId: string | null;
  actorId: string;
  disabled?: boolean;
  onFactsChange?: (facts: FinalPaymentRequestFacts) => void;
};

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

function latestDeliveryStatus(facts: FinalPaymentRequestFacts | null) {
  const value = facts?.latestDelivery?.delivery_status;
  return typeof value === "string" ? value : null;
}

function providerMessageId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const value = (data as Record<string, unknown>).messageId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Finance M4 operator panel. Core owns the final-payment amount, PI revision,
 * settlement facts and delivery ledger; this component only orchestrates the
 * governed RPCs and the existing authenticated WhatsApp send edge path.
 */
export function FinanceFinalPaymentPanel({
  orderId,
  orderReference,
  companyId,
  companyName,
  customerPhone,
  financeDplReceiptId,
  piId,
  commercialVersionId,
  finalInvoiceId,
  actorId,
  disabled = false,
  onFactsChange,
}: Props) {
  const [facts, setFacts] = useState<FinalPaymentRequestFacts | null>(null);
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [documentReference, setDocumentReference] = useState("");
  const [paymentAction, setPaymentAction] = useState<FinalPaymentAction>("BANK_TRANSFER");
  const [paymentLink, setPaymentLink] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState(
    "Please remit the exact balance against this PI revision and share payment proof against the same SO.",
  );
  const [reason, setReason] = useState("Final DPL verified; exact final-payment demand issued before final invoice");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getFinalPaymentRequest(orderId);
      setFacts(next);
      onFactsChange?.(next);
    } catch (error) {
      setFacts(null);
      toast.error(error instanceof Error ? error.message : "Final-payment PI facts unavailable");
    } finally {
      setLoading(false);
    }
  }, [onFactsChange, orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const issue = async () => {
    if (!financeDplReceiptId || !piId || !commercialVersionId) return;
    setActing("issue");
    try {
      await issueFinalPaymentRequest({
        orderId,
        piId,
        commercialVersionId,
        financeDplReceiptId,
        documentReference,
        paymentAction,
        paymentLink: paymentAction === "PAY_NOW" ? paymentLink : null,
        paymentInstructions,
        reason,
        sourceChannel: "CENTRAL_FINANCE",
        sourceReference: `finance-exit-board:${orderId}`,
        actorId,
      });
      toast.success("Final-payment PI revision issued under canonical PI lineage");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Final-payment PI issuance failed");
    } finally {
      setActing(null);
    }
  };

  const sendM4 = async () => {
    if (!facts?.available || !facts.requestId || !customerPhone) return;
    setActing("m4");
    const queuedEvidence = `central-finance-m4:queued:${facts.requestId}`;
    try {
      await recordFinalPaymentDelivery({
        requestId: facts.requestId,
        channel: "WHATSAPP",
        destinationReference: customerPhone,
        status: "QUEUED",
        evidenceReference: queuedEvidence,
        actorId,
      });

      const paymentLine = facts.paymentAction === "PAY_NOW" && facts.paymentLink
        ? `Pay now: ${facts.paymentLink}`
        : facts.paymentInstructions
          ? `Payment instructions: ${facts.paymentInstructions}`
          : "Please contact Oasis Finance for payment instructions.";
      const message = [
        "Oasis Baklawa — Final Payment Request",
        "",
        `SO / Order: ${orderReference}`,
        `PI: ${facts.piNumber ?? "Governed PI"} · Revision ${facts.revisionNumber ?? "—"}`,
        `Final payable: ${money(facts.finalPayableTotal)}`,
        `Credited / paid: ${money(facts.creditedOrPaidTotal)}`,
        `Exact balance due: ${money(facts.balanceDue)}`,
        paymentLine,
        facts.documentReference ? `PI document: ${facts.documentReference}` : "",
        "",
        "The final tax invoice will be issued after this final-payment demand is settled. The final invoice itself will not request payment.",
        "",
        "— Oasis Finance",
      ].filter(Boolean).join("\n");

      const result = await sendWhatsAppMessage({
        to: customerPhone,
        message,
        companyId,
        orderId,
      });

      if (!result.success) {
        await recordFinalPaymentDelivery({
          requestId: facts.requestId,
          channel: "WHATSAPP",
          destinationReference: customerPhone,
          status: "FAILED",
          evidenceReference: `central-finance-m4:failed:${facts.requestId}`,
          actorId,
        });
        throw new Error(result.error || "WhatsApp final-payment message failed");
      }

      const messageId = providerMessageId(result.data);
      await recordFinalPaymentDelivery({
        requestId: facts.requestId,
        channel: "WHATSAPP",
        destinationReference: customerPhone,
        providerMessageId: messageId,
        status: "SENT",
        evidenceReference: messageId ? `send-whatsapp:${messageId}` : `send-whatsapp:${facts.requestId}`,
        actorId,
      });
      toast.success("M4 final-payment package sent and ledgered");
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "M4 communication failed");
      await load();
    } finally {
      setActing(null);
    }
  };

  const issueIncomplete =
    !actorId ||
    !financeDplReceiptId ||
    !piId ||
    !commercialVersionId ||
    !!finalInvoiceId ||
    !documentReference.trim() ||
    !paymentInstructions.trim() ||
    !reason.trim() ||
    (paymentAction === "PAY_NOW" && !paymentLink.trim());
  const deliveryStatus = latestDeliveryStatus(facts);
  const sendLocked = deliveryStatus === "QUEUED" || deliveryStatus === "SENT" || deliveryStatus === "DELIVERED";

  return (
    <div className="space-y-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-semibold">
          <CreditCard className="h-4 w-4" />2. Final-payment PI revision & M4
        </div>
        <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading || acting !== null}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Payment facts
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        PI requests final payment. The final invoice is available only after Core confirms the latest exact DPL-bound PI revision is fully settled.
      </p>

      {facts?.available && (
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-4">
          <div className="rounded-lg bg-muted p-3"><p className="text-muted-foreground">PI revision</p><p className="mt-1 font-medium">{facts.piNumber ?? "—"} / R{facts.revisionNumber ?? "—"}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-muted-foreground">Final payable</p><p className="mt-1 font-medium">{money(facts.finalPayableTotal)}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-muted-foreground">Credited / paid</p><p className="mt-1 font-medium">{money(facts.creditedOrPaidTotal)}</p></div>
          <div className="rounded-lg bg-muted p-3"><p className="text-muted-foreground">Balance due</p><p className="mt-1 font-medium">{money(facts.balanceDue)}</p><p className="mt-1 text-[10px] text-muted-foreground">{facts.settled ? "SETTLED" : "PAYMENT DUE"}</p></div>
        </div>
      )}

      {!facts?.available && !finalInvoiceId && (
        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2"><Label>PI document reference</Label><Input value={documentReference} onChange={(event) => setDocumentReference(event.target.value)} placeholder="Immutable PI document/storage reference" /></div>
          <div>
            <Label>Payment action</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={paymentAction} onChange={(event) => setPaymentAction(event.target.value as FinalPaymentAction)}>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="PAY_NOW">Pay now link</option>
              <option value="CONTACT_FINANCE">Contact Finance</option>
            </select>
          </div>
          <div><Label>Payment link</Label><Input disabled={paymentAction !== "PAY_NOW"} value={paymentLink} onChange={(event) => setPaymentLink(event.target.value)} placeholder="https://…" /></div>
          <div className="md:col-span-2"><Label>Payment instructions</Label><Input value={paymentInstructions} onChange={(event) => setPaymentInstructions(event.target.value)} /></div>
          <div className="md:col-span-2"><Label>Reason</Label><Input value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void issue()} disabled={disabled || acting !== null || issueIncomplete || facts?.available === true}>
          {acting === "issue" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Issue final-payment PI
        </Button>
        <Button variant="outline" onClick={() => void sendM4()} disabled={disabled || acting !== null || !facts?.available || !facts.requestId || !customerPhone || sendLocked}>
          {acting === "m4" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          Send M4 by WhatsApp
        </Button>
      </div>

      {facts?.available && (
        <div className="rounded-lg border p-3 text-xs text-muted-foreground">
          <p>Payment action: {facts.paymentAction ?? "—"}</p>
          <p className="mt-1">PI document: {facts.documentReference ?? "—"}</p>
          <p className="mt-1">Customer WhatsApp: {customerPhone || "Missing on company master"}</p>
          <p className="mt-1">M4 ledger: {deliveryStatus ?? "Not sent"}</p>
        </div>
      )}
    </div>
  );
}
