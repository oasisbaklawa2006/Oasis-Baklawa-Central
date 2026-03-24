import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Loader2, X } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const PACKS_PER_CARTON = 9;

const STATUSES = [
  "submitted",
  "in_production",
  "packed_ready",
  "awaiting_final_payment",
  "cleared_for_dispatch",
  "dispatched",
  "delivered",
  "cancelled",
] as const;

type OrderStatus = (typeof STATUSES)[number];

const STATUS_LABELS: Record<OrderStatus, string> = {
  submitted: "Submitted",
  in_production: "In Production",
  packed_ready: "Packed Ready",
  awaiting_final_payment: "Awaiting Final Payment",
  cleared_for_dispatch: "Cleared for Dispatch",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  submitted: "hsl(210, 60%, 55%)",
  in_production: "hsl(220, 70%, 55%)",
  packed_ready: "hsl(150, 50%, 45%)",
  awaiting_final_payment: "hsl(40, 40%, 59%)",
  cleared_for_dispatch: "hsl(30, 70%, 50%)",
  dispatched: "hsl(170, 55%, 45%)",
  delivered: "hsl(140, 60%, 40%)",
  cancelled: "hsl(0, 50%, 45%)",
};

const TERMINAL = new Set(["closed", "cancelled", "delivered"]);

interface OrderItem {
  id: string;
  quantity: number;
  product_id: string | null;
  pack_size?: string | null;
  carton_type?: string | null;
  products?: { name: string } | null;
  product?: { name: string } | null; // AppGen fallback
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
    // BULLETPROOF QUERY: We temporarily removed the 'company:companies' join
    // to see if that was crashing the board.
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        id, status, sales_order_value, company_id,
        order_items ( id, quantity, product_id )
      `,
      )
      .in("status", [...STATUSES]);

    if (error) {
      console.error("Database Error Details:", error);
      toast.error(`Database Error: ${error.message}`);
    } else {
      console.log("Orders successfully fetched:", data);
      setOrders((data as unknown as OrderCard[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const nextStatus = (current: string): string | null => {
    if (TERMINAL.has(current)) return null;
    const idx = STATUSES.indexOf(current as OrderStatus);
    if (idx < 0 || idx >= STATUSES.length - 1) return null;
    const next = STATUSES[idx + 1];
    if (next === "cancelled") return null;
    return next;
  };

  const handleAdvance = async (order: OrderCard) => {
    const next = nextStatus(order.status);
    if (!next) return;
    setUpdating(order.id);

    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success(`Moved to ${STATUS_LABELS[next as OrderStatus]}`);
      await fetchOrders();
    }
    setUpdating(null);
  };

  const handleOpenDrawer = async (order: OrderCard) => {
    setSelectedOrder(order);
    setDrawerLoading(true);

    // Fetching items using AppGen's specific relations
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
        id, quantity, product_id, pack_size, carton_type,
        products (name)
      `,
      )
      .eq("order_id", order.id);

    if (error) console.error(error);

    setDrawerItems((data as unknown as OrderItem[]) ?? []);
    setDrawerLoading(false);
  };

  const closeDrawer = () => {
    setSelectedOrder(null);
    setTimeout(() => setDrawerItems([]), 300);
  };

  const getTotalPacks = (items?: { quantity: number }[]) =>
    items?.reduce((sum, it) => sum + Number(it.quantity), 0) ?? 0;

  // Helper to safely grab the product name regardless of how Supabase returns the join
  const getProductName = (item: OrderItem) => {
    return item.products?.name || item.product?.name || "Unknown Product";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden flex flex-col">
      <TopNavBar />

      <main className="pt-24 px-5 flex-1 max-w-[100vw] overflow-hidden flex flex-col">
        <div className="mb-6">
          <h1 className="text-display-h2 text-foreground">Order Pipeline</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Drag-and-drop fulfillment flow</p>
        </div>

        {/* Scrollable pipeline */}
        <div className="overflow-x-auto flex-1 pb-4 no-scrollbar cursor-grab active:cursor-grabbing">
          <div className="flex gap-4 min-h-[600px]" style={{ minWidth: "max-content" }}>
            {STATUSES.map((status) => {
              const statusOrders = orders.filter((o) => o.status === status);
              return (
                <div
                  key={status}
                  className="w-64 flex-shrink-0 flex flex-col bg-muted/10 rounded-2xl p-3 border border-border"
                >
                  <div className="flex items-center justify-between mb-4 px-1">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                      <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
                        {STATUS_LABELS[status]}
                      </h3>
                    </div>
                    <span className="text-xs font-bold bg-background text-muted-foreground px-2 py-0.5 rounded-full border border-border">
                      {statusOrders.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                    {statusOrders.length === 0 && (
                      <div className="h-24 flex items-center justify-center border-2 border-dashed border-border rounded-xl">
                        <p className="text-xs font-bold text-muted-foreground/50 uppercase">Empty</p>
                      </div>
                    )}

                    {statusOrders.map((order) => {
                      const next = nextStatus(order.status);
                      const packs = getTotalPacks(order.order_items);
                      const cartons = Math.floor(packs / PACKS_PER_CARTON);

                      return (
                        <div
                          key={order.id}
                          className="rounded-xl p-4 border border-border bg-card cursor-pointer hover:border-primary/50 hover:shadow-md transition-all group"
                          onClick={() => handleOpenDrawer(order)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <p className="text-xs font-bold text-foreground line-clamp-1 flex-1 pr-2">
                              {order.company?.business_name || "Unknown Company"}
                            </p>
                            <p className="text-xs font-mono font-bold text-muted-foreground uppercase flex-shrink-0">
                              #{order.id.slice(0, 6)}
                            </p>
                          </div>

                          <p className="text-sm font-bold text-foreground mb-3">
                            ₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}
                          </p>

                          <div className="flex gap-3 text-xs font-semibold text-muted-foreground bg-muted/30 p-2 rounded-lg mb-3">
                            <span>📦 {packs} Packs</span>
                            <span>📦 {cartons} Ctns</span>
                          </div>

                          {next && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdvance(order);
                              }}
                              disabled={updating === order.id}
                              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 bg-primary/10 text-primary hover:bg-primary hover:text-white"
                            >
                              {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : "Advance Order"}
                              {updating !== order.id && <ArrowRight size={12} />}
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
        </div>
      </main>

      {/* --- SLIDE-OUT PANEL --- */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeDrawer}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 border-l border-border flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
                <div>
                  <h2 className="text-lg font-display tracking-wide text-foreground">
                    {selectedOrder.company?.business_name || "Order Details"}
                  </h2>
                  <p className="text-xs font-mono text-muted-foreground mt-1 uppercase">#{selectedOrder.id}</p>
                </div>
                <button
                  onClick={closeDrawer}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Current Status
                    </p>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: STATUS_COLORS[selectedOrder.status as OrderStatus] }}
                      />
                      <p className="text-sm font-bold text-foreground">
                        {STATUS_LABELS[selectedOrder.status as OrderStatus]}
                      </p>
                    </div>
                  </div>
                  <div className="bg-card p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Order Value
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      ₹{(selectedOrder.sales_order_value ?? 0).toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">Order Items</h3>

                  {drawerLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="animate-spin text-primary" size={24} />
                    </div>
                  ) : drawerItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      No items found.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {drawerItems.map((item) => (
                        <div key={item.id} className="p-3 rounded-xl border border-border bg-muted/10">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-bold text-foreground">{getProductName(item)}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Pack: {item.pack_size ?? "—"} • Ctn: {item.carton_type ?? "—"}
                              </p>
                            </div>
                            <p className="text-sm font-bold text-primary bg-primary/10 px-2 py-1 rounded-md">
                              {item.quantity}x
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Total Packs</span>
                    <span className="text-sm font-bold text-foreground">{getTotalPacks(drawerItems)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-border">
                    <span className="text-xs font-bold text-muted-foreground uppercase">Total Cartons</span>
                    <span className="text-sm font-bold text-foreground">
                      {Math.floor(getTotalPacks(drawerItems) / PACKS_PER_CARTON)}
                    </span>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminOrders;
