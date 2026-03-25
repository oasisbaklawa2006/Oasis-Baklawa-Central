import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Plus, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface ExchangeRate {
  id: string;
  base_currency: string;
  target_currency: string;
  exchange_rate: number;
  source_type: string | null;
  updated_at: string;
}

const AdminCurrency = () => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [editingRates, setEditingRates] = useState<Record<string, number>>({});

  // New Rate Modal State
  const [showModal, setShowModal] = useState(false);
  const [newPair, setNewPair] = useState({ base: "INR", target: "USD", rate: 0.012 });
  const [isAdding, setIsAdding] = useState(false);

  const fetchRates = async () => {
    setLoading(true);
    const { data } = await supabase.from("exchange_rates").select("*").order("updated_at", { ascending: false });
    setRates((data as ExchangeRate[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRates();
  }, []);

  const handleSaveRate = async (rateObj: ExchangeRate) => {
    const newRate = editingRates[rateObj.id];
    if (newRate === undefined || newRate === rateObj.exchange_rate) return;

    setSaving(rateObj.id);
    const { error } = await supabase
      .from("exchange_rates")
      .update({
        exchange_rate: newRate,
        updated_at: new Date().toISOString(),
        source_type: "manual_admin",
      })
      .eq("id", rateObj.id);

    if (error) {
      toast.error("Failed to update exchange rate.");
    } else {
      toast.success(`${rateObj.base_currency} to ${rateObj.target_currency} updated to ${newRate}`);
      fetchRates();
    }
    setSaving(null);
  };

  const handleAddNewPair = async () => {
    if (newPair.rate <= 0) return toast.error("Rate must be greater than 0");
    setIsAdding(true);

    const { error } = await supabase.from("exchange_rates").insert({
      base_currency: newPair.base.toUpperCase(),
      target_currency: newPair.target.toUpperCase(),
      exchange_rate: newPair.rate,
      source_type: "manual_admin",
    });

    if (error) {
      toast.error("Failed to add currency pair. It might already exist.");
    } else {
      toast.success(`${newPair.base} to ${newPair.target} pair created!`);
      setShowModal(false);
      fetchRates();
    }
    setIsAdding(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="space-y-6 max-w-5xl mx-auto pt-8 px-4">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-display-h2 text-foreground">Currency & Exchange Rates</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Manage global base multipliers for export clients.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus size={16} /> Add Currency Pair
        </button>
      </div>

      {rates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
          <ArrowRightLeft size={32} className="mx-auto text-muted-foreground mb-4 opacity-50" />
          <p className="text-ui-label text-muted-foreground font-bold">No exchange rates configured.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Click "Add Currency Pair" to define your first multiplier.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="bg-muted/30 border-b border-border">
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Base</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Target</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">
                  Multiplier Rate
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Source</th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rates.map((r) => {
                const isEdited = editingRates[r.id] !== undefined && editingRates[r.id] !== r.exchange_rate;
                return (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-4 font-bold text-foreground">{r.base_currency}</td>
                    <td className="px-6 py-4 font-bold text-foreground">{r.target_currency}</td>
                    <td className="px-6 py-4 text-right">
                      <Input
                        type="number"
                        step="0.0001"
                        className="w-32 text-right ml-auto font-mono text-sm border-border focus-visible:ring-primary h-9"
                        value={editingRates[r.id] ?? r.exchange_rate}
                        onChange={(e) => setEditingRates({ ...editingRates, [r.id]: parseFloat(e.target.value) || 0 })}
                      />
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <span className="px-2 py-1 rounded bg-muted/50 border border-border">
                        {r.source_type || "manual"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {new Date(r.updated_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleSaveRate(r)}
                        disabled={saving === r.id || !isEdited}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border
                          ${
                            isEdited
                              ? "bg-primary text-primary-foreground border-primary shadow-sm hover:bg-primary/90"
                              : "bg-transparent text-muted-foreground border-transparent opacity-50 cursor-not-allowed"
                          }`}
                      >
                        {saving === r.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                        {isEdited ? "Save" : "Saved"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add New Pair Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-sm bg-card border-border rounded-3xl p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-serif font-bold text-foreground">Add Currency Pair</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Base</Label>
                <Input
                  value={newPair.base}
                  onChange={(e) => setNewPair((p) => ({ ...p, base: e.target.value }))}
                  className="uppercase rounded-xl"
                  placeholder="INR"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Target</Label>
                <Input
                  value={newPair.target}
                  onChange={(e) => setNewPair((p) => ({ ...p, target: e.target.value }))}
                  className="uppercase rounded-xl"
                  placeholder="USD"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Exchange Rate (Multiplier)
              </Label>
              <Input
                type="number"
                step="0.0001"
                value={newPair.rate}
                onChange={(e) => setNewPair((p) => ({ ...p, rate: parseFloat(e.target.value) || 0 }))}
                className="font-mono rounded-xl"
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                E.g., If Base is INR and Target is USD, rate is ~0.012
              </p>
            </div>
            <button
              onClick={handleAddNewPair}
              disabled={isAdding}
              className="w-full mt-4 py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-md hover:shadow-lg transition-all"
            >
              {isAdding ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Save Currency Pair"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCurrency;
