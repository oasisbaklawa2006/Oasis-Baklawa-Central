import { useCallback, useEffect, useState } from "react";
import { blockLegacyProductionMutation } from "@/lib/production-lifecycle";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Loader2, PackageOpen, Plus, Search, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ProductStock {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  image_url: string | null;
  produced: number;
  dispatched: number;
  currentStock: number;
}

const AdminInventory = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<ProductStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [addStockProduct, setAddStockProduct] = useState<ProductStock | null>(null);
  const [addQty, setAddQty] = useState<number | string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all active products
      const { data: products, error: pErr } = await supabase
        .from("products")
        .select("id, name, sku, category, image_url")
        .eq("is_active", true)
        .order("name");

      if (pErr) throw pErr;

      // Fetch all daily_production_logs and sum produced_qty by product_id
      const { data: prodLogs, error: plErr } = await supabase
        .from("daily_production_logs")
        .select("product_id, produced_qty");

      if (plErr) throw plErr;

      const producedMap: Record<string, number> = {};
      (prodLogs || []).forEach((row) => {
        producedMap[row.product_id] = (producedMap[row.product_id] || 0) + (Number(row.produced_qty) || 0);
      });

      // Fetch dispatched/delivered order items
      const { data: dispatchedOrders, error: doErr } = await supabase
        .from("orders")
        .select("id")
        .in("status", ["dispatched", "delivered"]);

      if (doErr) throw doErr;

      const dispatchedOrderIds = (dispatchedOrders || []).map((o) => o.id);

      const fulfilledMap: Record<string, number> = {};
      if (dispatchedOrderIds.length > 0) {
        const { data: orderItems, error: oiErr } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .in("order_id", dispatchedOrderIds);

        if (oiErr) throw oiErr;

        (orderItems || []).forEach((row) => {
          if (row.product_id) {
            fulfilledMap[row.product_id] = (fulfilledMap[row.product_id] || 0) + (Number(row.quantity) || 0);
          }
        });
      }

      const mapped: ProductStock[] = (products || []).map((p) => {
        const produced = producedMap[p.id] || 0;
        const dispatched = fulfilledMap[p.id] || 0;
        return {
          id: p.id,
          name: p.name,
          sku: p.sku,
          category: p.category,
          image_url: p.image_url,
          produced,
          dispatched,
          currentStock: produced - dispatched,
        };
      });

      setItems(mapped);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleAddStock = async () => {
    const block = blockLegacyProductionMutation("AdminInventory.handleAddStock");
    toast.error(block.message);
    return;
  };

  const filtered = items.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (i.sku || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <PackageOpen className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-black text-foreground tracking-tight">Factory Stock</h1>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 rounded-xl"
        />
      </div>

      {/* Stock Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const isLow = item.currentStock <= 0;
          return (
            <div
              key={item.id}
              className={`rounded-2xl border p-5 shadow-sm transition-all ${
                isLow ? "border-destructive/40 bg-destructive/5" : "border-border bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <img
                  src={item.image_url || "/placeholder.svg"}
                  alt={item.name}
                  className="w-14 h-14 rounded-xl object-cover border border-border"
                />
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {item.category || "—"}
                  </span>
                  <h3 className="text-sm font-black text-foreground mt-0.5 truncate">{item.name}</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">{item.sku || "No SKU"}</p>
                </div>
              </div>

              <div className="mt-4 space-y-1">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  <span>Produced: {item.produced}</span>
                  <span>Fulfilled: {item.dispatched}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  {isLow && <AlertTriangle className="h-4 w-4 text-destructive mr-1" />}
                  <span className={`text-3xl font-black ${isLow ? "text-destructive" : "text-foreground"}`}>
                    {item.currentStock}
                  </span>
                  <span className="text-sm text-muted-foreground">units</span>
                </div>
              </div>

              <button
                onClick={() => setAddStockProduct(item)}
                className="mt-4 w-full py-2.5 rounded-xl border border-border text-foreground font-bold text-xs hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Plus className="h-4 w-4" /> Add Production Stock
              </button>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-muted-foreground py-12">No products found.</p>
      )}

      {/* ADD STOCK MODAL */}
      <Dialog open={!!addStockProduct} onOpenChange={(open) => { if (!open) setAddStockProduct(null); }}>
        <DialogContent className="rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add Production Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              Product: <span className="font-bold text-foreground">{addStockProduct?.name}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Current Stock: <span className="font-bold text-foreground">{addStockProduct?.currentStock} units</span>
            </p>
            <div>
              <Label>Quantity Produced</Label>
              <Input
                type="number"
                value={addQty}
                onChange={(e) => setAddQty(Number(e.target.value))}
                placeholder="e.g. 50"
                className="rounded-xl bg-muted/50 font-black text-xl h-14"
                autoFocus
              />
            </div>
            <button
              onClick={handleAddStock}
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-foreground text-background font-black text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Confirm Stock Addition"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminInventory;
