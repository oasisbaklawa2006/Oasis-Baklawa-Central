import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2, Package } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const STATUSES = ["awaiting_advance", "in_production", "assembly", "packing"] as const;
type OrderStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_advance: "Awaiting Advance",
  in_production: "In Production",
  assembly: "Assembly",
  packing: "Packing",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  awaiting_advance: "#f59e0b",
  in_production: "#3b82f6",
  assembly: "#8b5cf6",
  packing: "#10b981",
};

interface OrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  product_id: string | null;
  product?: { name: string } | null;
}

interface OrderCard {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  company?: { business_name: string } | null;
  order_items?: OrderItem[];
}

const AdminOrders = () => {
  const [orders, setOrders] = useState<OrderCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderCard | null>(null);
  const [drawerItems, setDrawerItems] = useState<OrderItem[]>([]);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const fetchOrders = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, company:companies(business_name), order_items(id, quantity, pack_size, carton_type, product_id)")
      .in("status", [...STATUSES]);
    setOrders((data as unknown as OrderCard[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchOrders(); }, []);

  const nextStatus = (current: string): string | null => {
    const idx = STATUSES.indexOf(current as OrderStatus);
    if (idx < 0 || idx >= STATUSES.length - 1) return null;
    return STATUSES[idx + 1];
  };

  const handleAdvance = async (order: OrderCard) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setUpdating(order.id);
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
    if (error) toast.error("Failed to update status");
    else { toast.success(`Moved to ${STATUS_LABELS[next as OrderStatus]}`); fetchOrders(); }
    setUpdating(null);
  };

  const handleOpenDrawer = async (order: OrderCard) => {
    setSelectedOrder(order);
    setDrawerLoading(true);
    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, pack_size, carton_type, product_id, product:products(name)")
      .eq("order_id", order.id);
    setDrawerItems((data as unknown as OrderItem[]) ?? []);
    setDrawerLoading(false);
  };

  const getTotalQty = (items?: { quantity: number }[]) =>
    items?.reduce((sum, it) => sum + it.quantity, 0) ?? 0;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Order Queue</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {STATUSES.map((status) => {
          const statusOrders = orders.filter((o) => o.status === status);
          return (
            <div key={status} className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                <h3 className="text-ui-h5 text-white">{STATUS_LABELS[status]}</h3>
                <span className="text-ui-cell text-[#666]">({statusOrders.length})</span>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {statusOrders.length === 0 && (
                  <p className="text-ui-cell text-[#555] px-3 py-6 text-center rounded-lg border border-dashed" style={{ borderColor: "#2a2a2a" }}>No orders</p>
                )}
                {statusOrders.map((order) => {
                  const next = nextStatus(order.status);
                  return (
                    <div
                      key={order.id}
                      className="rounded-xl p-4 space-y-3 border cursor-pointer hover:border-primary/40 transition-colors"
                      style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
                      onClick={() => handleOpenDrawer(order)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-ui-h5 text-white">{order.company?.business_name ?? "Unknown"}</p>
                          <p className="text-ui-cell text-[#666] mt-0.5">{order.id.slice(0, 8)}…</p>
                        </div>
                        <Package size={16} style={{ color: STATUS_COLORS[order.status as OrderStatus] }} />
                      </div>

                      <div className="flex justify-between text-ui-cell">
                        <span className="text-[#888]">Total Quantity</span>
                        <span className="text-ui-kpi text-sm text-white">{getTotalQty(order.order_items)}</span>
                      </div>
                      <div className="flex justify-between text-ui-cell">
                        <span className="text-[#888]">Value</span>
                        <span className="text-ui-kpi text-sm text-white">₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
                      </div>

                      {next && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAdvance(order); }}
                          disabled={updating === order.id}
                          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-ui-button transition-colors disabled:opacity-50"
                          style={{ backgroundColor: STATUS_COLORS[next as OrderStatus] + "20", color: STATUS_COLORS[next as OrderStatus] }}
                        >
                          {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                          Move to {STATUS_LABELS[next as OrderStatus]}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Details Drawer */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <SheetContent className="w-full sm:max-w-lg border-l" style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}>
          <SheetHeader>
            <SheetTitle className="text-display-h2 text-primary">Order Details</SheetTitle>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-6 space-y-6">
              <div className="space-y-1">
                <p className="text-ui-h4 text-white">{selectedOrder.company?.business_name ?? "Unknown Company"}</p>
                <p className="text-ui-cell text-[#666]">Order ID: {selectedOrder.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full text-ui-label" style={{ backgroundColor: STATUS_COLORS[selectedOrder.status as OrderStatus] + "20", color: STATUS_COLORS[selectedOrder.status as OrderStatus] }}>
                    {STATUS_LABELS[selectedOrder.status as OrderStatus] ?? selectedOrder.status}
                  </span>
                  <span className="text-ui-kpi text-sm text-[#888]">₹{(selectedOrder.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="border-t pt-4" style={{ borderColor: "#2a2a2a" }}>
                <h3 className="text-ui-h5 text-white mb-3">Order Items</h3>

                {drawerLoading ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
                ) : drawerItems.length === 0 ? (
                  <p className="text-ui-cell text-[#666]">No items found.</p>
                ) : (
                  <div className="space-y-3">
                    {drawerItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ backgroundColor: "#111111", borderColor: "#2a2a2a" }}>
                        <div>
                          <p className="text-ui-h5 text-white">{(item.product as any)?.name ?? "Unknown Product"}</p>
                          <p className="text-ui-cell text-[#666] mt-0.5">
                            Pack: {item.pack_size ?? "—"} · Carton: {item.carton_type ?? "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-ui-kpi text-sm text-white">×{item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 flex justify-between items-center" style={{ borderColor: "#2a2a2a" }}>
                <span className="text-ui-h5 text-[#888]">Total Quantity</span>
                <span className="text-ui-kpi text-lg text-white">{getTotalQty(drawerItems)}</span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminOrders;
