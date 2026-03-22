import AppShell from "@/components/AppShell";
import { motion } from "framer-motion";
import { TrendingUp, Wallet, CreditCard, Headphones, ArrowUpRight, Phone, MessageCircle, Mail, ShieldCheck, FileText, Loader2, Package, Lock } from "lucide-react";
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
      const { data: { session } } = await supabase.auth.getSession();
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
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-slate-900 rounded-[1.25rem] shadow-xl p-4 flex flex-col justify-between border border-white/10 relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-20"><TrendingUp size={40} className="text-[#B8860B]" /></div>
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
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
            className="bg-white rounded-[1.25rem] shadow-sm border border-slate-100 p-4 flex flex-col justify-between relative opacity-70"
          >
            <div className="absolute top-2 right-2 text-[8px] uppercase tracking-widest font-bold bg-slate-100 px-1.5 py-0.5 rounded text-slate-400">Soon</div>
            <div className="mb-2">
              <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center mb-2 border border-slate-100">
                <Wallet size={14} className="text-slate-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wallet</p>
            </div>
            <p className="font-black text-slate-300 text-[15px]">₹0</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="bg-white rounded-[1.25rem] shadow-sm border border-slate-100 p-4 flex