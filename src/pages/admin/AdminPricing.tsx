import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Search, CheckCircle2, AlertTriangle, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";

interface ProductPriceRow {
  id: string;
  name: string;
  category: string;
  mrp: number | null;
  price_b2b: number | null;
  price_horeca: number | null;
  price_special: number | null;
}

/** Debounced cell that saves onBlur */
const PriceCell = ({
  productId,
  field,
  value,
  onSaved,
  readOnly,
}: {
  productId: string;
  field: keyof ProductPriceRow;
  value: number | null;
  onSaved: (id: string, field: keyof ProductPriceRow, val: number | null) => void;
  readOnly?: boolean;
}) => {
  const [local, setLocal] = useState<string>(value != null && value !== 0 ? String(value) : "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const originalRef = useRef(value);

  // Sync when parent data changes (e.g. realtime update)
  useEffect(() => {
    const newVal = value != null && value !== 0 ? String(value) : "";
    setLocal(newVal);
    originalRef.current = value;
  }, [value]);

  const handleBlur = async () => {
    const numVal = local === "" ? null : parseFloat(local);
    // Skip if unchanged
    if (numVal === originalRef.current) return;
    if (local !== "" && isNaN(parseFloat(local))) return;

    setSaving(true);
    const { error } = await supabase
      .from("products")
      .update({ [field]: numVal ?? 0 } as any)
      .eq("id", productId);

    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      originalRef.current = numVal;
      onSaved(productId, field, numVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
    setSaving(false);
  };

  if (readOnly) {
    return (
      <div className="w-24 ml-auto text-right h-9 flex items-center justify-end px-2 text-sm font-medium text-muted-foreground bg-muted/30 rounded-lg">
        {local || "—"}
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-end gap-1">
      <Input
        type="number"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={handleBlur}
        className="w-24 text-right h-9 rounded-lg border-input font-medium focus-visible:ring-[#C5A059]"
        placeholder="—"
      />
      {saving && <Loader2 size={14} className="animate-spin text-[#C5A059] absolute -right-5" />}
      {saved && <CheckCircle2 size={14} className="text-green-500 absolute -right-5" />}
    </div>
  );
};

const AdminPricing = () => {
  const [products, setProducts] = useState<ProductPriceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showMissingOnly, setShowMissingOnly] = useState(false);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("id, name, category, mrp, price_b2b, price_horeca, price_special")
      .order("name");

    if (error) {
      console.error("AdminPricing fetch error:", error);
      toast.error("Failed to load pricing matrix: " + error.message);
    } else {
      console.log("AdminPricing Fetched Data:", data?.length, "rows");
      setProducts((data as any as ProductPriceRow[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Realtime subscription
  useEffect(() => {
    const channelName = "admin-pricing-sync";
    removeDuplicateRealtimeChannel(channelName);

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => {
          const updated = payload.new as any;
          setProducts((prev) =>
            prev.map((p) =>
              p.id === updated.id
                ? { ...p, mrp: updated.mrp, price_b2b: updated.price_b2b, price_horeca: updated.price_horeca, price_special: updated.price_special }
                : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Optimistic local update after a cell saves
  const handleCellSaved = (id: string, field: keyof ProductPriceRow, val: number | null) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: val } : p))
    );
  };

  const filteredProducts = products.filter((p) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);

    if (!matchesSearch) return false;

    if (showMissingOnly) {
      return (
        !p.mrp ||
        p.mrp === 0 ||
        !p.price_b2b ||
        p.price_b2b === 0 ||
        !p.price_horeca ||
        p.price_horeca === 0 ||
        !p.price_special ||
        p.price_special === 0
      );
    }

    return true;
  });

  const calcBulk = (mrp: number | null) => (mrp && mrp > 0 ? (mrp * 0.8).toFixed(0) : "—");
  const calcWholesale = (mrp: number | null) => (mrp && mrp > 0 ? (mrp * 0.7).toFixed(0) : "—");

  return (
    <div className="min-h-screen font-sans pb-8">
      <div className="space-y-6">
        {/* HEADER */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <p className="text-[10px] font-bold text-[#C5A059] uppercase tracking-widest mb-1">FINANCE CONTROL</p>
            <h1 className="text-3xl md:text-4xl font-serif text-foreground tracking-tight">Pricing Matrix</h1>
            <p className="text-xs text-muted-foreground mt-1">
              {products.length} products · {filteredProducts.length} visible · Changes save automatically on blur
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={() => setShowMissingOnly(!showMissingOnly)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                showMissingOnly
                  ? "bg-amber-100 border-amber-300 text-amber-800"
                  : "bg-background border-input text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle size={14} />
              {showMissingOnly ? "Missing Only" : "Show All"}
            </button>
            <div className="relative flex-1 md:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
              <Input
                placeholder="Search product or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 rounded-xl border-input focus-visible:ring-[#C5A059]"
              />
            </div>
          </div>
        </div>

        {/* TABLE */}
        <div className="bg-card rounded-2xl shadow-sm border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[1100px] border-collapse">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="p-4 pl-6 text-[10px] font-bold text-[#C5A059] uppercase tracking-widest sticky left-0 z-10 bg-muted/50">
                    Product
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                    MRP (₹)
                  </th>
                  <th className="p-4 text-[10px] font-bold text-blue-500 uppercase tracking-widest text-right bg-blue-50/50">
                    Calc. Bulk (−20%)
                  </th>
                  <th className="p-4 text-[10px] font-bold text-blue-500 uppercase tracking-widest text-right bg-blue-50/50">
                    Calc. Wholesale (−30%)
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                    HoReCa (₹)
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                    B2B (₹)
                  </th>
                  <th className="p-4 text-[10px] font-bold text-muted-foreground uppercase tracking-widest text-right">
                    Special (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center">
                      <Loader2 className="animate-spin text-[#C5A059] mx-auto" size={24} />
                    </td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-10 text-center text-muted-foreground">
                      {showMissingOnly ? "All products have pricing data ✓" : "No products found."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => {
                    const hasMissing =
                      !p.mrp || p.mrp === 0 || !p.price_b2b || p.price_b2b === 0 || !p.price_horeca || p.price_horeca === 0 || !p.price_special || p.price_special === 0;

                    return (
                      <tr key={p.id} className={`hover:bg-accent/30 transition-colors ${hasMissing ? "bg-amber-50/30" : ""}`}>
                        <td className="p-4 pl-6 sticky left-0 z-10 bg-inherit">
                          <p className="font-bold text-sm text-foreground leading-tight">{p.name || "Unnamed"}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{p.category || "—"}</p>
                        </td>

                        <td className="p-4">
                          <PriceCell productId={p.id} field="mrp" value={p.mrp} onSaved={handleCellSaved} />
                        </td>

                        {/* Read-only calculated columns */}
                        <td className="p-4 bg-blue-50/30">
                          <div className="w-24 ml-auto text-right h-9 flex items-center justify-end px-2 text-sm font-medium text-blue-600">
                            {calcBulk(p.mrp)}
                          </div>
                        </td>
                        <td className="p-4 bg-blue-50/30">
                          <div className="w-24 ml-auto text-right h-9 flex items-center justify-end px-2 text-sm font-medium text-blue-600">
                            {calcWholesale(p.mrp)}
                          </div>
                        </td>

                        <td className="p-4">
                          <PriceCell productId={p.id} field="price_horeca" value={p.price_horeca} onSaved={handleCellSaved} />
                        </td>
                        <td className="p-4">
                          <PriceCell productId={p.id} field="price_b2b" value={p.price_b2b} onSaved={handleCellSaved} />
                        </td>
                        <td className="p-4">
                          <PriceCell productId={p.id} field="price_special" value={p.price_special} onSaved={handleCellSaved} />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPricing;
