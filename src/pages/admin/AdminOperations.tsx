import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings2, Calendar, LayoutGrid, CheckCircle2 } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers", "Packaging Store"];

interface OpsOrderItem {
  id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  department: string | null;
  production_status: string | null;
  products?: { name: string } | null;
  product?: { name: string } | null;
}

interface OpsOrder {
  id: string;
  status: string;
  created_at: string;
  dispatch_date?: string | null;
  order_items?: OpsOrderItem[];
}

const AdminOperations = () => {
  const [orders, setOrders] = useState<OpsOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOpsOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(`
        id, status, created_at,
        order_items (
          id, quantity, pack_size, carton_type, department, production_status,
          products ( name )
        )
      `)
      .eq("status", "in_production")
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Ops Fetch Error:", error);
      toast.error("Failed to load operations data.");
    } else {
      setOrders((data as any[]) || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOpsOrders();
  }, []);

  const handleAssignDepartment = async (itemId: string, department: string) => {
    const { error } = await supabase
      .from("order_items")
      .update({
        department: department,
        production_status: "pending",
      })
      .eq("id", itemId);

    if (error) {
      toast.error("Failed to assign department");
    } else {
      toast.success(`Item routed to ${department}`);
      setOrders((currentOrders) =>
        currentOrders.map((order) => ({
          ...order,
          order_items: order.order_items?.map((item) =>
            item.id === itemId ? { ...item, department, production_status: "pending" } : item
          ),
        }))
      );
    }
  };

  const getProductName = (item: OpsOrderItem) => {
    if (item.products?.name) return item.products.name;
    if (item.product?.name) return item.product.name;
    return "Unknown Item";
  };

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(dateString));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <main className="pt-24 px-5 max-w-5xl mx-auto space-y-8">
        {/* Header Section */}
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
            <Settings2 size={16} />
            Operations Head
          </div>
          <h1 className="text-2xl font-bold text-foreground">Material Routing</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Assign items to factory departments. Client details are hidden.
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <LayoutGrid size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground">No active operations</p>
            <p className="text-sm text-muted-foreground">
              There are currently no orders in the production queue.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map((order) => {
              const totalItems = order.order_items?.length || 0;
              const assignedItems = order.order_items?.filter((i) => i.department).length || 0;
              const isFullyRouted = totalItems > 0 && assignedItems === totalItems;

              return (
                <div
                  key={order.id}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                  style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                >
                  {/* Order Header */}
                  <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Factory Order ID</p>
                      <p className="text-lg font-bold text-foreground">
                        #{order.id.split("-")[0].toUpperCase()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar size={12} />
                        Dispatch: {formatDate(order.dispatch_date || order.created_at)}
                      </span>
                      {isFullyRouted && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                          <CheckCircle2 size={14} /> Fully Routed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Items Routing List */}
                  <div className="divide-y divide-border">
                    {order.order_items?.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                      >
                        {/* Item Details */}
                        <div className="flex-1">
                          <p className="font-semibold text-foreground">{getProductName(item)}</p>
                          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                            <span>Qty: {item.quantity}</span>
                            <span>Pack: {item.pack_size || "Standard"}</span>
                            <span>Carton: {item.carton_type || "Standard"}</span>
                          </div>
                        </div>

                        {/* Status & Routing Dropdown */}
                        <div className="flex items-center gap-2">
                          {item.production_status === "completed" && (
                            <span className="flex items-center gap-1 text-xs font-semibold text-green-600">
                              <CheckCircle2 size={14} /> Done
                            </span>
                          )}
                          <select
                            value={item.department || ""}
                            onChange={(e) => handleAssignDepartment(item.id, e.target.value)}
                            disabled={item.production_status === "completed"}
                            className={`flex-1 sm:w-48 px-3 py-2.5 rounded-lg text-sm font-semibold border outline-none transition-colors ${
                              item.department
                                ? "bg-foreground text-background border-foreground"
                                : "bg-background text-muted-foreground border-border hover:border-primary focus:ring-2 focus:ring-primary/20"
                            }`}
                          >
                            <option value="">Route to Dept...</option>
                            {DEPARTMENTS.map((dept) => (
                              <option key={dept} value={dept}>
                                {dept}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminOperations;
