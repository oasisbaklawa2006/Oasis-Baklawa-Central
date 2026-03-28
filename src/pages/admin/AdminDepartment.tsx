import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Monitor, AlertTriangle, Package, Activity } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import { motion } from "framer-motion";

const DEPARTMENTS = [
  "arabic_sweets",
  "dragees",
  "fusion_sweets",
  "chocolate",
  "bakery",
  "nuts_mixes",
];

const DEPT_LABELS: Record<string, string> = {
  arabic_sweets: "Arabic Sweets",
  dragees: "Dragées",
  fusion_sweets: "Fusion Sweets",
  chocolate: "Chocolate",
  bakery: "Bakery",
  nuts_mixes: "Nuts & Mixes",
};

interface RequisitionItem {
  id: string;
  product_id: string;
  requested_qty: number;
  fulfilled_qty: number | null;
  product?: { name: string; department: string | null; production_department: string | null } | null;
}

interface Requisition {
  id: string;
  order_id: string;
  target_store: string;
  status: string | null;
  created_at: string | null;
  notes: string | null;
  items: RequisitionItem[];
}

function getAgeHours(created_at: string | null): number {
  if (!created_at) return 0;
  return (Date.now() - new Date(created_at).getTime()) / (1000 * 60 * 60);
}

const AdminDepartment = () => {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeDept, setActiveDept] = useState("arabic_sweets");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayProduced, setTodayProduced] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchData = async () => {
    // Fetch pending requisitions with items and product info
    const { data: reqs } = await supabase
      .from("store_requisitions")
      .select("id, order_id, target_store, status, created_at, notes, store_requisition_items(id, product_id, requested_qty, fulfilled_qty, product:products(name, department, production_department))")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (reqs) {
      const mapped: Requisition[] = (reqs as any[]).map((r) => ({
        id: r.id,
        order_id: r.order_id,
        target_store: r.target_store,
        status: r.status,
        created_at: r.created_at,
        notes: r.notes,
        items: (r.store_requisition_items || []).map((i: any) => ({
          id: i.id,
          product_id: i.product_id,
          requested_qty: i.requested_qty,
          fulfilled_qty: i.fulfilled_qty,
          product: i.product,
        })),
      }));
      setRequisitions(mapped);
    }

    // Fetch today's production total
    const today = new Date().toISOString().split("T")[0];
    const { data: logs } = await supabase
      .from("daily_production_logs")
      .select("produced_qty")
      .eq("log_date", today);

    if (logs) {
      setTodayProduced(logs.reduce((sum, l) => sum + (l.produced_qty || 0), 0));
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  // Filter requisitions by department — match product's department or production_department
  const filteredReqs = useMemo(() => {
    return requisitions.filter((r) =>
      r.items.some(
        (i) =>
          i.product?.department === activeDept ||
          i.product?.production_department === activeDept
      )
    );
  }, [requisitions, activeDept]);

  // Split: URGENT = linked to sales orders (target_store typically != 'stock'), STANDBY = production for stock
  const urgentReqs = filteredReqs.filter((r) => r.target_store !== "stock");
  const standbyReqs = filteredReqs.filter((r) => r.target_store === "stock");

  const DAILY_TARGET = 5000;

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center bg-[#0B101E]">
        <Loader2 className="w-12 h-12 text-slate-500 animate-spin" />
      </div>
    );

  return (
    <div className="bg-[#0B101E] min-h-screen text-white font-sans overflow-hidden flex flex-col">
      <TopNavBar />

      <div className="flex-1 flex flex-col px-6 pt-24 pb-4 overflow-hidden">
        {/* HEADER & DEPARTMENT TABS */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-[#C4A052]/20 rounded-2xl flex items-center justify-center border border-[#C4A052]/30 shrink-0">
              <Monitor size={32} className="text-[#C4A052]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-wide text-white">FACTORY FLOOR — LIVE</h1>
              <p className="text-slate-400 font-medium">
                Department Queue •{" "}
                {currentTime.toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit", second: "2-digit" })}
              </p>
            </div>
          </div>

          <div className="flex overflow-x-auto gap-3 pb-2 scrollbar-hide">
            {DEPARTMENTS.map((dept) => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`px-6 py-3 rounded-xl font-bold whitespace-nowrap transition-all text-lg ${
                  activeDept === dept
                    ? "bg-white text-[#0B101E] shadow-lg"
                    : "bg-[#161D2F] text-slate-300 hover:bg-[#1E273C] border border-white/5"
                }`}
              >
                {DEPT_LABELS[dept] || dept}
              </button>
            ))}
          </div>
        </div>

        {/* TWO COLUMN LAYOUT */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto min-h-0">
          {/* URGENT REQUIREMENTS */}
          <section className="flex flex-col min-h-0">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <AlertTriangle size={26} className="text-red-500" />
              <h2 className="text-2xl font-black tracking-widest uppercase text-white">URGENT REQUIREMENTS</h2>
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-3 py-1 rounded-full text-base font-bold ml-2">
                {urgentReqs.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {urgentReqs.length === 0 ? (
                <div className="bg-[#161D2F] border border-white/5 rounded-2xl p-10 text-center text-slate-500 font-bold text-xl">
                  No urgent requirements.
                </div>
              ) : (
                urgentReqs.map((req) => <RequisitionCard key={req.id} req={req} />)
              )}
            </div>
          </section>

          {/* STANDBY LOG */}
          <section className="flex flex-col min-h-0">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <Package size={26} className="text-emerald-500" />
              <h2 className="text-2xl font-black tracking-widest uppercase text-white">STANDBY LOG</h2>
              <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full text-base font-bold ml-2">
                {standbyReqs.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {standbyReqs.length === 0 ? (
                <div className="bg-[#161D2F] border border-white/5 rounded-2xl p-10 text-center text-slate-500 font-bold text-xl">
                  No standby production tasks.
                </div>
              ) : (
                standbyReqs.map((req) => <RequisitionCard key={req.id} req={req} />)
              )}
            </div>
          </section>
        </div>

        {/* PRODUCTION TICKER */}
        <div className="shrink-0 mt-4">
          <div className="bg-[#161D2F] border border-white/5 rounded-2xl overflow-hidden">
            <motion.div
              className="flex items-center gap-8 px-6 py-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <Activity size={28} className="text-[#C4A052] shrink-0" />
              <div className="flex items-center gap-6 overflow-hidden">
                <TickerItem label="PRODUCED TODAY" value={todayProduced} color={todayProduced >= DAILY_TARGET ? "text-emerald-400" : "text-[#C4A052]"} />
                <span className="text-slate-600 text-3xl font-thin">/</span>
                <TickerItem label="DAILY TARGET" value={DAILY_TARGET} color="text-slate-300" />
                <span className="text-slate-600 text-3xl font-thin">•</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-black tracking-widest text-slate-500 uppercase">Progress</span>
                  <div className="w-48 h-4 bg-[#0B101E] rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      className={`h-full rounded-full ${todayProduced >= DAILY_TARGET ? "bg-emerald-500" : "bg-[#C4A052]"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min((todayProduced / DAILY_TARGET) * 100, 100)}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                    />
                  </div>
                  <span className="text-xl font-black text-white">{Math.round((todayProduced / DAILY_TARGET) * 100)}%</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Sub-Components ── */

function RequisitionCard({ req }: { req: Requisition }) {
  const ageHours = getAgeHours(req.created_at);
  const isOverdue = ageHours > 4;

  const borderClass = isOverdue
    ? "border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
    : "border-emerald-500/40";

  const ageLabel = ageHours < 1
    ? `${Math.round(ageHours * 60)}m ago`
    : `${Math.round(ageHours)}h ago`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`bg-[#161D2F] border-2 rounded-2xl overflow-hidden ${borderClass} ${isOverdue ? "animate-pulse" : ""}`}
    >
      <div className="p-5">
        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-xs font-black tracking-widest text-slate-500 uppercase mb-1">Requisition</p>
            <p className="text-2xl font-mono font-bold text-white">{req.id.split("-")[0].toUpperCase()}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-black tracking-widest text-slate-500 uppercase mb-1">Store</p>
            <p className="text-lg font-bold text-[#C4A052]">{req.target_store}</p>
          </div>
          <div className={`px-4 py-2 rounded-xl font-black text-lg ${isOverdue ? "bg-red-500/20 text-red-400" : "bg-emerald-500/20 text-emerald-400"}`}>
            {ageLabel}
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {req.items.map((item) => (
            <div
              key={item.id}
              className="bg-[#0B101E] rounded-xl p-3 flex justify-between items-center border border-white/5"
            >
              <span className="font-bold text-slate-300 truncate pr-3 text-lg">{item.product?.name || "Unknown"}</span>
              <span className={`text-2xl font-black px-4 py-1 rounded-lg ${isOverdue ? "text-red-400 bg-red-500/10" : "text-emerald-400 bg-emerald-500/10"}`}>
                {item.requested_qty}
              </span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

function TickerItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-black tracking-widest text-slate-500 uppercase">{label}</span>
      <span className={`text-3xl font-black ${color}`}>{value.toLocaleString()}</span>
    </div>
  );
}

export default AdminDepartment;
