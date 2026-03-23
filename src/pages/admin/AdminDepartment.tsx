import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Monitor, AlertCircle, ArrowRightLeft, Package } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

interface TVOrder {
  id: string;
  status: string;
  created_at: string | null;
  order_items?: { id: string; quantity: number; product?: { name: string; category?: string } | null }[];
}

const DEPARTMENTS = ["Baklawa", "Chocolate", "Laddu", "Bakery", "Hampers"];

const AdminDepartment = () => {
  const [orders, setOrders] = useState<TVOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState("Baklawa");
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live Clock Updater
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, created_at, order_items(id, quantity, product:products(name, category))")
      .in("status", ["verified_advance", "in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (!error) {
      setOrders((data as unknown as TVOrder[]) ?? []);
    }
    setLoading(false);
  };

  // Auto-refresh the TV every 15 seconds
  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter orders based on the active department tab
  // (In a real scenario, you filter by the product's category matching the activeDept)
  const filteredOrders = orders.filter((order) => {
    // Show order if it has ANY item matching the current department
    // For this mockup, if no category is defined, we'll just show it to populate the screen
    return order.order_items?.some((item) => !item.product?.category || item.product.category === activeDept) || true; // Remove '|| true' when your DB has exact categories
  });

  // Map to the 3 Priority Rows
  const priority1Live = filteredOrders.filter((o) => o.status === "in_production");
  const priority2Assembly = filteredOrders.filter((o) => o.status === "assembly");
  const priority3Standby = filteredOrders.filter((o) => o.status === "verified_advance");

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B101E]">
        <Loader2 className="w-12 h-12 text-slate-500 animate-spin" />
      </div>
    );

  return (
    <div className="bg-[#0B101E] min-h-screen text-white font-sans overflow-y-auto">
      <TopNavBar />

      <div className="max-w-7xl mx-auto px-6 pt-24 pb-12">
        {/* HEADER & DEPARTMENT TABS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#C4A052]/20 rounded-2xl flex items-center justify-center border border-[#C4A052]/30 shrink-0">
              <Monitor size={32} className="text-[#C4A052]" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold tracking-wide text-white">FLOOR TV KIOSK</h1>
              <p className="text-slate-400 font-medium">
                Live priority queue •{" "}
                {currentTime.toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all ${activeDept === dept ? "bg-white text-[#0B101E] shadow-lg" : "bg-[#161D2F] text-slate-300 hover:bg-[#1E273C] border border-white/5"}`}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          {/* PRIORITY 1: LIVE ORDERS */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <AlertCircle size={22} className="text-red-500" />
              <h2 className="text-xl font-black tracking-widest uppercase text-white">PRIORITY 1: LIVE ORDERS</h2>
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-0.5 rounded-full text-sm font-bold ml-2">
                {priority1Live.length} items
              </span>
            </div>

            <div className="bg-[#161D2F] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              {priority1Live.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold">No live customer orders pending.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {priority1Live.map((order) => (
                    <div key={order.id} className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                      <div className="w-48 shrink-0">
                        <p className="text-xs font-black tracking-widest text-slate-500 uppercase mb-1">Order ID</p>
                        <p className="text-xl font-mono font-bold text-white">{order.id.split("-")[0].toUpperCase()}</p>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {order.order_items?.map((item) => (
                          <div
                            key={item.id}
                            className="bg-[#0B101E] rounded-xl p-3 flex justify-between items-center border border-white/5"
                          >
                            <span className="font-bold text-slate-300 truncate pr-3">{item.product?.name}</span>
                            <span className="text-xl font-black text-white bg-white/10 px-3 py-1 rounded-lg">
                              {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* PRIORITY 2: ASSEMBLY AUTH */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <ArrowRightLeft size={22} className="text-[#C4A052]" />
              <h2 className="text-xl font-black tracking-widest uppercase text-white">PRIORITY 2: ASSEMBLY AUTH</h2>
              <span className="bg-[#C4A052]/20 text-[#C4A052] border border-[#C4A052]/30 px-3 py-0.5 rounded-full text-sm font-bold ml-2">
                {priority2Assembly.length} items
              </span>
            </div>

            <div className="bg-[#161D2F] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              {priority2Assembly.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold">No internal requests.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {priority2Assembly.map((order) => (
                    <div key={order.id} className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center">
                      <div className="w-48 shrink-0">
                        <p className="text-xs font-black tracking-widest text-[#C4A052] uppercase mb-1">Batch ID</p>
                        <p className="text-xl font-mono font-bold text-white">{order.id.split("-")[0].toUpperCase()}</p>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {order.order_items?.map((item) => (
                          <div
                            key={item.id}
                            className="bg-[#0B101E] rounded-xl p-3 flex justify-between items-center border border-white/5"
                          >
                            <span className="font-bold text-slate-300 truncate pr-3">{item.product?.name}</span>
                            <span className="text-xl font-black text-[#C4A052] bg-[#C4A052]/10 px-3 py-1 rounded-lg">
                              {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* PRIORITY 3: STANDBY */}
          <section>
            <div className="flex items-center gap-3 mb-4">
              <Package size={22} className="text-emerald-500" />
              <h2 className="text-xl font-black tracking-widest uppercase text-white">PRIORITY 3: STANDBY</h2>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-0.5 rounded-full text-sm font-bold ml-2">
                {priority3Standby.length} items
              </span>
            </div>

            <div className="bg-[#161D2F] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
              {priority3Standby.length === 0 ? (
                <div className="p-8 text-center text-slate-500 font-bold">Queue is clear.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {priority3Standby.map((order) => (
                    <div
                      key={order.id}
                      className="p-5 flex flex-col md:flex-row gap-6 items-start md:items-center opacity-70"
                    >
                      <div className="w-48 shrink-0">
                        <p className="text-xs font-black tracking-widest text-emerald-500 uppercase mb-1">
                          Upcoming ID
                        </p>
                        <p className="text-xl font-mono font-bold text-slate-300">
                          {order.id.split("-")[0].toUpperCase()}
                        </p>
                      </div>
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {order.order_items?.map((item) => (
                          <div
                            key={item.id}
                            className="bg-[#0B101E] rounded-xl p-2.5 flex justify-between items-center border border-white/5"
                          >
                            <span className="text-sm font-bold text-slate-400 truncate pr-3">{item.product?.name}</span>
                            <span className="text-lg font-black text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg">
                              {item.quantity}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default AdminDepartment;
