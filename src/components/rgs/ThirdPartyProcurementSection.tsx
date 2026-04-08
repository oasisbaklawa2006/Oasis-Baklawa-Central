import { useCallback, useEffect, useState } from "react";
import { Loader2, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isActiveFactoryOrderStatus, isActiveProductionStatus, isThirdPartyItem } from "@/lib/third-party";

interface ProcurementItem {
  id: string;
  order_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  product?: {
    name: string;
    sku: string | null;
    image_url: string | null;
    production_department: string | null;
  } | null;
  order?: {
    status: string | null;
  } | null;
}

export default function ThirdPartyProcurementSection() {
  const [items, setItems] = useState<ProcurementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const { data, error } = await supabase
        .from("order_items")
        .select("id, order_id, quantity, actual_packed_qty, production_status, department, product:products(name, sku, image_url, production_department), order:orders(status)")
        .in("production_status", ["pending", "accepted", "in_progress", "in_production", "partial_ready"])
        .order("id", { ascending: false })
        .limit(200);

      if (error) throw error;

      const nextItems = (((data as any[]) || []) as ProcurementItem[])
        .filter((item) => isThirdPartyItem(item.department, item.product?.production_department))
        .filter((item) => isActiveProductionStatus(item.production_status))
        .filter((item) => isActiveFactoryOrderStatus(item.order?.status))
        .sort((a, b) => (b.quantity - (b.actual_packed_qty || 0)) - (a.quantity - (a.actual_packed_qty || 0)));

      setItems(nextItems);
    } catch (error) {
      console.error("[ThirdPartyProcurementSection] Failed to load procurement items", error);
      setItems([]);
      setErrorMessage("No Procurement Tasks Active");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" size={20} /></div>;
  }

  if (errorMessage || items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground text-sm">
          {errorMessage || "No Procurement Tasks Active"}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pendingQty = Math.max(0, item.quantity - (item.actual_packed_qty || 0));

        return (
          <Card key={item.id}>
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {item.product?.image_url ? (
                    <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Package size={16} className="text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{item.product?.name || "Unnamed procurement item"}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {item.order_id ? `SO#${item.order_id.slice(0, 8).toUpperCase()}` : "No order linked"}
                    {item.product?.sku ? ` · SKU: ${item.product.sku}` : ""}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="outline">{item.department || "3rd Party"}</Badge>
                    <span className="text-xs font-bold text-foreground ml-auto">Qty: {pendingQty}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
