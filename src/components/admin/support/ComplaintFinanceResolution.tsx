import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { readMfaState, verifyTotpCode, type MfaFactorSummary } from "@/lib/auth/mfaTotp";
import {
  canResolveCommercialComplaint,
  complaintResolutionError,
  type ComplaintResolution,
} from "@/lib/support/complaintBridge";

const remedies = [
  ["NO_FINANCIAL_ACTION", "No financial action"],
  ["CREDIT_NOTE", "Credit note"],
  ["DEBIT_NOTE", "Debit note"],
  ["REFUND_TO_BANK", "Bank refund"],
  ["REFUND_TO_WALLET", "Wallet refund"],
  ["REPLACEMENT_NO_CHARGE", "Replacement at no charge"],
  ["REPLACEMENT_CHARGEABLE", "Chargeable replacement"],
  ["PARTIAL_WRITE_OFF", "Partial write-off"],
  ["CUSTOMER_DEBIT", "Customer debit"],
  ["TRANSPORTER_RECOVERY", "Transporter recovery"],
  ["EMPLOYEE_RECOVERY", "Employee recovery"],
  ["VENDOR_RECOVERY", "Vendor recovery"],
] as const;

interface Props {
  complaintId: string;
  resolved: boolean;
  handoffUnavailable: boolean;
  refresh: () => Promise<unknown>;
}

export default function ComplaintFinanceResolution({ complaintId, resolved, handoffUnavailable, refresh }: Props) {
  const { role } = useAuth();
  const [remedy, setRemedy] = useState("");
  const [receipt, setReceipt] = useState<ComplaintResolution | null>(null);
  const [factors, setFactors] = useState<MfaFactorSummary[]>([]);
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const attempt = useRef<{ payload: string; id: string }>();
  const inflight = useRef(false);

  const taxDocument = remedy === "CREDIT_NOTE" || remedy === "DEBIT_NOTE";
  const bankRefund = remedy === "REFUND_TO_BANK";
  const positiveAmount = taxDocument || bankRefund || remedy === "REFUND_TO_WALLET";
  const zeroAmount = remedy === "NO_FINANCIAL_ACTION" || remedy === "REPLACEMENT_NO_CHARGE";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canResolveCommercialComplaint(role) || resolved || handoffUnavailable || receipt || inflight.current) return;

    const form = new FormData(event.currentTarget);
    const read = (name: string) => String(form.get(name) ?? "").trim();
    const amountText = read("amount");
    const amount = zeroAmount ? 0 : Number(amountText);
    const reason = read("reason");
    const documentNumber = taxDocument ? read("documentNumber") : null;
    const documentReference = taxDocument ? read("documentReference") : null;
    const paymentReference = bankRefund ? read("paymentReference") : null;

    setMessage("");
    if (!remedies.some(([value]) => value === remedy) || reason.length < 5 ||
        !Number.isFinite(amount) || (!zeroAmount && !amountText) || amount < 0 || (positiveAmount && amount <= 0)) {
      setError("Select a remedy, enter the required amount, and provide a decision reason of at least five characters.");
      return;
    }
    if (taxDocument && (!documentNumber || !documentReference)) {
      setError("Enter the tax document number and its evidence reference.");
      return;
    }
    if (bankRefund && !paymentReference) {
      setError("Enter the recorded bank payment reference.");
      return;
    }

    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      const mfa = await readMfaState(supabase);
      if (mfa.currentLevel !== "aal2") {
        setFactors(mfa.verified);
        setFactorId(mfa.verified[0]?.id ?? "");
        setError(mfa.verified.length
          ? "Verify your authenticator, then submit the Finance resolution."
          : "Finance resolution requires a verified authenticator on your staff account.");
        return;
      }

      const args = {
        p_complaint_id: complaintId,
        p_adjustment_type: remedy,
        p_amount: amount,
        p_document_number: documentNumber,
        p_document_reference: documentReference,
        p_payment_reference: paymentReference,
        p_decision_reason: reason,
      };
      const payload = JSON.stringify(args);
      if (attempt.current?.payload !== payload) attempt.current = { payload, id: crypto.randomUUID() };
      const { data, error: rpcError } = await supabase.rpc("resolve_commercial_complaint_v1", {
        ...args,
        p_correlation_id: attempt.current.id,
        p_idempotency_key: attempt.current.id,
      }).single();
      if (rpcError) {
        setError(complaintResolutionError(rpcError.message));
        return;
      }

      setReceipt(data);
      // The live receipt is kept for this ticket while the projection refreshes.
      void refresh();
    } catch {
      setError("Could not confirm the Finance resolution. Retry the same submission or refresh the handoff.");
    } finally {
      inflight.current = false;
      setBusy(false);
    }
  }

  async function verify() {
    if (!canResolveCommercialComplaint(role) || inflight.current || !factorId || !/^\d{6}$/.test(code)) return;
    inflight.current = true;
    setBusy(true);
    setError("");
    try {
      await verifyTotpCode(supabase, factorId, code);
      setFactors([]);
      setMessage("Authenticator verified. Review and submit the Finance resolution.");
    } catch {
      setError("Could not verify the authenticator code. Enter a current code and retry.");
    } finally {
      setCode("");
      setBusy(false);
      inflight.current = false;
    }
  }

  if (!canResolveCommercialComplaint(role)) return null;
  if (receipt) return (
    <div role="status" className="space-y-1 break-words rounded-md border p-3">
      <p>{receipt.already_resolved ? "Existing Finance resolution confirmed." : "Finance resolution recorded."}</p>
      <p>Adjustment ID · {receipt.adjustment_id}</p>
      {receipt.wallet_entry_id && <p>Wallet entry ID · {receipt.wallet_entry_id}</p>}
    </div>
  );
  if (resolved || handoffUnavailable) return null;

  return (
    <form onSubmit={submit} className="space-y-3 border-t pt-3">
      <fieldset disabled={busy} className="space-y-3">
        <legend className="font-semibold">Finance resolution</legend>
        <label className="block space-y-1">
          <span>Remedy</span>
          <select required value={remedy} onChange={(event) => setRemedy(event.target.value)}
            className="block w-full max-w-sm rounded-md border bg-background p-2">
            <option value="">Select a remedy</option>
            {remedies.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {zeroAmount ? <p>Amount · ₹0</p> : (
          <label className="block max-w-sm space-y-1">
            <span>Amount (INR)</span>
            <Input name="amount" type="number" min={positiveAmount ? "0.01" : "0"} step="0.01" required />
          </label>
        )}
        {taxDocument && (
          <>
            <label className="block space-y-1">Tax document number<Input name="documentNumber" required /></label>
            <label className="block space-y-1">Tax document evidence reference<Input name="documentReference" required /></label>
          </>
        )}
        {bankRefund && (
          <label className="block space-y-1">Bank payment reference<Input name="paymentReference" required /></label>
        )}
        <label className="block space-y-1">
          Decision reason<Textarea name="reason" minLength={5} required />
        </label>
        {factors.length > 0 && (
          <div className="space-y-2">
            {factors.length > 1 && (
              <label className="block">
                Authenticator
                <select value={factorId} onChange={(event) => setFactorId(event.target.value)} className="ml-2 rounded-md border bg-background p-2">
                  {factors.map((factor, index) => (
                    <option key={factor.id} value={factor.id}>{factor.friendlyName ?? `Authenticator ${index + 1}`}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="block max-w-xs space-y-1">
              Authenticator code
              <Input value={code} onChange={(event) => setCode(event.target.value)}
                inputMode="numeric" autoComplete="one-time-code" maxLength={6} />
            </label>
            <Button type="button" variant="outline" disabled={!/^\d{6}$/.test(code)} onClick={() => void verify()}>Verify authenticator</Button>
          </div>
        )}
        <Button type="submit">Submit Finance resolution</Button>
      </fieldset>
      {error && <p role="alert" className="text-destructive">{error}</p>}
      {message && <p role="status">{message}</p>}
    </form>
  );
}
