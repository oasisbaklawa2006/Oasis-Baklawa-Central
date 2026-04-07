import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, Plus, Search, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { mapToJobDept, classifyFlow } from "@/utils/departmentClassifier";

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  image_url: string | null;
  production_department: string | null;
}

/**
 * FGS Manager "Production Planning" Panel
 * For REGULAR / BUFFER stock build-up orders.
 * Manager selects a product, enters qty → creates a Normal priority production_job.
 */
export default function ProductionPlanningPanel() {
  const { user } = useAuth();
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [filtered, setFiltered] = useState<ProductOption[]>([]);
  const [search, setSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [qty, setQty] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [recentJobs, setRecentJobs] = useState<any[]>([]);

  const fetchProducts = useCallback(async () => {
    const { data } = await supabase
      .from("products")
      .select("id, name, sku, image_url, production_department")
      .order("name");
    const foodProducts = ((data as any[]) || []).filter(p =>
      classifyFlow(p.production_department) === "FLOW_FGS"
    );
    setProducts(foodProducts);
    setFiltered(foodProducts);
  }, []);

  const fetchRecentJobs = useCallback(async () => {
    const { data } = await supabase
      .from("production_jobs")
      .select("id, product:products(name, image_url), department, assigned_qty, priority, status, created_at")
      .eq("priority", "normal")
      .order("created_at", { ascending: false })
      .limit(10);
    setRecentJobs((data as any[]) || []);
  }, []);

  useEffect(() => { fetchProducts(); fetchRecentJobs(); }, [fetchProducts, fetchRecentJobs]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(products); return; }
    const q = search.toLowerCase();
    setFiltered(products.filter(p =>
      p.name.toLowerCase().includes(q) || (p.sku || "").toLowerCase().includes(q)
    ));
  }, [search, products]);

  const handleSubmit = async () => {
    if (!selectedProduct) { toast.error("Select a product"); return; }
    const quantity = parseInt(qty);
    if (isNaN(quantity) || quantity <= 0) { toast.error("Enter a valid quantity"); return; }

    setSubmitting(true);
    const dept = mapToJobDept(selectedProduct.production_department);

    await supabase.from("production_jobs").insert({
      product_id: selectedProduct.id,
      department: dept,
      assigned_qty: quantity,
      priority: "normal",
      status: "pending",
      stage: "prep",
      order_item_id: null,
      order_id: null,
    });

    toast.success(`📦 Stock Build-Up: ${quantity}x ${selectedProduct.name} → ${dept} (Normal Priority)`);
    setSelectedProduct(null);
    setQty("");
    setSearch("");
    fetchRecentJobs();
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Factory size={16} className="text-primary" />
            Regular Stock Build-Up Order
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Select a food product and enter quantity. This creates a <strong>Normal</strong> priority job on the HOD Handheld.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Product search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search product by name or SKU..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 text-sm"
            />
          </div>

          {/* Selected product */}
          {selectedProduct && (
            <div className="flex items-center gap-3 p-3 rounded-lg border border-primary/40 bg-primary/5">
              <div className="w-12 h-12 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {selectedProduct.image_url ? (
                  <img src={selectedProduct.image_url} className="w-full h-full object-cover" />
                ) : (
                  <Package size={18} className="text-muted-foreground" />
                )}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm text-foreground">{selectedProduct.name}</p>
                <p className="text-xs text-muted-foreground">SKU: {selectedProduct.sku || "N/A"} · Dept: {selectedProduct.production_department || "N/A"}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelectedProduct(null)} className="text-xs">✕</Button>
            </div>
          )}

          {/* Product grid (show when searching and no selection) */}
          {!selectedProduct && search.trim() && (
            <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
              {filtered.slice(0, 12).map(p => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProduct(p); setSearch(""); }}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg border hover:border-primary/60 hover:bg-primary/5 transition-colors"
                >
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} className="w-full h-full object-cover" />
                    ) : (
                      <Package size={14} className="text-muted-foreground" />
                    )}
                  </div>
                  <p className="text-[10px] font-medium text-foreground truncate w-full text-center">{p.name}</p>
                </button>
              ))}
              {filtered.length === 0 && <p className="col-span-3 text-xs text-muted-foreground text-center py-4">No food products found</p>}
            </div>
          )}

          {/* Quantity + Submit */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Quantity"
              value={qty}
              onChange={e => setQty(e.target.value)}
              className="flex-1"
              min={1}
            />
            <Button onClick={handleSubmit} disabled={submitting || !selectedProduct} className="gap-1">
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} /> Order for Stock</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent buffer orders */}
      {recentJobs.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Recent Stock Build-Up Orders</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentJobs.map(job => (
              <div key={job.id} className="flex items-center gap-2 p-2 rounded border text-xs">
                <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                  {job.product?.image_url ? (
                    <img src={job.product.image_url} className="w-full h-full object-cover" />
                  ) : (
                    <Package size={12} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{job.product?.name || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground">{job.department} · {job.assigned_qty} units</p>
                </div>
                <Badge variant="outline" className="text-[9px]">{job.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
