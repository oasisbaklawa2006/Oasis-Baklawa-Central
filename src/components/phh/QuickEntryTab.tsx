import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Image as ImageIcon, Store } from "lucide-react";
import { DepartmentProduct } from "./types";

interface Props {
  department: string;
  departmentLabel: string;
  userId: string | undefined;
}

export default function QuickEntryTab({ department, departmentLabel, userId }: Props) {
  const [products, setProducts] = useState<DepartmentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [wastage, setWastage] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("products")
        .select("id, name, image_url, sku, production_department")
        .eq("is_active", true);
      if (data) {
        const filtered = (data as any[])
          .filter((p) => (p.production_department || "").toLowerCase() === department)
          .map((p) => ({ id: p.id, name: p.name, image_url: p.image_url, sku: p.sku }));
        setProducts(filtered);
        const initQ: Record<string, number> = {};
        const initW: Record<string, number> = {};
        filtered.forEach((p) => { initQ[p.id] = 0; initW[p.id] = 0; });
        setQuantities(initQ);
        setWastage(initW);
      }
      setLoading(false);
    };
    load();
  }, [department]);

  const adjust = (id: string, delta: number, type: "qty" | "waste") => {
    const setter = type === "qty" ? setQuantities : setWastage;
    setter((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) }));
  };

  const setExact = (id: string, value: number, type: "qty" | "waste") => {
    const setter = type === "qty" ? setQuantities : setWastage;
    setter((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const handleSubmit = async () => {
    const rows = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, qty]) => ({
        product_id: productId,
        department,
        produced_qty: qty,
        wastage_qty: wastage[productId] || 0,
        logged_by: userId || null,
      }));

    if (rows.length === 0) {
      toast.warning("No quantities entered");
      return;
    }

    setSubmitting(true);

    // Auto-generate batch ID
    const batchId = `B-${department.slice(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    const { error } = await supabase.from("daily_production_logs").insert(rows);
    if (error) {
      toast.error("Failed: " + error.message);
      setSubmitting(false);
      return;
    }

    // Push to RGS (factory_inventory) + create RGS transfer records
    for (const row of rows) {
      const { data: inv } = await supabase
        .from("factory_inventory")
        .select("id, quantity")
        .eq("product_id", row.product_id)
        .maybeSingle();

      if (inv) {
        await supabase.from("factory_inventory").update({
          quantity: (Number(inv.quantity) || 0) + row.produced_qty,
          last_updated: new Date().toISOString(),
        }).eq("id", inv.id);
      } else {
        await supabase.from("factory_inventory").insert({
          product_id: row.product_id,
          quantity: row.produced_qty,
        });
      }

      // Create RGS transfer record
      await supabase.from("production_rgs_transfers").insert({
        product_id: row.product_id,
        quantity: row.produced_qty,
        batch_number: batchId,
        transferred_by: userId,
        rgs_notified: true,
      });
    }

    const total = rows.reduce((s, r) => s + r.produced_qty, 0);
    toast.success(`${total} units → RGS (Batch: ${batchId}) ✅`);
    const resetQ: Record<string, number> = {};
    const resetW: Record<string, number> = {};
    products.forEach((p) => { resetQ[p.id] = 0; resetW[p.id] = 0; });
    setQuantities(resetQ);
    setWastage(resetW);
    setSubmitting(false);
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="animate-spin text-slate-400" size={24} /></div>;

  if (products.length === 0) {
    return <p className="text-center text-sm text-slate-400 font-bold mt-10">No products for {departmentLabel}</p>;
  }

  const hasEntries = Object.values(quantities).some((v) => v > 0);

  return (
    <div className="space-y-3 pb-24">
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-2">
        <h3 className="font-bold text-emerald-800 text-sm flex items-center gap-2">
          <Store size={16} /> Photo-Based Quick Entry
        </h3>
        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1">
          Tap photos to rapidly log daily production for {departmentLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map((product) => {
          const qty = quantities[product.id] || 0;
          const waste = wastage[product.id] || 0;
          const active = qty > 0;

          return (
            <div key={product.id} className={`bg-white rounded-2xl border-2 overflow-hidden shadow-sm transition-colors ${active ? "border-emerald-400" : "border-slate-200"}`}>
              <div className="w-full aspect-square bg-slate-100 flex items-center justify-center relative">
                {product.image_url ? (
                  <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={32} className="text-slate-300" />
                )}
                {active && (
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white text-xs font-black rounded-full w-8 h-8 flex items-center justify-center shadow">
                    {qty}
                  </div>
                )}
              </div>
              <div className="p-2.5">
                <h4 className="font-bold text-xs text-slate-900 leading-tight line-clamp-2 mb-1.5">{product.name}</h4>
                
                {/* Multiplier buttons */}
                <div className="flex gap-1 mb-1.5">
                  {[10, 25, 50].map((n) => (
                    <button
                      key={n}
                      onClick={() => adjust(product.id, n, "qty")}
                      className="flex-1 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 font-black text-[11px] active:scale-95 active:bg-emerald-200 transition-all"
                    >
                      +{n}
                    </button>
                  ))}
                </div>

                <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 h-9 mb-1.5">
                  <button onClick={() => adjust(product.id, -5, "qty")} className="w-9 h-full flex items-center justify-center text-slate-500 font-black active:bg-slate-200 rounded-l-lg text-sm">-</button>
                  <input
                    type="number"
                    value={qty || ""}
                    onChange={(e) => setExact(product.id, parseInt(e.target.value) || 0, "qty")}
                    className="font-black text-sm flex-1 text-center text-slate-900 bg-transparent outline-none w-0"
                    placeholder="0"
                  />
                  <button onClick={() => adjust(product.id, 5, "qty")} className="w-9 h-full flex items-center justify-center text-slate-700 font-black active:bg-slate-200 rounded-r-lg text-sm">+</button>
                </div>

                <div className="flex items-center bg-red-50 rounded-lg border border-red-200 h-7">
                  <button onClick={() => adjust(product.id, -1, "waste")} className="w-7 h-full flex items-center justify-center text-red-400 font-black active:bg-red-100 rounded-l-lg text-[10px]">-</button>
                  <span className={`font-black text-[10px] flex-1 text-center ${waste > 0 ? "text-red-600" : "text-slate-400"}`}>🗑 {waste}</span>
                  <button onClick={() => adjust(product.id, 1, "waste")} className="w-7 h-full flex items-center justify-center text-red-500 font-black active:bg-red-100 rounded-r-lg text-[10px]">+</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasEntries && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-slate-200 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-safe z-10">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-emerald-600 text-white font-black text-sm uppercase tracking-widest active:scale-95 shadow-lg shadow-emerald-600/20 flex justify-center items-center gap-2"
          >
            {submitting ? <Loader2 className="animate-spin" size={16} /> : "Push to Store Inventory"}
          </button>
        </div>
      )}
    </div>
  );
}
