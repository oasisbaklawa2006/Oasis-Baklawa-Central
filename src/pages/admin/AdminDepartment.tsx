import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MonitorPlay, CheckSquare, ChefHat, Clock } from "lucide-react";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers", "Packaging Store"];

interface DeptItem {
  id: string;
  order_id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  production_status: string | null;
  products?: { name: string } | null;
  product?: { name: string } | null;
  order?: {
    id: string;
    dispatch_date: string | null;
    created_at: string;
    status: string;
  };
}

const AdminDepartment = () => {
  const [activeDept, setActiveDept] = useState("Baklawa");
  const [items, setItems] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchDepartmentItems = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("order_items")
      .select(`
        id, order_id, quantity, pack_size, carton_type, production_status,
        products ( name ),
        order:orders ( id, dispatch_date, created_at, status )
      `)
      .eq("department", activeDept)
      .eq("production_status", "pending");

    if (error) {
      console.error("Fetch Error:", error);
      toast.error("Failed to load department tasks.");
    } else {
      const validItems = (data as any[]).filter(
        (item) => item.order?.status === "in_production" || item.order?.status === "assembly"
      );
      setItems(validItems);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartmentItems();
  }, [activeDept]);

  const handleMarkCompleted = async (itemId: string, orderId: string) => {
    setCompletingId(itemId);

    try {
      const { error: itemError } = await supabase
        .from("order_items")
        .update({ production_status: "completed" })
        .eq("id", itemId);

      if (itemError) throw itemError;

      toast.success("Item marked as completed!");
      setItems((current) => current.filter((i) => i.id !== itemId));

      const { data: siblingItems } = await supabase
        .from("order_items")
        .select("production_status")
        .eq("order_id", orderId);

      const isEntireOrderDone = siblingItems?.every(
        (item) => item.production_status === "completed"
      );

      if (isEntireOrderDone) {
        await supabase
          .from("orders")
          .update({ status: "packing" })
          .eq("id", orderId);

        await supabase
          .from("order_status_history")
          .insert({ order_id: orderId, old_status: "in_production", new_status: "packing" });

        toast.success(
          `Factory Order #${orderId.split("-")[0].toUpperCase()} is fully prepped and sent to Packing!`,
          { duration: 5000, icon: "🎉" }
        );
      }
    } catch (error) {
      console.error("Completion Error:", error);
      toast.error("Failed to update status.");
    } finally {
      setCompletingId(null);
    }
  };

  const getProductName = (item: any) => {
    if (item.products?.name) return item.products.name;
    if (item.product?.name) return item.product.name;
    return "Unknown Item";
  };

  const groupedItems = items.reduce((acc, item) => {
    const key = item.order_id;
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {} as Record<string, DeptItem[]>);

  return (
    <div className="min-h-screen bg-background pb-20">
      <main className="pt-6 px-5 max-w-5xl mx-auto space-y-8">
        {/* Kiosk Header & Dept Selector */}
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MonitorPlay size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Floor Kiosk</h1>
              <p className="text-sm text-muted-foreground">Live production queue</p>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`whitespace-nowrap px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeDept === dept
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <ChefHat size={40} className="mx-auto text-muted-foreground/40" />
            <p className="text-lg font-semibold text-foreground">Queue is clear</p>
            <p className="text-sm text-muted-foreground">
              No pending items for {activeDept}.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedItems).map(([orderId, orderItems]) => {
              const dispatchDate =
                orderItems[0].order?.dispatch_date || orderItems[0].order?.created_at;
              const formattedDate = new Intl.DateTimeFormat("en-IN", {
                day: "numeric",
                month: "short",
              }).format(new Date(dispatchDate!));

              return (
                <div
                  key={orderId}
                  className="bg-card border border-border rounded-xl overflow-hidden"
                  style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
                >
                  {/* Blind Order Header */}
                  <div className="p-4 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Factory Order</p>
                      <p className="text-lg font-bold text-foreground">
                        #{orderId.split("-")[0].toUpperCase()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Dispatch</p>
                      <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
                        <Clock size={12} /> {formattedDate}
                      </p>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="divide-y divide-border">
                    {orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="p-4 flex flex-col sm:flex-row sm:items-center gap-4"
                      >
                        <div className="flex-1">
                          <p className="font-bold text-lg text-foreground">
                            {getProductName(item)}
                          </p>
                          <div className="flex gap-3 mt-1 text-sm text-muted-foreground">
                            <span className="bg-muted px-2 py-0.5 rounded font-medium">
                              {item.quantity}x Units
                            </span>
                            <span className="bg-muted px-2 py-0.5 rounded font-medium">
                              {item.pack_size || "Standard"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleMarkCompleted(item.id, item.order_id)}
                          disabled={completingId === item.id}
                          className="w-full sm:w-auto active:scale-95 transition-transform flex items-center justify-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold text-lg shadow-sm disabled:opacity-50"
                        >
                          {completingId === item.id ? (
                            <Loader2 size={20} className="animate-spin" />
                          ) : (
                            <>
                              <CheckSquare size={20} />
                              COMPLETE
                            </>
                          )}
                        </button>
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

export default AdminDepartment;
