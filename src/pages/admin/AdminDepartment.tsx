import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MonitorPlay, CheckSquare, ChefHat, Clock } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

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
  orders?: {
    id: string;
    created_at: string;
    status: string;
  };
}

const AdminDepartment = () => {
  const [activeDept, setActiveDept] = useState<string>("Baklawa");
  const [items, setItems] = useState<DeptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetchDepartmentItems = async () => {
    setLoading(true);

    // CRITICAL FIX: Removed 'dispatch_date' and fixed the 'orders' join syntax
    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
        id, order_id, quantity, pack_size, carton_type, production_status,
        products ( name ),
        orders ( id, created_at, status )
      `,
      )
      .eq("department", activeDept)
      .eq("production_status", "pending");

    if (error) {
      console.error("Fetch Error:", error);
      toast.error(`Error: ${error.message}`);
    } else {
      // Filter out items where the parent order isn't active
      const validItems = (data as any[]).filter(
        (item) => item.orders?.status === "in_production" || item.orders?.status === "assembly",
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
      // 1. Mark this specific item as completed
      const { error: itemError } = await supabase
        .from("order_items")
        .update({ production_status: "completed" })
        .eq("id", itemId);

      if (itemError) throw itemError;

      toast.success("Item marked as completed!");

      // 2. Remove it from the TV screen immediately
      setItems((current) => current.filter((i) => i.id !== itemId));

      // 3. THE MAGIC: Check if the entire order is now finished
      const { data: siblingItems } = await supabase
        .from("order_items")
        .select("production_status")
        .eq("order_id", orderId);

      const isEntireOrderDone = siblingItems?.every((item) => item.production_status === "completed");

      // If every single item in this order is done, auto-push the master order to packing!
      if (isEntireOrderDone) {
        await supabase.from("orders").update({ status: "packing" }).eq("id", orderId);

        await supabase
          .from("order_status_history")
          .insert({ order_id: orderId, old_status: "in_production", new_status: "packing" });

        toast.success(`Factory Order #${orderId.split("-")[0].toUpperCase()} is fully prepped and sent to Packing!`, {
          duration: 5000,
          icon: "🎉",
        });
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

  // Group items by Order ID so the kitchen sees them organized by ticket
  const groupedItems = items.reduce(
    (acc, item) => {
      const key = item.order_id;
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, DeptItem[]>,
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <TopNavBar />

      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">
        {/* Kiosk Header & Dept Selector */}
        <div className="bg-white rounded-[2rem] p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-slate-900 text-white p-3 rounded-2xl">
              <MonitorPlay size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-slate-900">Floor Kiosk</h1>
              <p className="text-sm text-slate-500 font-medium">Live production queue</p>
            </div>
          </div>

          <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`whitespace-nowrap px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeDept === dept
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-32">
            <Loader2 size={48} className="animate-spin text-primary" />
          </div>
        ) : Object.keys(groupedItems).length === 0 ? (
          <div className="text-center py-32 bg-white rounded-[3rem] border border-dashed border-slate-200 shadow-sm">
            <ChefHat size={64} className="mx-auto text-slate-200 mb-6" />
            <h3 className="text-2xl font-display font-bold text-slate-900">Queue is clear</h3>
            <p className="text-slate-500 mt-2 text-lg">No pending items for {activeDept}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {Object.entries(groupedItems).map(([orderId, orderItems]) => {
              // Fallback to created_at since dispatch_date doesn't exist yet
              const orderDate = orderItems[0].orders?.created_at;
              const formattedDate = orderDate
                ? new Intl.DateTimeFormat("en-IN", {
                    day: "numeric",
                    month: "short",
                  }).format(new Date(orderDate))
                : "TBD";

              return (
                <div
                  key={orderId}
                  className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* Blind Order Header */}
                  <div className="bg-slate-900 px-6 py-4 flex justify-between items-center text-white">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Factory Order</p>
                      <p className="font-mono text-xl font-bold">#{orderId.split("-")[0].toUpperCase()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-widest text-slate-400 font-bold mb-1">Order Date</p>
                      <p className="font-bold flex items-center justify-end gap-1.5">
                        <Clock size={14} className="text-amber-400" /> {formattedDate}
                      </p>
                    </div>
                  </div>

                  {/* Tasks */}
                  <div className="p-4 space-y-3">
                    {orderItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100"
                      >
                        <div className="w-full sm:w-auto flex-1">
                          <h3 className="text-xl font-bold text-slate-900 mb-2">{getProductName(item)}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-primary/10 text-primary px-3 py-1 rounded-lg text-sm font-bold">
                              {item.quantity}x Units
                            </span>
                            <span className="bg-slate-200 text-slate-700 px-3 py-1 rounded-lg text-sm font-medium">
                              {item.pack_size || "Standard"}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleMarkCompleted(item.id, item.order_id)}
                          disabled={completingId === item.id}
                          className="w-full sm:w-auto active:scale-95 transition-transform flex items-center justify-center gap-2 px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-bold text-lg shadow-sm shadow-emerald-500/20 disabled:opacity-50"
                        >
                          {completingId === item.id ? (
                            <Loader2 size={24} className="animate-spin" />
                          ) : (
                            <>
                              <CheckSquare size={24} />
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
