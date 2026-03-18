import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Package, X } from "lucide-react";
import { toast } from "sonner";
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

  // Claim Modal State
  const [claimOrder, setClaimOrder] = useState<Order | null>(null);
  const [issueType, setIssueType] = useState("Damaged Goods");
  const [description, setDescription] = useState("");
  const [submittingClaim, setSubmittingClaim] = useState(false);

  useEffect(() => {
    const fetchOrders = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("orders")
        .select(`id, status, sales_order_value, created_at, order_items (quantity, product:products(name))`)
        .order("created_at", { ascending: false });

      if (!error && data) setOrders(data as unknown as Order[]);
      setLoading(false);
    };
    fetchOrders();
  }, [navigate]);

  const handleSubmitClaim = async () => {
    if (!description.trim()) {
      toast.error("Please provide a description");
      return;
    }
    setSubmittingClaim(true);

    const { error } = await supabase.from("support_tickets").insert({
      order_id: claimOrder!.id,
      issue_type: issueType,
      description: description.trim(),
      status: "open",
    });

    if (error) {
      toast.error("Failed to submit report");
    } else {
      toast.success("Issue reported. Support ticket generated.");
      setClaimOrder(null);
      setDescription("");
    }
    setSubmittingClaim(false);
  };

  const getStatusColor = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("delivered") || s.includes("closed")) return "text-green-700 bg-green-100 border-green-200";
    if (s.includes("cancelled")) return "text-red-700 bg-red-100 border-red-200";
    if (s.includes("dispatch") || s.includes("transit")) return "text-blue-700 bg-blue-100 border-blue-200";
    return "text-amber-700 bg-amber-50 border-amber-200";
  };

  if (loading)
    return (
      <div className="min-h-screen bg-background flex justify-center items-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopNavBar />
      <main className="pt-24 px-5 max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-display-h2 text-foreground">Order History</h1>
          <p className="text-body-p2 text-muted-foreground mt-1">Track your wholesale shipments</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center shadow-sm">
            <Package size={48} className="text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-ui-h4 text-foreground mb-2">No orders found</h3>
            <button
              onClick={() => navigate("/catalogue")}
              className="px-6 py-3 mt-4 rounded-xl bg-primary text-primary-foreground font-ui font-semibold text-sm"
            >
              Browse Catalogue
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const totalPacks = order.order_items?.reduce((acc, curr) => acc + (curr.quantity || 0), 0) || 0;
              return (
                <div key={order.id} className="p-5 rounded-2xl border border-border bg-card shadow-sm">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Order #{order.id.slice(0, 8)}
                      </span>
                      <p className="text-ui-label text-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider border ${getStatusColor(order.status)}`}
                    >
                      {order.status.replace(/_/g, " ")}
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
                    {/* The working Report Issue button */}
                    {order.status === "delivered" && (
                      <button
                        onClick={() => setClaimOrder(order)}
                        className="text-xs font-semibold text-primary underline underline-offset-2"
                      >
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

      {/* Support Claim Modal */}
      {claimOrder && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl border border-border">
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-ui-h4 text-foreground">Report Issue</h2>
              <button onClick={() => setClaimOrder(null)} className="text-muted-foreground hover:text-foreground">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">Order #{claimOrder.id.slice(0, 8)}</p>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Issue Type
                </label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm"
                >
                  <option>Damaged Goods</option>
                  <option>Missing Items</option>
                  <option>Quality/Staleness</option>
                  <option>Incorrect Delivery</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Please describe the exact issue with this shipment..."
                  className="w-full px-3 py-3 rounded-xl border border-border bg-background text-sm h-28 resize-none"
                />
              </div>

              <button
                onClick={handleSubmitClaim}
                disabled={submittingClaim}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-ui font-bold text-sm flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {submittingClaim ? <Loader2 size={16} className="animate-spin" /> : "Submit Support Ticket"}
              </button>
            </div>
          </div>
        </div>
      )}
      <BottomNavBar />
    </div>
  );
};

export default Orders;
