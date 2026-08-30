import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  buildCreditRequestIdentity,
  buildCreditWalletCorrelationId,
  buildCreditWalletIdempotencyKey,
  requestCredit,
} from "@/lib/order-authority/creditWalletAuthorityClient";

interface Props {
  open: boolean;
  onClose: () => void;
  company: { id: string; business_name: string } | null;
  orderId?: string | null;
  proformaInvoiceId?: string | null;
  commercialVersionId?: string | null;
}

const CreditRequestModal = ({ open, onClose, company, orderId, proformaInvoiceId, commercialVersionId }: Props) => {
  const { user } = useAuth();
  const [creditType, setCreditType] = useState("short_term_so");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!company || !amount || Number(amount) <= 0) {
      toast({ title: "Invalid input", description: "Enter a valid amount.", variant: "destructive" });
      return;
    }
    if (!orderId || !proformaInvoiceId || !commercialVersionId || !user?.id) {
      toast({ title: "Governed SO required", description: "Credit requests require an exact order, PI and commercial version.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const base = {
        companyId: company.id,
        orderId,
        proformaInvoiceId,
        commercialVersionId,
        creditType: creditType as "short_term_so" | "long_term_limit",
        requestedAmount: Number(amount),
        sourceChannel: "SALES_INTERNAL",
        sourceReference: `central:sales-credit-request:${orderId}`,
        reason: notes.trim() || "Credit requested from Central.",
        expiresAt: null,
      };
      const identity = buildCreditRequestIdentity(base);
      await requestCredit({
        ...base,
        correlationId: await buildCreditWalletCorrelationId("request", identity),
        idempotencyKey: await buildCreditWalletIdempotencyKey("request", identity),
        actorId: user.id,
      });
      toast({ title: "Credit request submitted", description: `₹${Number(amount).toLocaleString()} requested for ${company.business_name}` });
      setAmount("");
      setNotes("");
      setCreditType("short_term_so");
      onClose();
    } catch (error) {
      toast({ title: "Credit request blocked", description: error instanceof Error ? error.message : "Core credit authority unavailable.", variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Request Credit</DialogTitle>
          <DialogDescription>{company?.business_name}</DialogDescription>
          {(!orderId || !proformaInvoiceId || !commercialVersionId) && (
            <p className="text-xs text-amber-700">Select a governed SO before requesting credit.</p>
          )}
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Credit Type</Label>
            <Select value={creditType} onValueChange={setCreditType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="short_term_so">Short-Term (SO Based)</SelectItem>
                <SelectItem value="long_term_limit">Long-Term Credit Limit</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Requested Amount (₹)</Label>
            <Input type="number" min={1} placeholder="e.g. 50000" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Justification or context…" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !company || !orderId || !proformaInvoiceId || !commercialVersionId || !user?.id}>
            {saving && <Loader2 className="animate-spin mr-2" size={14} />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditRequestModal;
