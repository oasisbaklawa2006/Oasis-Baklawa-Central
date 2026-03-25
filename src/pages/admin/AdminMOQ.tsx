import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, AlertTriangle, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface MOQRule {
  id: string;
  rule_scope: string;
  product_id: string | null;
  category_id: string | null;
  customer_type: string | null;
  pack_size: string | null;
  carton_type: string | null;
  min_quantity: number | null;
  validation_mode: string | null;
  is_active: boolean | null;
}

const AdminMOQ = () => {
  const [rules, setRules] = useState<MOQRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  // New Rule Modal State
  const [showModal, setShowModal] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_scope: "global",
    customer_type: "All",
    pack_size: "",
    carton_type: "",
    min_quantity: 5,
    validation_mode: "warning",
  });

  const fetchRules = async () => {
    setLoading(true);
    const { data } = await supabase.from("moq_rules").select("*").order("created_at", { ascending: false });
    setRules((data as MOQRule[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleToggleActive = async (rule: MOQRule) => {
    setSaving(rule.id);
    const { error } = await supabase.from("moq_rules").update({ is_active: !rule.is_active }).eq("id", rule.id);

    if (error) {
      toast.error("Failed to update rule status.");
    } else {
      toast.success("MOQ Rule status updated.");
      fetchRules();
    }
    setSaving(null);
  };

  const handleAddRule = async () => {
    if (newRule.min_quantity <= 0) return toast.error("Minimum quantity must be at least 1.");
    setIsAdding(true);

    const { error } = await supabase.from("moq_rules").insert({
      rule_scope: newRule.rule_scope,
      customer_type: newRule.customer_type === "All" ? null : newRule.customer_type,
      pack_size: newRule.pack_size || null,
      carton_type: newRule.carton_type || null,
      min_quantity: newRule.min_quantity,
      validation_mode: newRule.validation_mode,
      is_active: true,
    });

    if (error) {
      toast.error("Failed to create MOQ rule.");
    } else {
      toast.success("New MOQ Rule created successfully!");
      setShowModal(false);
      fetchRules();
    }
    setIsAdding(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-[#C5A059]" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-6xl mx-auto pt-8 px-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-display-h2 text-foreground font-serif text-3xl font-bold">MOQ Rule Control</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">
            Enforce Minimum Order Quantities by client type, pack, and carton.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-[#C5A059] text-white hover:bg-[#B38F48] transition-colors shadow-sm"
        >
          <Plus size={16} /> Create MOQ Rule
        </button>
      </div>

      {rules.length === 0 ? (
        <div className="bg-card border border-[#C5A059]/20 rounded-2xl p-12 text-center shadow-sm">
          <ShieldAlert size={40} className="mx-auto text-gray-300 mb-4" />
          <p className="text-ui-label text-muted-foreground font-bold">No MOQ rules configured.</p>
          <p className="text-xs text-muted-foreground mt-2">Buyers can currently checkout with any quantity.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="bg-[#FDFCF8] border-b border-[#C5A059]/20">
                  <th className="px-6 py-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest">Scope</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Target Client
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Variables (Pack/Carton)
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                    Min Qty
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                    Enforcement Mode
                  </th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-center">
                    Active Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${!r.is_active ? "opacity-50" : ""}`}>
                    <td className="px-6 py-4 font-bold text-gray-900 uppercase tracking-wider text-xs">
                      {r.rule_scope}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-gray-600">
                      {r.customer_type ? (
                        <span className="px-2 py-1 bg-slate-100 rounded-md">{r.customer_type}</span>
                      ) : (
                        "Global (All Tiers)"
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-gray-500">
                      {r.pack_size || "Any Pack"} <br />
                      <span className="text-[10px] uppercase text-gray-400">{r.carton_type || "Any Carton"}</span>
                    </td>
                    <td className="px-6 py-4 text-right font-black text-[#C5A059] text-base">
                      {r.min_quantity ?? "—"}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-max
                        ${r.validation_mode === "hard_stop" ? "bg-red-50 text-red-600 border border-red-200" : "bg-amber-50 text-amber-600 border border-amber-200"}`}
                      >
                        {r.validation_mode === "hard_stop" ? <ShieldAlert size={12} /> : <AlertTriangle size={12} />}
                        {r.validation_mode === "hard_stop" ? "Hard Stop (Block)" : "Warning Only"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleToggleActive(r)}
                        disabled={saving === r.id}
                        className={`w-12 h-6 rounded-full relative transition-colors ${r.is_active ? "bg-[#10B981]" : "bg-gray-300"}`}
                      >
                        {saving === r.id ? (
                          <Loader2
                            size={12}
                            className="animate-spin absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white"
                          />
                        ) : (
                          <span
                            className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${r.is_active ? "left-7" : "left-1"}`}
                          />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add New MOQ Rule Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-md bg-white border border-gray-200 rounded-3xl p-6 md:p-8">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-2xl font-serif font-bold text-gray-900">Create MOQ Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Rule Scope</Label>
              <Select value={newRule.rule_scope} onValueChange={(v) => setNewRule((p) => ({ ...p, rule_scope: v }))}>
                <SelectTrigger className="rounded-xl h-11 border-gray-200 focus:ring-[#C5A059]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="global">Global (Applies to Cart Total)</SelectItem>
                  <SelectItem value="category">Category Specific</SelectItem>
                  <SelectItem value="product">Product Specific</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Target Customer Tier</Label>
              <Select
                value={newRule.customer_type}
                onValueChange={(v) => setNewRule((p) => ({ ...p, customer_type: v }))}
              >
                <SelectTrigger className="rounded-xl h-11 border-gray-200 focus:ring-[#C5A059]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-gray-200">
                  <SelectItem value="All">All Tiers (Global)</SelectItem>
                  <SelectItem value="Bulk Rates (-20%)">Bulk Rates (-20%)</SelectItem>
                  <SelectItem value="Wholesale Rates (-30%)">Wholesale Rates (-30%)</SelectItem>
                  <SelectItem value="HoReCa">HoReCa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Pack Size</Label>
                <Input
                  value={newRule.pack_size}
                  onChange={(e) => setNewRule((p) => ({ ...p, pack_size: e.target.value }))}
                  className="rounded-xl h-11 border-gray-200 focus-visible:ring-[#C5A059]"
                  placeholder="e.g. 750g Tin"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Carton Type</Label>
                <Input
                  value={newRule.carton_type}
                  onChange={(e) => setNewRule((p) => ({ ...p, carton_type: e.target.value }))}
                  className="rounded-xl h-11 border-gray-200 focus-visible:ring-[#C5A059]"
                  placeholder="e.g. Master Carton"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-[#C5A059]">Minimum Qty</Label>
                <Input
                  type="number"
                  value={newRule.min_quantity}
                  onChange={(e) => setNewRule((p) => ({ ...p, min_quantity: parseInt(e.target.value) || 0 }))}
                  className="rounded-xl h-11 border-gray-200 focus-visible:ring-[#C5A059] font-bold text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-gray-500">Enforcement Mode</Label>
                <Select
                  value={newRule.validation_mode}
                  onValueChange={(v) => setNewRule((p) => ({ ...p, validation_mode: v }))}
                >
                  <SelectTrigger className="rounded-xl h-11 border-gray-200 focus:ring-[#C5A059]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-gray-200">
                    <SelectItem value="warning">Warning Only</SelectItem>
                    <SelectItem value="hard_stop">Hard Stop (Block Checkout)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <button
              onClick={handleAddRule}
              disabled={isAdding}
              className="w-full mt-4 py-3.5 rounded-xl bg-[#1A1A1A] text-white font-bold text-sm shadow-md hover:bg-black transition-all flex justify-center items-center"
            >
              {isAdding ? <Loader2 size={16} className="animate-spin" /> : "Deploy MOQ Rule"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminMOQ;
