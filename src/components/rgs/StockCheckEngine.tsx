import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Package, CheckCircle2, AlertTriangle, Zap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import StagnancyBadge from "@/components/StagnancyBadge";
import { classifyFlow, mapToJobDept, isOrderFullyReady } from "@/utils/departmentClassifier";

interface StockItem {
  id: string;
  product_id: string | null;
  quantity: number;
  actual_packed_qty: number | null;
  production_status: string | null;
  department: string | null;
  order_id: string | null;
  product?: { name: string; sku: string | null; image_url: string | null; production_department: string | null } | null;
}

interface OrderWithStock {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  company?: { business_name: string } | null;
  items: StockItem[];
  stockStatus: "ready" | "partial" | "pending_production";
}

// RGS only shows FGS food items - no Assembly/3PCS flow labels needed

export default function StockCheckEngine() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithStock[]>([]);
  const [stockMap, setStockMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);
  const autoPostedRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const { data: inv } = await supabase.from("factory_inventory").select("product_id, quantity");
    const sm: Record<string, number> = {};
    (inv || []).forEach((r) => {
      if (r.product_id) sm[r.product_id] = (sm[r.product_id] || 0) + (Number(r.quantity) || 0);
    });
    setStockMap(sm);

    const { data: orderData } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, company:companies(business_name)")
      .in("status", ["in_production", "manufacturing", "partial_ready", "approved", "confirmed"])
      .order("created_at", { ascending: true });

    const result: OrderWithStock[] = [];
    for (const o of orderData || []) {
      const { data: items } = await supabase
        .from("order_items")
        .select("id, quantity, actual_packed_qty, production_status, department, product_id, order_id, product:products(name, sku, image_url, production_department)")
        .eq("order_id", o.id);

      // STRICT FILTER: RGS only sees FLOW_FGS (food) items
      const typedItems = ((items as any[] || []) as StockItem[]).filter((item) => {
        const prodDept = item.product?.production_department || item.department;
        return classifyFlow(prodDept) === "FLOW_FGS";
      });

      // Skip orders with zero food items
      if (typedItems.length === 0) continue;

      let allReady = true;
      let anyReady = false;
      for (const item of typedItems) {
        const available = sm[item.product_id || ""] || 0;
        const needed = item.quantity - (item.actual_packed_qty || 0);
        if (needed > 0 && available >= needed) anyReady = true;
        if (needed > 0 && available < needed) allReady = false;
        if (needed <= 0) anyReady = true;
      }

      const stockStatus = allReady && typedItems.length > 0 ? "ready" : anyReady ? "partial" : "pending_production";
      result.push({ ...o, items: typedItems, stockStatus } as OrderWithStock);
    }

    result.sort((a, b) => {
      const order = { ready: 0, partial: 1, pending_production: 2 };
      return order[a.stockStatus] - order[b.stockStatus];
    });

    setOrders(result);
    setLoading(false);
    return { orders: result, stockMap: sm };
  }, []);

  /**
   * AUTO-POST: On load, automatically create production_jobs for food shortfalls,
   * and instantly post Assembly/3PCS tasks to their handhelds.
   */
  const autoPostShortfalls = useCallback(async (ordersToProcess: OrderWithStock[], sm: Record<string, number>) => {
    for (const order of ordersToProcess) {
      for (const item of order.items) {
        // Skip already-processed or completed items
        if (item.production_status === "completed" || item.production_status === "in_production" || item.production_status === "accepted") continue;
        const itemKey = `${item.id}`;
        if (autoPostedRef.current.has(itemKey)) continue;

        const prodDept = item.product?.production_department || item.department;
        const flow = classifyFlow(prodDept);
        const available = sm[item.product_id || ""] || 0;
        const needed = item.quantity - (item.actual_packed_qty || 0);

        if (needed <= 0 || !item.product_id) continue;

        switch (flow) {
          case "FLOW_FGS": {
            const shortfall = needed - available;
            if (shortfall <= 0) continue; // Stock covers it

            // Check if a production_job already exists for this item
            const { data: existing } = await supabase
              .from("production_jobs")
              .select("id")
              .eq("order_item_id", item.id)
              .in("status", ["pending", "accepted", "in_production", "paused"])
              .limit(1);

            if (existing && existing.length > 0) {
              autoPostedRef.current.add(itemKey);
              continue;
            }

            const dept = mapToJobDept(prodDept);
            await supabase.from("production_jobs").insert({
              order_item_id: item.id,
              order_id: order.id,
              product_id: item.product_id,
              department: dept,
              assigned_qty: shortfall,
              priority: "urgent",
              status: "pending",
              stage: "prep",
            });
            autoPostedRef.current.add(itemKey);
            break;
          }
          case "FLOW_ASSEMBLY": {
            // Instant post to Assembly — update order_items directly
            if (item.production_status !== "pending") {
              await supabase.from("order_items").update({
                production_status: "pending",
                department: prodDept || "Packing & Assembly",
              }).eq("id", item.id);
            }
            autoPostedRef.current.add(itemKey);
            break;
          }
          case "FLOW_3PCS": {
            // Instant post to 3PCS
            if (item.production_status !== "pending") {
              await supabase.from("order_items").update({
                production_status: "pending",
                  department: "3rd Party",
              }).eq("id", item.id);
            }
            autoPostedRef.current.add(itemKey);
            break;
          }
        }
      }

      // Move order to 'manufacturing' — NEVER regress to draft/submitted
      const LOCKED_STATUSES = ["manufacturing", "packed_ready", "dispatched", "delivered", "closed"];
      if (!LOCKED_STATUSES.includes(order.status)) {
        await supabase.from("orders").update({ status: "manufacturing" }).eq("id", order.id);
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const result = await fetchData();
      if (result) {
        await autoPostShortfalls(result.orders, result.stockMap);
        // Refresh after auto-posting
        await fetchData();
      }
    })();
  }, [fetchData, autoPostShortfalls]);

  /**
   * FULFILL: Auto-fulfill available items from stock. Mark order as packed_ready
   * only when ALL items across ALL 3 flows are completed.
   */
  const handleAutoFulfill = async (order: OrderWithStock) => {
    setActing(order.id);
    for (const item of order.items) {
      const available = stockMap[item.product_id || ""] || 0;
      const needed = item.quantity - (item.actual_packed_qty || 0);
      if (needed <= 0) continue;
      if (available >= needed) {
        await supabase.from("order_items").update({
          actual_packed_qty: item.quantity,
          production_status: "completed",
        }).eq("id", item.id);
      }
    }

    const { data: freshItems } = await supabase
      .from("order_items")
      .select("production_status")
      .eq("order_id", order.id);

    const allDone = isOrderFullyReady((freshItems as any[]) || []);

    if (allDone) {
      await supabase.from("orders").update({ status: "packed_ready" }).eq("id", order.id);
      toast.success("✅ All 3 flows complete → Ready for Shipping");
    } else {
      toast.success("✅ Available items fulfilled. Waiting on remaining flows.");
    }
    fetchData();
    setActing(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary" size={24} /></div>;

  return (
    <div className="space-y-3">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2 mb-2">
        <Card className="bg-emerald-500/10 border-emerald-400/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-emerald-700">{orders.filter(o => o.stockStatus === "ready").length}</p>
            <p className="text-[10px] font-bold text-emerald-600 uppercase">Ready</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/10 border-amber-400/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-amber-700">{orders.filter(o => o.stockStatus === "partial").length}</p>
            <p className="text-[10px] font-bold text-amber-600 uppercase">Partial</p>
          </CardContent>
        </Card>
        <Card className="bg-red-500/10 border-red-400/40">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-black text-red-700">{orders.filter(o => o.stockStatus === "pending_production").length}</p>
            <p className="text-[10px] font-bold text-red-600 uppercase">In Production</p>
          </CardContent>
        </Card>
      </div>

      {/* Auto-post status banner */}
      <Card className="bg-blue-500/10 border-blue-400/40">
        <CardContent className="p-3 flex items-center gap-2">
          <Zap size={16} className="text-blue-600" />
          <p className="text-xs text-blue-700 font-medium">
            Showing Food items only · Shortfalls auto-posted to HOD Handhelds
          </p>
        </CardContent>
      </Card>

      {orders.map((order) => {
        const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
        const readyQty = order.items.reduce((s, i) => {
          const avail = stockMap[i.product_id || ""] || 0;
          const needed = i.quantity - (i.actual_packed_qty || 0);
          return s + (needed <= 0 ? i.quantity : Math.min(avail, needed) + (i.actual_packed_qty || 0));
        }, 0);
        const pct = totalQty > 0 ? Math.round((readyQty / totalQty) * 100) : 0;

        // All items here are already FLOW_FGS filtered

        return (
          <Card key={order.id} className={`border-l-4 ${
            order.stockStatus === "ready" ? "border-l-emerald-500" :
            order.stockStatus === "partial" ? "border-l-amber-500" : "border-l-red-500"
          }`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-sm text-foreground">SO#{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{order.company?.business_name || "N/A"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">₹{(order.sales_order_value || 0).toLocaleString()}</Badge>
                  <StagnancyBadge createdAt={order.created_at} />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Stock Check</span>
                  <span className={order.stockStatus === "ready" ? "text-emerald-600 font-bold" : ""}>{pct}% available</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>

              {/* Food Items Only — no Triad breakdown needed */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Layers size={12} className="text-muted-foreground" />
                  <Badge className="text-[9px] px-1.5 py-0 border bg-blue-500/20 text-blue-700 border-blue-400/40">
                    FGS Food
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">{order.items.length} item{order.items.length > 1 ? "s" : ""}</span>
                  <span className="text-[9px] text-blue-600 font-medium ml-auto">Auto-posted shortfalls</span>
                </div>
                {order.items.map((item) => {
                    const avail = stockMap[item.product_id || ""] || 0;
                    const needed = item.quantity - (item.actual_packed_qty || 0);
                    const isMet = needed <= 0 || avail >= needed;
                    const shortfall = Math.max(0, needed - avail);
                    return (
                      <div key={item.id} className={`flex items-center gap-2 text-xs rounded-lg p-2 border ${isMet ? "bg-emerald-500/5 border-emerald-400/30" : "bg-red-500/5 border-red-400/30"}`}>
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center overflow-hidden shrink-0">
                          {item.product?.image_url ? <img src={item.product.image_url} className="w-full h-full object-cover" /> : <Package size={14} className="text-muted-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-foreground">{item.product?.name || "Unknown"}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Need: {needed > 0 ? needed : 0} · Stock: <span className={isMet ? "text-emerald-600 font-bold" : "text-red-600 font-bold"}>{avail}</span>
                            {!isMet && shortfall > 0 && (
                              <span className="text-red-600 font-bold ml-1">· Gap: {shortfall} → HOD</span>
                            )}
                          </p>
                        </div>
                        {isMet ? (
                          <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                        ) : (
                          <AlertTriangle size={16} className="text-red-500 shrink-0" />
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Action: Only "Fulfill Available" — no manual Triad Split needed */}
              <div className="flex gap-2">
                {order.stockStatus === "ready" && (
                  <Button size="sm" className="flex-1 text-xs" onClick={() => handleAutoFulfill(order)} disabled={acting === order.id}>
                    {acting === order.id ? <Loader2 size={14} className="animate-spin" /> : <><CheckCircle2 size={14} className="mr-1" /> All Flows Complete → Dispatch</>}
                  </Button>
                )}
                {(order.stockStatus === "partial" || order.stockStatus === "pending_production") && (
                  <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={() => handleAutoFulfill(order)} disabled={acting === order.id}>
                    {acting === order.id ? <Loader2 size={14} className="animate-spin" /> : <><Zap size={14} className="mr-1" /> Fulfill Available Stock</>}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {orders.length === 0 && (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No active orders requiring stock check.</CardContent></Card>
      )}
    </div>
  );
}
