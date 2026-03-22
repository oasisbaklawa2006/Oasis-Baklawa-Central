import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import {
  TrendingUp,
  Wallet,
  CreditCard,
  Headphones,
  ArrowUpRight,
  Phone,
  MessageCircle,
  Mail,
  ShieldCheck,
  FileText,
  Loader2,
  Package,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import TopNavBar from "@/components/TopNavBar";
import BottomNavBar from "@/components/BottomNavBar";

// Static placeholder data for the locked Analytics chart
const monthlyData = [
  { month: "Oct", value: 45 },
  { month: "Nov", value: 62 },
  { month: "Dec", value: 85 },
  { month: "Jan", value: 55 },
  { month: "Feb", value: 72 },
  { month: "Mar", value: 90 },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [lifetimeValue, setLifetimeValue] = useState(0);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      // 1. Fetch real Company Profile
      const { data: userData } = await supabase
        .from("users")
        .select("*, company:companies(*)")
        .eq("id", session.user.id)
        .single();

      if (userData?.company) setCompany(userData.company);

      // 2. Fetch real Orders for LTV and Recent Activity
      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, sales_order_value, created_at")
        .order("created_at", { ascending: false });

      if (orders) {
        const total = orders.reduce((sum, ord) => sum + (Number(ord.sales_order_value) || 0), 0);
        setLifetimeValue(total);
        setRecentOrders(orders.slice(0, 3)); // Get top 3 most recent
      }
      setLoading(false);
    };

    fetchDashboardData();
  }, []);

  const formatPrice = (val: number) => "₹" + Math.round(val).toLocaleString("en-IN");

  if (loading) {
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="animate-spin text-[#B8860B]" size={32} />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopNavBar />
      <div className="min-h-screen bg-slate-50 px-5 pt-24 pb-32 max-w-3xl mx-auto space-y-6">
        {/* ── Dynamic Header ── */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Welcome Back</p>
          <h1 className="font-display text-3xl font-bold text-slate-900 leading-tight">
            {company?.business_name || "Partner"}
          </h1>
          <div className="flex items-center gap-3 mt-3">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider border border-emerald-200 shadow-sm">
              <ShieldCheck size={12} /> Verified
            </span>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              GST: <span className="text-slate-600">{company?.gst_number || "Pending"}</span>
            </span>
          </div>
        </motion.div>

        {/* ── Hero Metrics Grid ── */}
        <div className="grid grid-cols-3 gap-3">
          {/* Live Data Card - The "Black Card" Look */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-slate-900 rounded-[1.25rem] shadow-xl p-4 flex flex-col justify-between border border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-20">
              <TrendingUp size={40} className="text-[#B8860B]" />
            </div>
            <div className="relative z-10 mb-2">
              <div className="w-7 h-7 bg-[#B8860B]/20 rounded-full flex items-center justify-center mb-2">
                <TrendingUp size={14} className="text-[#B8860B]" />
              </div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Value</p>
            </div>
            <p className="font-black text-white text-[15px] relative z-10">{formatPrice(lifetimeValue)}</p>
          </motion.div>

          {/* Locked Features */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white rounded-[1.25rem] shadow-sm border border-slate-100 p-4 flex flex-col justify-between relative opacity-70"
          >
            <div className="absolute top-2 right-2 text-[8px] uppercase tracking-widest font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
              Soon
            </div>
            <div className="mb-2">
              <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center mb-2 border border-slate-100">
                <Wallet size={14} className="text-slate-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wallet</p>
            </div>
            <p className="font-black text-slate-300 text-[15px]">₹0</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-[1.25rem] shadow-sm border border-slate-100 p-4 flex flex-col justify-between relative opacity-70"
          >
            <div className="absolute top-2 right-2 text-[8px] uppercase tracking-widest font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">
              Soon
            </div>
            <div className="mb-2">
              <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center mb-2 border border-slate-100">
                <CreditCard size={14} className="text-slate-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Credit</p>
            </div>
            <p className="font-black text-slate-300 text-[15px]">0%</p>
          </motion.div>
        </div>

        {/* ── Monthly Order Volume (Locked Analytics) ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 space-y-4 relative overflow-hidden"
        >
          {/* Frosted Glass Overlay */}
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center">
            <div className="bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-bold shadow-xl flex items-center gap-2">
              <Lock size={14} className="text-[#B8860B]" /> Analytics Unlocking Soon
            </div>
          </div>

          <h2 className="font-display text-sm font-bold text-slate-900">Monthly Volume</h2>
          <div className="flex items-end gap-2 h-24">
            {monthlyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                <div className="w-full rounded-t-md bg-slate-100 relative overflow-hidden h-full flex items-end">
                  <div style={{ height: `${d.value}%` }} className="w-full bg-slate-200 rounded-t-md" />
                </div>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{d.month}</span>
              </div>
            ))}
          </div>
        </motion.section>

        {/* ── Recent Orders ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5"
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-sm font-bold text-slate-900">Recent Orders</h2>
            <button
              onClick={() => navigate("/orders")}
              className="text-[10px] font-bold text-[#B8860B] uppercase tracking-widest hover:underline"
            >
              View All
            </button>
          </div>

          {recentOrders.length === 0 ? (
            <div className="py-6 text-center border-2 border-dashed border-slate-100 rounded-2xl">
              <Package size={24} className="text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500 font-medium">No orders found.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentOrders.map((order, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 group cursor-pointer"
                  onClick={() => navigate("/orders")}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-[#B8860B]/10 group-hover:text-[#B8860B] transition-colors">
                      <FileText size={16} />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 uppercase">ORD-{order.id.split("-")[0]}</p>
                      <p className="text-[10px] font-bold text-slate-400 capitalize mt-0.5">
                        {order.status.replace("_", " ")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-slate-900">{formatPrice(order.sales_order_value)}</p>
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                      {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* ── Dedicated VIP Support ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-slate-900 rounded-3xl shadow-xl p-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 opacity-10 pointer-events-none -mt-4 -mr-4">
            <Headphones size={120} />
          </div>

          <h2 className="font-display text-lg font-bold text-white mb-1 relative z-10">VIP Concierge</h2>
          <p className="text-[11px] text-slate-400 mb-5 relative z-10">
            Direct lines to your dedicated account manager.
          </p>

          <div className="space-y-3 relative z-10">
            <a
              href="https://wa.me/919891162212"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-3 p-3 bg-white/10 rounded-2xl hover:bg-white/20 transition-colors backdrop-blur-sm border border-white/5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#25D366] flex items-center justify-center text-white shadow-lg shadow-[#25D366]/20">
                <MessageCircle size={18} />
              </div>
              <div className="flex-1">
                <p className="text-xs font-bold text-white">WhatsApp Fast-Track</p>
                <p className="text-[10px] text-slate-400">+91 98911 62212</p>
              </div>
              <ArrowUpRight size={16} className="text-slate-400" />
            </a>

            <div className="grid grid-cols-2 gap-3">
              <a
                href="tel:+919999792959"
                className="flex flex-col gap-2 p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5 items-center justify-center text-center"
              >
                <Phone size={18} className="text-[#B8860B]" />
                <div>
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider">Call Desk</p>
                </div>
              </a>
              <a
                href="mailto:info@oasisbaklawa.com"
                className="flex flex-col gap-2 p-3 bg-white/5 rounded-2xl hover:bg-white/10 transition-colors border border-white/5 items-center justify-center text-center"
              >
                <Mail size={18} className="text-[#B8860B]" />
                <div>
                  <p className="text-[10px] font-bold text-white uppercase tracking-wider">Email Us</p>
                </div>
              </a>
            </div>
          </div>
        </motion.section>
      </div>
      <BottomNavBar />
    </AppShell>
  );
};

export default Dashboard;
