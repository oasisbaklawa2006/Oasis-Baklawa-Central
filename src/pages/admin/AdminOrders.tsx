import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Loader2, ShoppingBag, Clock, Truck, CheckCircle2, X, ChevronRight, PackageOpen, Receipt } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

// ─── Types ───
interface Order {
  id: string;
  user_id: string;
  status: string;
  total_amount: number;
  payment_status: string;
  created_at: string;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_time_of_order: number;
  products?: {
    name: string;
    image_url: string;
    pack_size: string;
  };
}

const AdminOrders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  // Panel State
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // 1. Fetch live orders
  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });

    if (!error) {
      setOrders((data as Order[]) ?? []);
    } else {
      console.error("Failed to fetch orders:", error);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  // 2. Fetch items for a specific order when the panel opens
  const fetchOrderItems = async (orderId: string) => {
    setItemsLoading(true);
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
        *,
        products (
          name,
          image_url,
          pack_size
        )
      `,
      )
      .eq("order_id", orderId);

    if (!error) {
      setOrderItems((data as unknown as OrderItem[]) ?? []);
    }
    setItemsLoading(false);
  };

  const openPanel = (order: Order) => {
    setSelectedOrder(order);
    fetchOrderItems(order.id);
  };

  const closePanel = () => {
    setSelectedOrder(null);
    setTimeout(() => setOrderItems([]), 300);
  };

  // 3. Update Order Status
  const updateOrderStatus = async (newStatus: string) => {
    if (!selectedOrder) return;
    setUpdatingStatus(true);

    const { error } = await supabase.from("orders").update({ status: newStatus }).eq("id", selectedOrder.id);

    if (!error) {
      toast.success(`Order marked as ${newStatus}`);
      setSelectedOrder({ ...selectedOrder, status: newStatus });
      await fetchOrders();
    } else {
      toast.error("Failed to update status");
      console.error(error);
    }
    setUpdatingStatus(false);
  };

  // UI Helpers
  const filteredOrders = orders.filter((o) =>
    activeTab === "all"
      ? true
      : activeTab === "completed"
        ? o.status === "delivered" || o.status === "cancelled"
        : o.status === activeTab,
  );

  const pendingCount = orders.filter((o) => o.status === "pending").length;
  const processingCount = orders.filter((o) => o.status === "processing" || o.status === "shipped").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-700 border-amber-200";
      case "processing":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "shipped":
        return "bg-indigo-100 text-indigo-700 border-indigo-200";
      case "delivered":
        return "bg-emerald-100 text-emerald-700 border-emerald-200";
      case "cancelled":
        return "bg-red-100 text-red-700 border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex justify-center items-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20 overflow-x-hidden">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-6xl mx-auto space-y-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-display-h2 text-foreground">Order Management</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Track and fulfill B2B wholesale orders</p>
        </motion.div>

        {/* --- KPI CARDS --- */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="bg-card p-5 rounded-2xl border border-amber-200/50 shadow-sm">
            <Clock size={20} className="text-amber-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">New Orders</p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-blue-200/50 shadow-sm">
            <Truck size={20} className="text-blue-500 mb-2" />
            <p className="text-2xl font-bold text-foreground">{processingCount}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">
              In Transit / Packing
            </p>
          </div>
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm hidden md:block">
            <ShoppingBag size={20} className="text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{orders.length}</p>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Lifetime</p>
          </div>
        </div>

        {/* --- DATA TABLE --- */}
        <section className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden flex flex-col min-h-[500px]">
          {/* Tabs */}
          <div className="flex overflow-x-auto border-b border-border bg-muted/10 no-scrollbar">
            {["pending", "processing", "shipped", "completed", "all"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-6 py-4 text-sm font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                  activeTab === tab
                    ? "text-primary border-b-2 border-primary bg-background"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/20 text-xs font-bold text-muted-foreground uppercase tracking-wider">
            <div className="col-span-4 md:col-span-3">Order ID</div>
            <div className="col-span-3 hidden md:block">Date</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-3 md:col-span-2 text-right">Amount</div>
            <div className="col-span-2 text-right hidden md:block">Action</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-border flex-1 overflow-y-auto">
            {filteredOrders.length === 0 ? (
              <div className="p-16 text-center">
                <PackageOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
                <p className="text-lg font-bold text-foreground">No orders found</p>
                <p className="text-sm text-muted-foreground">There are no orders matching this status.</p>
              </div>
            ) : (
              filteredOrders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => openPanel(order)}
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/10 cursor-pointer transition-colors group"
                >
                  <div className="col-span-4 md:col-span-3">
                    <p className="text-sm font-bold text-foreground font-mono uppercase">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 md:hidden">
                      {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="col-span-3 hidden md:block">
                    <p className="text-sm text-foreground">
                      {new Date(order.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(order.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <div className="col-span-4 md:col-span-3 flex items-center">
                    <span
                      className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full border ${getStatusColor(order.status)}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <div className="col-span-4 md:col-span-2 text-right">
                    <p className="text-sm font-bold text-foreground">₹{order.total_amount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{order.payment_status}</p>
                  </div>
                  <div className="col-span-2 justify-end hidden md:flex">
                    <button className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>

      {/* --- SLIDE-OUT PANEL --- */}
      <AnimatePresence>
        {selectedOrder && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 bottom-0 w-full max-w-lg bg-background shadow-2xl z-50 border-l border-border flex flex-col"
            >
              <div className="flex items-center justify-between p-6 border-b border-border bg-muted/10">
                <div>
                  <h2 className="text-lg font-display tracking-wide text-foreground">Order Details</h2>
                  <p className="text-xs font-mono text-muted-foreground mt-1 uppercase">#{selectedOrder.id}</p>
                </div>
                <button
                  onClick={closePanel}
                  className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-6">
                {/* Status Updater */}
                <div className="bg-card p-4 rounded-xl border border-border">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Update Fulfillment Status
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={selectedOrder.status}
                      onChange={(e) => updateOrderStatus(e.target.value)}
                      disabled={updatingStatus}
                      className="flex-1 text-sm p-2.5 bg-background border border-border rounded-lg outline-none focus:border-primary font-bold capitalize"
                    >
                      <option value="pending">Pending (New)</option>
                      <option value="processing">Processing (Packing)</option>
                      <option value="shipped">Shipped (In Transit)</option>
                      <option value="delivered">Delivered (Complete)</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                    {updatingStatus && (
                      <div className="p-2.5">
                        <Loader2 size={18} className="animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Order Meta */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-muted/10 p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Total Value
                    </p>
                    <p className="text-lg font-bold text-foreground">₹{selectedOrder.total_amount.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground capitalize mt-1 border-t border-border pt-1">
                      Pay: {selectedOrder.payment_status}
                    </p>
                  </div>
                  <div className="bg-muted/10 p-4 rounded-xl border border-border">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">
                      Date Placed
                    </p>
                    <p className="text-sm font-bold text-foreground">
                      {new Date(selectedOrder.created_at).toLocaleDateString("en-IN")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 border-t border-border pt-1">
                      {new Date(selectedOrder.created_at).toLocaleTimeString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                </div>

                {/* Items List */}
                <div>
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Receipt size={14} /> Purchased Items
                  </h3>

                  {itemsLoading ? (
                    <div className="py-8 flex justify-center">
                      <Loader2 className="animate-spin text-muted-foreground" size={24} />
                    </div>
                  ) : orderItems.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground border border-dashed border-border rounded-xl">
                      No items found for this order.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {orderItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex gap-4 p-3 rounded-xl border border-border bg-card items-center"
                        >
                          {item.products?.image_url ? (
                            <img
                              src={item.products.image_url}
                              alt="product"
                              className="w-12 h-12 rounded-md object-cover border border-border"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-muted/30 flex items-center justify-center border border-border">
                              <ImageIcon size={16} className="text-muted-foreground/40" />
                            </div>
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-bold text-foreground line-clamp-1">
                              {item.products?.name || "Unknown Product"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {item.products?.pack_size || "Custom pack"}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-foreground">{item.quantity}x</p>
                            <p className="text-xs text-muted-foreground">₹{item.price_at_time_of_order}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
