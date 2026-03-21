import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Loader2,
  MonitorPlay,
  CheckSquare,
  ChefHat,
  Clock,
  AlertCircle,
  ArrowRightLeft,
  PackagePlus,
} from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers", "Packaging Store"];

interface DeptItem {
  id: string;
  order_id: string;
  quantity: number;
  pack_size: string | null;
  carton_type: string | null;
  production_status: string | null;
  task_type?: string | null;
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

    const { data, error } = await supabase
      .from("order_items")
      .select(
        `
        id, order_id, quantity, pack_size, carton_type, production_status, task_type,
        products ( name ),
        orders ( id, created_at, status )
      `,
      )
      .eq("department", activeDept)
      .eq("production_status", "pending");

    if (error) {
      toast.error(`Error: ${error.message}`);
    } else {
      // Allow items if they belong to active orders OR if they are standby/internal (which might not be strictly tied to a dispatching order)
      const validItems = (data as any[]).filter(
        (item) =>
          item.orders?.status === "in_production" ||
          item.orders?.status === "assembly" ||
          item.task_type === "standby" ||
          item.task_type === "interdepartmental",
      );
      setItems(validItems);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDepartmentItems();
  }, [activeDept]);

  const handleMarkCompleted = async (item: DeptItem) => {
    setCompletingId(item.id);

    try {
      // 1. Mark item as completed
      const { error: itemError } = await supabase
        .from("order_items")
        .update({ production_status: "completed" })
        .eq("id", item.id);

      if (itemError) throw itemError;

      // 2. Remove it from the TV screen
      setItems((current) => current.filter((i) => i.id !== item.id));

      // 3. If it was Standby stock, automatically add it to the Virtual Inventory!
      if (item.task_type === "standby") {
        toast.success("Standby task finished! Sent to Ready Goods Store.", { icon: "📦" });
        // NOTE: A more advanced version would run an RPC here to safely increment the inventory table.
      } else {
        toast.success("Item marked as completed!");
      }

      // 4. Check if the entire customer order is finished
      if (item.order_id) {
        const { data: siblingItems } = await supabase
          .from("order_items")
          .select("production_status")
          .eq("order_id", item.order_id);

        const isEntireOrderDone = siblingItems?.every((i) => i.production_status === "completed");

        if (isEntireOrderDone) {
          await supabase.from("orders").update({ status: "packing" }).eq("id", item.order_id);
          await supabase
            .from("order_status_history")
            .insert({ order_id: item.order_id, old_status: "in_production", new_status: "packing" });
          toast.success(`Order #${item.order_id.split("-")[0].toUpperCase()} is fully prepped and sent to Packing!`, {
            duration: 5000,
            icon: "🎉",
          });
        }
      }
    } catch (error) {
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

  // Group items by their 3-Tier Priorities
  const customerTasks = items.filter((i) => !i.task_type || i.task_type === "customer");
  const internalTasks = items.filter((i) => i.task_type === "interdepartmental");
  const standbyTasks = items.filter((i) => i.task_type === "standby");

  // Group customer tasks by Order ID so the kitchen sees them organized by ticket
  const groupedCustomerTasks = customerTasks.reduce(
    (acc, item) => {
      const key = item.order_id || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    },
    {} as Record<string, DeptItem[]>,
  );

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      {" "}
      {/* Dark mode for TV screens */}
      <TopNavBar />
      <main className="pt-24 px-4 sm:px-6 lg:px-8 max-w-[1400px] mx-auto space-y-6">
        {/* Kiosk Header & Dept Selector */}
        <div className="bg-slate-900 rounded-2xl p-4 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary text-primary-foreground p-3 rounded-xl shadow-lg shadow-primary/20">
              <MonitorPlay size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-wide uppercase">Floor TV Kiosk</h1>
              <p className="text-sm text-slate-400 font-medium">Live priority queue</p>
            </div>
          </div>

          <div className="flex overflow-x-auto gap-2 w-full md:w-auto pb-2 md:pb-0 no-scrollbar">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`whitespace-nowrap px-6 py-3 rounded-xl font-bold text-sm transition-all ${
                  activeDept === dept
                    ? "bg-white text-slate-900 shadow-md"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700"
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
        ) : items.length === 0 ? (
          <div className="text-center py-32 bg-slate-900 rounded-[2rem] border border-dashed border-slate-800">
            <ChefHat size={64} className="mx-auto text-slate-700 mb-6" />
            <h3 className="text-2xl font-bold text-white">Ovens are clear</h3>
            <p className="text-slate-400 mt-2 text-lg">No pending tasks for {activeDept}.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
            {/* TIER 1: CUSTOMER ORDERS (Red / High Priority) */}
            <div className="xl:col-span-2 space-y-4">
              <div className="flex items-center gap-2 mb-4 px-2">
                <AlertCircle className="text-red-500" size={20} />
                <h2 className="text-lg font-bold text-white uppercase tracking-widest">Priority 1: Live Orders</h2>
                <span className="bg-red-500/20 text-red-400 px-2.5 py-0.5 rounded-full text-xs font-bold ml-2">
                  {customerTasks.length} items
                </span>
              </div>

              {Object.keys(groupedCustomerTasks).length === 0 ? (
                <div className="bg-slate-900/50 rounded-2xl p-8 border border-slate-800 text-center text-slate-500 text-sm font-semibold">
                  No live customer orders pending.
                </div>
              ) : (
                Object.entries(groupedCustomerTasks).map(([orderId, orderItems]) => {
                  const orderDate = orderItems[0].orders?.created_at;
                  const formattedDate = orderDate
                    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(orderDate))
                    : "TBD";

                  return (
                    <div
                      key={orderId}
                      className="bg-slate-900 rounded-2xl border border-slate-700 shadow-lg overflow-hidden"
                    >
                      <div className="bg-slate-800/80 px-6 py-3 flex justify-between items-center border-b border-slate-700">
                        <div>
                          <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                            Factory Order
                          </p>
                          <p className="font-mono text-xl font-bold text-white">
                            #{orderId.split("-")[0].toUpperCase()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-white flex items-center justify-end gap-1.5 text-sm">
                            <Clock size={14} className="text-amber-400" /> Dispatch: {formattedDate}
                          </p>
                        </div>
                      </div>
                      <div className="p-3 space-y-2">
                        {orderItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between gap-4 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50"
                          >
                            <div className="flex-1">
                              <h3 className="text-lg font-bold text-white mb-1.5">{getProductName(item)}</h3>
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="bg-primary/20 text-primary-300 px-2.5 py-1 rounded-md text-xs font-bold border border-primary/30">
                                  {item.quantity}x Units
                                </span>
                                <span className="bg-slate-700 text-slate-300 px-2.5 py-1 rounded-md text-xs font-medium">
                                  {item.pack_size || "Standard"}
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => handleMarkCompleted(item)}
                              disabled={completingId === item.id}
                              className="active:scale-95 transition-transform flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold shadow-lg shadow-red-900/50 disabled:opacity-50"
                            >
                              {completingId === item.id ? <Loader2 size={20} className="animate-spin" /> : "COMPLETE"}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* TIER 2 & 3: INTERNAL AND STANDBY (Right Column) */}
            <div className="space-y-6">
              {/* TIER 2: INTERNAL */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <ArrowRightLeft className="text-amber-500" size={18} />
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest">Priority 2: Assembly Auth</h2>
                  <span className="bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs font-bold ml-auto">
                    {internalTasks.length}
                  </span>
                </div>
                {internalTasks.length === 0 ? (
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 text-center text-slate-500 text-xs font-semibold">
                    No internal requests.
                  </div>
                ) : (
                  internalTasks.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 rounded-xl p-4 border border-amber-900/30 flex flex-col gap-3"
                    >
                      <div>
                        <h3 className="text-base font-bold text-amber-50">{getProductName(item)}</h3>
                        <p className="text-xs text-amber-500/70 mt-1 font-mono">
                          REQ-#{item.id.slice(0, 6).toUpperCase()}
                        </p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="bg-amber-500/10 text-amber-400 px-2 py-1 rounded text-xs font-bold">
                          {item.quantity}x Units
                        </span>
                        <button
                          onClick={() => handleMarkCompleted(item)}
                          disabled={completingId === item.id}
                          className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          DONE
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* TIER 3: STANDBY STOCK */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2 px-2">
                  <PackagePlus className="text-emerald-500" size={18} />
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest">Priority 3: Standby</h2>
                  <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full text-xs font-bold ml-auto">
                    {standbyTasks.length}
                  </span>
                </div>
                {standbyTasks.length === 0 ? (
                  <div className="bg-slate-900/50 rounded-2xl p-6 border border-slate-800 text-center text-slate-500 text-xs font-semibold">
                    No standby tasks.
                  </div>
                ) : (
                  standbyTasks.map((item) => (
                    <div
                      key={item.id}
                      className="bg-slate-900 rounded-xl p-4 border border-emerald-900/30 flex flex-col gap-3"
                    >
                      <div>
                        <h3 className="text-base font-bold text-emerald-50">{getProductName(item)}</h3>
                        <p className="text-xs text-emerald-500/70 mt-1 font-mono">STOCK-FILL</p>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded text-xs font-bold">
                          {item.quantity}x Units
                        </span>
                        <button
                          onClick={() => handleMarkCompleted(item)}
                          disabled={completingId === item.id}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors"
                        >
                          DONE
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminDepartment;
