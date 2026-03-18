import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowRight, Loader2, Package } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const PACKS_PER_CARTON = 9;

const STATUSES = ["awaiting_advance", "in_production", "assembly", "packing", "ready_for_dispatch", "dispatched", "complaint_window"] as const;
type OrderStatus = typeof STATUSES[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  awaiting_advance: "Awaiting Advance",
  in_production: "In Production",
  assembly: "Assembly",
  packing: "Packing",
  ready_for_dispatch: "Dispatch Ready",
  dispatched: "Dispatched",
  complaint_window: "Complaint Window",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  awaiting_advance: "hsl(40, 40%, 59%)",
  in_production: "hsl(220, 70%, 55%)",
  assembly: "hsl(280, 60%, 55%)",
  packing: "hsl(150, 50%, 45%)",
  ready_for_dispatch: "hsl(30, 70%, 50%)",
  dispatched: "hsl(170, 55%, 45%)",
  complaint_window: "hsl(0, 70%, 55%)",
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
    else {
      toast.success(`Moved to ${STATUS_LABELS[next as OrderStatus]}`);
      await supabase.from("order_status_history").insert({
        order_id: order.id,
        old_status: order.status,
        new_status: next,
      });
      fetchOrders();
    }
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

  const getTotalPacks = (items?: { quantity: number }[]) =>
    items?.reduce((sum, it) => sum + it.quantity, 0) ?? 0;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  // Group by status for pipeline view
  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">Order Pipeline</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {STATUSES.map((status) => {
          const statusOrders = orders.filter((o) => o.status === status);
          return (
            <div key={status} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                <h3 className="text-fine text-foreground font-semibold">{STATUS_LABELS[status]}</h3>
                <span className="text-fine text-muted-foreground">({statusOrders.length})</span>
              </div>

              <div className="space-y-2 min-h-[80px]">
                {statusOrders.length === 0 && (
                  <p className="text-fine text-muted-foreground px-2 py-4 text-center rounded-lg border border-dashed border-border">—</p>
                )}
                {statusOrders.map((order) => {
                  const next = nextStatus(order.status);
                  const packs = getTotalPacks(order.order_items);
                  const cartons = Math.floor(packs / PACKS_PER_CARTON);
                  return (
                    <div
                      key={order.id}
                      className="rounded-xl p-3 space-y-2 border border-border bg-card cursor-pointer hover:border-primary/40 transition-colors"
                      style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
                      onClick={() => handleOpenDrawer(order)}
                    >
                      <p className="text-ui-cell text-foreground font-medium truncate">{order.company?.business_name ?? "—"}</p>
                      <p className="text-fine text-muted-foreground">{order.id.slice(0, 8)}…</p>
                      <div className="flex justify-between text-fine">
                        <span className="text-muted-foreground">Packs: {packs}</span>
                        <span className="text-muted-foreground">Cartons: {cartons}</span>
                      </div>
                      <p className="text-fine text-foreground">₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</p>

                      {next && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAdvance(order); }}
                          disabled={updating === order.id}
                          className="w-full flex items-center justify-center gap-1 py-1.5 rounded-lg text-fine font-semibold transition-colors disabled:opacity-50 bg-primary/10 text-primary hover:bg-primary/20"
                        >
                          {updating === order.id ? <Loader2 size={10} className="animate-spin" /> : <ArrowRight size={10} />}
                          → {STATUS_LABELS[next as OrderStatus]}
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
        <SheetContent className="w-full sm:max-w-lg border-l border-border bg-card">
          <SheetHeader>
            <SheetTitle className="text-display-h2 text-foreground">Order Details</SheetTitle>
          </SheetHeader>

          {selectedOrder && (
            <div className="mt-6 space-y-6">
              <div className="space-y-1">
                <p className="text-ui-h4 text-foreground">{selectedOrder.company?.business_name ?? "Unknown"}</p>
                <p className="text-ui-cell text-muted-foreground">Order ID: {selectedOrder.id}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-1 rounded-full text-ui-label bg-primary/10 text-primary">
                    {STATUS_LABELS[selectedOrder.status as OrderStatus] ?? selectedOrder.status}
                  </span>
                  <span className="text-ui-kpi text-sm text-muted-foreground">₹{(selectedOrder.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <h3 className="text-ui-h5 text-foreground mb-3">Order Items</h3>
                {drawerLoading ? (
                  <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
                ) : drawerItems.length === 0 ? (
                  <p className="text-ui-cell text-muted-foreground">No items found.</p>
                ) : (
                  <div className="space-y-3">
                    {drawerItems.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                        <div>
                          <p className="text-ui-h5 text-foreground">{(item.product as any)?.name ?? "Unknown Product"}</p>
                          <p className="text-fine text-muted-foreground mt-0.5">
                            Pack Size: {item.pack_size ?? "—"} · Carton Type: {item.carton_type ?? "—"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-ui-kpi text-sm text-foreground">×{item.quantity} packs</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-ui-h5 text-muted-foreground">Total Packs</span>
                  <span className="text-ui-kpi text-lg text-foreground">{getTotalPacks(drawerItems)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-ui-h5 text-muted-foreground">Total Cartons</span>
                  <span className="text-ui-kpi text-lg text-foreground">{Math.floor(getTotalPacks(drawerItems) / PACKS_PER_CARTON)}</span>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default AdminOrders;
