import AppShell from "@/components/AppShell";
import TopNavBar from "@/components/TopNavBar";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save, Search, Wand2, DollarSign, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProductPriceRow {
  id: string;
  name: string;
  sku: string;
  category: string;
  base_price: number;
  price_bulk: number;
  price_wholesale: number;
  price_horeca: number;
  price_b2b: number;
  price_special: number;
}

const AdminPricing = () => {
  const [products, setProducts] = useState<ProductPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Tracks ONLY the rows that have been edited
  const [edits, setEdits] = useState<Record<string, Partial<ProductPriceRow>>>({});
  const [isSaving, setIsSaving] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select(
        "id, name, sku, category, base_price, price_bulk, price_wholesale, price_horeca, price_b2b, price_special",
      )
      .order("name");

    if (error) {
      toast.error("Failed to load pricing matrix.");
    } else if (data) {
      // FIX: Bypassing strict TypeScript checking until local types are regenerated
      setProducts(data as any as ProductPriceRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleEdit = (id: string, field: keyof ProductPriceRow, value: string) => {
    const numValue = parseFloat(value) || 0;
    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: numValue,
      },
    }));
  };

  // Magic Auto-Calculate Feature (Applies -20% and -30% standard rules)
  const handleAutoCalc = (id: string, basePrice: number) => {
    const currentBase = edits[id]?.base_price ?? basePrice;
    if (!currentBase || currentBase <= 0) {
      toast.error("Please enter a Base Price first.");
      return;
    }

    setEdits((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        price_bulk: Math.round(currentBase * 0.8), // -20%
        price_wholesale: Math.round(currentBase * 0.7), // -30%
      },
    }));
    toast.success("Standard discounts applied!");
  };

  const handleSaveAll = async () => {
    const editedIds = Object.keys(edits);
    if (editedIds.length === 0) return;

    setIsSaving(true);
    let successCount = 0;

    for (const id of editedIds) {
      const { error } = await supabase.from("products").update(edits[id]).eq("id", id);

      if (!error) successCount++;
    }

    if (successCount === editedIds.length) {
      toast.success(`Successfully updated pricing for ${successCount} products!`, { icon: "💰" });
      setEdits({});
      fetchProducts();
    } else {
      toast.error("Some updates failed. Please try again.");
    }
    setIsSaving(false);
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const hasUnsavedChanges = Object.keys(edits).length > 0;

  return (
    <AppShell>
      <div className="min-h-screen bg-[#FDFCF8] font-sans pb-32">
        <TopNavBar />

        <main className="pt-24 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
          {/* HEADER */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <p className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-1">FINANCE CONTROL</p>
              <h1 className="text-3xl md:text-4xl font-serif text-gray-900 tracking-tight">Pricing Matrix</h1>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <Input
                placeholder="Search SKU or Product..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-gray-200 focus-visible:ring-[#C5A059]"
              />
            </div>
          </div>

          {/* MAIN MATRIX TABLE */}
          <div className="bg-white rounded-3xl shadow-sm border border-[#C5A059]/20 overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[1000px] border-collapse">
                <thead>
                  <tr className="bg-[#FDFCF8] border-b border-[#C5A059]/20">
                    <th className="p-4 pl-6 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest sticky left-0 z-10 bg-[#FDFCF8]">
                      Product & SKU
                    </th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right bg-slate-50 border-x border-gray-100">
                      Base Price (Retail)
                    </th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                      Bulk (-20%)
                    </th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                      Wholesale (-30%)
                    </th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                      HoReCa
                    </th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                      B2B Standard
                    </th>
                    <th className="p-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">
                      Special Pricing
                    </th>
                    <th className="p-4 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest text-center">
                      Auto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center">
                        <Loader2 className="animate-spin text-[#C5A059] mx-auto" size={24} />
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const isEdited = !!edits[p.id];
                      const current = { ...p, ...edits[p.id] };

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-[#C5A059]/5 transition-colors ${isEdited ? "bg-amber-50/50" : ""}`}
                        >
                          <td className="p-4 pl-6 sticky left-0 z-10 bg-inherit flex flex-col justify-center">
                            <p className="font-bold text-sm text-gray-900 leading-tight">{p.name}</p>
                            <p className="text-[10px] text-gray-400 font-mono mt-1">{p.sku || "NO-SKU"}</p>
                          </td>

                          <td className="p-4 bg-slate-50/50 border-x border-gray-50">
                            <div className="relative flex items-center justify-end">
                              <span className="absolute left-3 text-xs text-gray-400 font-medium">₹</span>
                              <Input
                                type="number"
                                value={current.base_price || ""}
                                onChange={(e) => handleEdit(p.id, "base_price", e.target.value)}
                                className="w-24 text-right pl-6 h-9 rounded-lg border-gray-200 font-bold focus-visible:ring-[#C5A059] bg-white"
                              />
                            </div>
                          </td>

                          <td className="p-4">
                            <Input
                              type="number"
                              value={current.price_bulk || ""}
                              onChange={(e) => handleEdit(p.id, "price_bulk", e.target.value)}
                              className="w-24 ml-auto text-right h-9 rounded-lg border-gray-200 font-medium focus-visible:ring-[#C5A059]"
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              value={current.price_wholesale || ""}
                              onChange={(e) => handleEdit(p.id, "price_wholesale", e.target.value)}
                              className="w-24 ml-auto text-right h-9 rounded-lg border-gray-200 font-medium focus-visible:ring-[#C5A059]"
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              value={current.price_horeca || ""}
                              onChange={(e) => handleEdit(p.id, "price_horeca", e.target.value)}
                              className="w-24 ml-auto text-right h-9 rounded-lg border-gray-200 font-medium focus-visible:ring-[#C5A059]"
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              value={current.price_b2b || ""}
                              onChange={(e) => handleEdit(p.id, "price_b2b", e.target.value)}
                              className="w-24 ml-auto text-right h-9 rounded-lg border-gray-200 font-medium focus-visible:ring-[#C5A059]"
                            />
                          </td>
                          <td className="p-4">
                            <Input
                              type="number"
                              value={current.price_special || ""}
                              onChange={(e) => handleEdit(p.id, "price_special", e.target.value)}
                              className="w-24 ml-auto text-right h-9 rounded-lg border-gray-200 font-medium focus-visible:ring-[#C5A059]"
                            />
                          </td>

                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleAutoCalc(p.id, p.base_price)}
                              className="p-2 rounded-lg bg-[#C5A059]/10 text-[#C5A059] hover:bg-[#C5A059] hover:text-white transition-colors"
                              title="Auto-calculate standard discounts"
                            >
                              <Wand2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

        {/* STICKY SAVE BAR (Only appears when changes are made) */}
        {hasUnsavedChanges && (
          <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 px-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] z-50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
                <AlertCircle size={20} />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Unsaved Changes</h4>
                <p className="text-xs text-gray-500">You have modified {Object.keys(edits).length} product(s).</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setEdits({})}
                className="text-xs font-bold text-gray-500 hover:text-gray-900 transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSaveAll}
                disabled={isSaving}
                className="px-8 py-3 bg-[#1A1A1A] text-white rounded-xl text-sm font-bold shadow-lg hover:bg-black transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Save Pricing Matrix
              </button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default AdminPricing;
