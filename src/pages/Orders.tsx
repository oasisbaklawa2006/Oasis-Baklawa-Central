import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, ChevronRight, Clock, CheckCircle2 } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import BottomNavBar from "@/components/BottomNavBar";

interface OrderItem {
  quantity: number;
  product: { name: string } | null;
}

interface Order {
  id: string;
  status: string;
  sales_order_value: number;
  created_at: string;
  order_items: OrderItem[];
}

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchOrders = async () => {
      // 1. Verify Session
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      // 2. Fetch real orders strictly for this user's company (Enforced by RLS)
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          id, 
          status, 
          sales_order_value, 
          created_at, 
          order_items (
            quantity,
            product:products(name)
          )
        `,
        )
        .order("created_at", { ascending: false });

      if (!error && data) {
        setOrders(data as unknown as Order[]);
      } else if (error) {
        console.error("Error fetching orders:", error);
      }

      setLoading(false);
    };

    fetchOrders();
  }, [navigate]);

  const formatStatus = (status: string) => {
    return status.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("delivered") || s.includes("closed")) return "text-green-700 bg-green-100 border-green-200";
    if (s.includes("cancelled")) return "text-red-700 bg-red-100 border-red-200";
    if (s.includes("dispatch") || s.includes("transit")) return "text-blue-700 bg-blue-100 border-blue-200";
    return "text-amber-700 bg-amber-50 border-amber-200";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-display-h2 text-foreground">Order History</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Track your wholesale shipments</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center flex flex-col items-center justify-center shadow-sm">
            <Package size={48} className="text-muted-foreground/50 mb-4" />
            <h3 className="text-ui-h4 text-foreground mb-2">No orders found</h3>
            <p className="text-body-p2 text-muted-foreground mb-6">You haven't placed any wholesale orders yet.</p>
            <button
              onClick={() => navigate("/catalogue")}
              className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm"
            >
              Browse Catalogue
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const totalPacks = order.order_items?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
              const statusColor = getStatusColor(order.status);

              return (
                <div
                  key={order.id}
                  className="p-5 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          Order #{order.id.slice(0, 8)}
                        </span>
                      </div>
                      <p className="text-ui-label text-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider border ${statusColor}`}
                    >
                      {formatStatus(order.status)}
                    </span>
                  </div>

                  <div className="bg-muted/30 rounded-xl p-4 mb-4">
                    <p className="text-sm text-foreground font-medium mb-1">{totalPacks} Packs Total</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {order.order_items
                        ?.map((item) => item.product?.name)
                        .filter(Boolean)
                        .join(", ") || "Mixed Sweets"}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Order Value</p>
                      <p className="text-lg font-bold text-foreground">
                        ₹{order.sales_order_value?.toLocaleString("en-IN")}
                      </p>
                    </div>

                    {/* Optional: Add Support/Claim hook here later if needed */}
                    {order.status === "delivered" && (
                      <button className="text-xs font-semibold text-primary underline underline-offset-2">
                        Report Issue
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNavBar />
    </div>
  );
};

export default Orders;
