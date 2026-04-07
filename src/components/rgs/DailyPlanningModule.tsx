import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, AlertTriangle, TrendingDown, Factory, CheckCircle2, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface StockRow {
  product_id: string;
  quantity: number;
  product: {
    name: string;
    sku: string | null;
    image_url: string | null;
    production_department: string | null;
  } | null;
}

const LOW_STOCK_THRESHOLD = 20;

const DEPT_MAP: Record<string, string> = {
  "arabic sweets": "arabic_sweets",
  "arabic": "arabic_sweets",
  "bakery": "bakery",
  "chocolate": "chocolate",
  "chocolates": "chocolate",
  "dragees": "dragees",
  "fusion sweets": "fusion_sweets",
  "fusion": "fusion_sweets",
  "nuts": "nuts_mixes",
  "seasoned nuts": "nuts_mixes",
  "seasoned nuts & mixes": "nuts_mixes",
  "nuts roasting": "nuts_mixes",
  "packing & assembly": "packing_assembly",
  "assembly": "packing_assembly",
};

function mapDept(raw: string | null): string {
  if (!raw) return "arabic_sweets";
  return DEPT_MAP[raw.toLowerCase().trim()] || "arabic_sweets";
}

export default function DailyPlanningModule() {
  const { user } = useAuth();
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkQty, setBulkQty] = useState(50);

  const fetchStock = useCallback(async () => {
    const { data } = await supabase
      .from("factory_inventory")
      .select("product_id, quantity, product:products(name, sku, image_url, production_department)")
      .order("quantity", { ascending: true });

    const rows = ((data as any[]) || []).filter(
      (r) => r.product_id && r.product
    ) as StockRow[];
    setStock(rows);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const lowStockItems = stock.filter((s) => (s.quantity || 0) <= LOW_STOCK_THRESHOLD);
  const outOfStockItems = stock.filter((s) => (s.quantity || 0) === 0);

  const toggleSelect = (pid: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(pid) ? next.delete(pid) : next.add(pid);
      return next;
    });
  };

  const selectAllLow = () => {
    setSelectedIds(new Set(lowStockItems.map((s) => s.product_id)));
  };

  const handleBulkTrigger = async (priority: "normal" | "urgent" | "red") => {
    if (selectedIds.size === 0) {
      toast.warning("Select items to trigger production");
      return;
    }
    setActing(true);

    const selected = stock.filter((s) => selectedIds.has(s.product_id));
    let created = 0;

    for (const item of selected) {
      const dept = mapDept(item.product?.production_department);
      await supabase.from("production_jobs").insert({
        product_id: item.product_id,
        department: dept,
        assigned_qty: bulkQty,
        priority,
        status: "pending",
        stage: "prep",
      });
      created++;
    }

    toast.success(
      `🏭 ${created} ${priority.toUpperCase()} production jobs created (${bulkQty} units each)`
    );
    setSelectedIds(new Set());
    setActing(false);
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="bg-red-500/10 border-red-400/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-red-700">{outOfStockItems.length}</p>
            <p className="text-[10px] font-bold text-red-600 uppercase">Out of Stock</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-400/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{lowStockItems.length}</p>
            <p className="text-[10px] font-bold text-amber-600 uppercase">Low Stock (≤{LOW_STOCK_THRESHOLD})</p>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/10 border-emerald-400/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{stock.length}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Total SKUs</p>
          </CardContent>
        </Card>
      </div>

      {/* Bulk controls */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <TrendingDown size={16} /> Daily Production Planning
            </h3>
            <Button size="sm" variant="outline" className="text-xs" onClick={selectAllLow}>
              Select All Low Stock
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-bold">Qty per SKU:</label>
            {[25, 50, 100, 200].map((q) => (
              <button
                key={q}
                onClick={() => setBulkQty(q)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  bulkQty === q
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-accent"
                }`}
              >
                {q}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 text-xs"
              onClick={() => handleBulkTrigger("normal")}
              disabled={acting || selectedIds.size === 0}
            >
              {acting ? <Loader2 size={14} className="animate-spin" /> : <><Factory size={14} className="mr-1" /> Regular Order</>}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              className="flex-1 text-xs"
              onClick={() => handleBulkTrigger("urgent")}
              disabled={acting || selectedIds.size === 0}
            >
              <AlertTriangle size={14} className="mr-1" /> Urgent Order
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground">
            {selectedIds.size} SKUs selected • {selectedIds.size * bulkQty} total units
          </p>
        </CardContent>
      </Card>

      {/* Stock list */}
      <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
        {lowStockItems.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <CheckCircle2 size={24} className="mx-auto mb-2 opacity-40" />
              All SKUs are well-stocked. No action needed.
            </CardContent>
          </Card>
        )}
        {lowStockItems.map((item) => {
          const isSelected = selectedIds.has(item.product_id);
          const isZero = (item.quantity || 0) === 0;
          return (
            <div
              key={item.product_id}
              onClick={() => toggleSelect(item.product_id)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                isSelected
                  ? "border-primary bg-primary/5"
                  : isZero
                  ? "border-red-400/40 bg-red-500/5"
                  : "border-border bg-card"
              }`}
            >
              <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {item.product?.image_url ? (
                  <img src={item.product.image_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Package size={18} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-foreground truncate">{item.product?.name}</p>
                <p className="text-[10px] text-muted-foreground font-mono">
                  SKU: {item.product?.sku || "N/A"} • {item.product?.production_department || "Unassigned"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-lg font-black ${isZero ? "text-red-600" : "text-amber-600"}`}>
                  {item.quantity}
                </p>
                <Badge variant={isZero ? "destructive" : "outline"} className="text-[9px]">
                  {isZero ? "OUT" : "LOW"}
                </Badge>
              </div>
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${
                isSelected ? "border-primary bg-primary" : "border-muted-foreground/30"
              }`}>
                {isSelected && <CheckCircle2 size={14} className="text-primary-foreground" />}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
