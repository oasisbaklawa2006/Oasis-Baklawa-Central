import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { toast } from "sonner";
import { Loader2, ChevronRight, Printer, Package, RefreshCw } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

const STATUS_FLOW = [
  { status: "submitted", label: "Order Placed", action: "Confirm Order", next: "confirmed", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { status: "confirmed", label: "Confirmed", action: "Send to Factory", next: "in_production", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { status: "in_production", label: "Manufacturing", action: "Mark Assembled", next: "assembled", color: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { status: "assembled", label: "Assembled", action: "Send to Packing", next: "packing", color: "bg-violet-100 text-violet-800 border-violet-200" },
  { status: "packing", label: "Packing", action: "Mark Packed", next: "packed_ready", color: "bg-purple-100 text-purple-800 border-purple-200" },
  { status: "packed_ready", label: "Packed Ready", action: "Request Payment", next: "awaiting_final_payment", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { status: "awaiting_final_payment", label: "Awaiting Payment", action: "Clear for Dispatch", next: "cleared_for_dispatch", color: "bg-orange-100 text-orange-800 border-orange-200" },
  { status: "cleared_for_dispatch", label: "Cleared", action: "Mark Dispatched", next: "dispatched", color: "bg-teal-100 text-teal-800 border-teal-200" },
  { status: "dispatched", label: "Dispatched", action: "Confirm Delivery", next: "delivered", color: "bg-cyan-100 text-cyan-800 border-cyan-200" },
  { status: "delivered", label: "Delivered", action: null, next: null, color: "bg-green-100 text-green-800 border-green-200" },
  { status: "cancelled", label: "Cancelled", action: null, next: null, color: "bg-red-100 text-red-800 border-red-200" },
];

const getStatusInfo = (status: string) => STATUS_FLOW.find(s => s.status === status) || { label: status, action: null, next: null, color: "bg-muted text-muted-foreground border-border" };

interface OrderRow {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  company: { business_name: string } | null;
}

interface OrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  product: { name: string } | null;
}

const OrderManagement = () => {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, created_at, sales_order_value, company:companies(business_name)")
      .neq("status", "draft")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("OrderManagement fetch error:", error);
      toast.error("Failed to load orders");
    } else {
      setOrders((data as any[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchOrders();
    const channelName = "order-mgmt-rt";
    removeDuplicateRealtimeChannel(channelName);
    const ch = supabase.channel(channelName)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchOrders())
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [fetchOrders]);

  const handleAction = async (orderId: string, nextStatus: string) => {
    setActionLoading(orderId);
    const currentOrder = orders.find(o => o.id === orderId);
    const { error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    if (error) {
      toast.error("Failed to update status");
    } else {
      await supabase.from("order_status_history").insert({
        order_id: orderId,
        old_status: currentOrder?.status ?? null,
        new_status: nextStatus,
      });
      toast.success(`Order moved to ${getStatusInfo(nextStatus).label}`);
    }
    setActionLoading(null);
  };

  const openPickingList = async (orderId: string) => {
    setSelectedOrder(orderId);
    setItemsLoading(true);
    const { data } = await supabase
      .from("order_items")
      .select("id, quantity, pack_size, product:products(name)")
      .eq("order_id", orderId);
    setOrderItems((data as any[]) ?? []);
    setItemsLoading(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Order Management</h1>
          <p className="text-sm text-muted-foreground">{orders.length} active orders</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchOrders} className="gap-2">
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Order ID</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Customer</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Value</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Action</th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground">Details</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No orders found</td></tr>
            )}
            {orders.map((order) => {
              const info = getStatusInfo(order.status);
              const companyName = (order.company as any)?.business_name ?? "—";
              return (
                <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-foreground">
                    {order.id.slice(0, 8).toUpperCase()}
                  </td>
                  <td className="px-4 py-3 text-foreground">{companyName}</td>
                  <td className="px-4 py-3 text-right font-mono text-foreground">
                    ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium border ${info.color}`}>
                      {info.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {info.action && info.next ? (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={actionLoading === order.id}
                        onClick={(e) => { e.stopPropagation(); handleAction(order.id, info.next!); }}
                        className="text-xs gap-1"
                      >
                        {actionLoading === order.id ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                        {info.action}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => openPickingList(order.id)} className="gap-1 text-xs">
                      <Package size={12} /> View
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Picking List Sidebar */}
      <Sheet open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Package size={18} /> Picking List
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {selectedOrder && (
              <p className="text-xs text-muted-foreground font-mono mb-3">Order: {selectedOrder.slice(0, 8).toUpperCase()}</p>
            )}
            {itemsLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : orderItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No items found for this order.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 text-muted-foreground font-medium">Product</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Qty</th>
                    <th className="text-right py-2 text-muted-foreground font-medium">Pack</th>
                  </tr>
                </thead>
                <tbody>
                  {orderItems.map((item) => (
                    <tr key={item.id} className="border-b border-border last:border-0">
                      <td className="py-2 text-foreground">{(item.product as any)?.name ?? "—"}</td>
                      <td className="py-2 text-right font-mono text-foreground">{item.quantity}</td>
                      <td className="py-2 text-right text-muted-foreground">{item.pack_size ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Button variant="outline" className="w-full mt-4 gap-2" onClick={() => toast.info("Print functionality coming soon")}>
              <Printer size={14} /> Print Packing Slip
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OrderManagement;
