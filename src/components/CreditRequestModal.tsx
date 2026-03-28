import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  company: { id: string; business_name: string } | null;
}

const CreditRequestModal = ({ open, onClose, company }: Props) => {
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
    setSaving(true);
    const { error } = await supabase.from("credit_requests").insert({
      company_id: company.id,
      credit_type: creditType,
      requested_amount: Number(amount),
      notes: notes || null,
      requested_by: user?.id ?? null,
      status: "pending",
    });
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Credit request submitted", description: `₹${Number(amount).toLocaleString()} requested for ${company.business_name}` });
      setAmount("");
      setNotes("");
      setCreditType("short_term_so");
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Request Credit</DialogTitle>
          <DialogDescription>{company?.business_name}</DialogDescription>
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
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="animate-spin mr-2" size={14} />}
            Submit Request
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CreditRequestModal;
