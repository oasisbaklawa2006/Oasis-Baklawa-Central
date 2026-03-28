import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ClipboardList, Plus, Trash2, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

interface Company {
  id: string;
  business_name: string;
}

interface Product {
  id: string;
  name: string;
}

interface AdviceItem {
  product_id: string;
  expected_qty: number;
}

const RETURN_REASONS = [
  "Short Expiry",
  "Damage in Transit",
  "Wrong Item Dispatched",
  "Quality Issue",
  "Customer Rejection",
  "Overstock / Slow Moving",
  "Other",
];

export default function InwardAdviceModal({
  open,
  onOpenChange,
  companies,
  products,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  companies: Company[];
  products: Product[];
  userId: string | undefined;
}) {
  const [saving, setSaving] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [reason, setReason] = useState("");
  const [docs, setDocs] = useState("");
  const [expectedValue, setExpectedValue] = useState("");
  const [items, setItems] = useState<AdviceItem[]>([{ product_id: "", expected_qty: 1 }]);

  const addItem = () => setItems((p) => [...p, { product_id: "", expected_qty: 1 }]);
  const removeItem = (i: number) => setItems((p) => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: keyof AdviceItem, val: string | number) =>
    setItems((p) => p.map((item, idx) => (idx === i ? { ...item, [field]: val } : item)));

  const resetForm = () => {
    setCompanyId("");
    setReason("");
    setDocs("");
    setExpectedValue("");
    setItems([{ product_id: "", expected_qty: 1 }]);
  };

  const handleSubmit = async () => {
    if (!companyId || !reason || items.some((it) => !it.product_id || it.expected_qty < 1)) {
      toast.error("Please fill all required fields and add at least one item.");
      return;
    }

    setSaving(true);

    // 1. Insert advice header
    const { data: advice, error: advErr } = await supabase
      .from("inward_material_advice")
      .insert({
        company_id: companyId,
        sales_exec_id: userId || null,
        type: "return",
        reason,
        accompanying_docs: docs || null,
        expected_value: parseFloat(expectedValue) || 0,
        status: "expected",
        is_defect: false,
      })
      .select("id")
      .single();

    if (advErr || !advice) {
      toast.error("Failed to create advice: " + (advErr?.message || "Unknown error"));
      setSaving(false);
      return;
    }

    // 2. Insert line items
    const rows = items.map((it) => ({
      advice_id: advice.id,
      product_id: it.product_id,
      expected_qty: it.expected_qty,
    }));

    const { error: itemErr } = await supabase.from("inward_material_items").insert(rows);

    if (itemErr) {
      toast.error("Advice created but items failed: " + itemErr.message);
    } else {
      // 3. Audit log
      await supabase.from("audit_logs").insert({
        action_type: "inward_advice_created",
        actor_id: userId || null,
        entity_id: advice.id,
        entity_name: "inward_material_advice",
        new_value: { company_id: companyId, reason, expected_value: expectedValue, item_count: items.length },
      });
      toast.success("Inward Advice submitted — you are now accountable for this value.");
      resetForm();
      onOpenChange(false);
    }

    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList size={20} className="text-[#C4A052]" /> Pre-Entry: Advise Incoming Return
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Client */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1 block">Client *</label>
            <Select value={companyId} onValueChange={setCompanyId}>
              <SelectTrigger><SelectValue placeholder="Select Client" /></SelectTrigger>
              <SelectContent>
                {companies.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1 block">Reason for Return *</label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
              <SelectContent>
                {RETURN_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Accompanying Docs */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1 block">Accompanying Documents</label>
            <Textarea
              value={docs}
              onChange={(e) => setDocs(e.target.value)}
              placeholder="e.g. LR Copy, Client Debit Note, Photos"
              className="min-h-[60px]"
            />
          </div>

          {/* Expected Value */}
          <div>
            <label className="text-sm font-semibold text-muted-foreground mb-1 block">Expected Book Value (₹) *</label>
            <div className="relative">
              <IndianRupee size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min="0"
                value={expectedValue}
                onChange={(e) => setExpectedValue(e.target.value)}
                className="pl-8"
                placeholder="0"
              />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-muted-foreground">Items *</label>
              <Button variant="ghost" size="sm" onClick={addItem} className="gap-1 text-xs h-7">
                <Plus size={14} /> Add Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <Select value={item.product_id} onValueChange={(v) => updateItem(i, "product_id", v)}>
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="1"
                    value={item.expected_qty}
                    onChange={(e) => updateItem(i, "expected_qty", parseInt(e.target.value) || 1)}
                    className="w-20"
                    placeholder="Qty"
                  />
                  {items.length > 1 && (
                    <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="h-8 w-8 text-destructive">
                      <Trash2 size={14} />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <p className="text-xs text-amber-800 dark:text-amber-300 font-medium">
              ⚠️ By submitting, you are officially declaring this return. The expected value (₹{expectedValue || "0"}) becomes your accountability until goods are received & inspected at the factory.
            </p>
          </div>

          <Button onClick={handleSubmit} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="animate-spin" size={16} /> : <ClipboardList size={16} />}
            Submit Inward Advice
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
