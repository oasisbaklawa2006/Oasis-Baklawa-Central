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
  Lock,
  CheckCircle2,
  Clock,
  ChefHat,
  Truck,
  Download,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import TopNavBar from "@/components/TopNavBar";
import BottomNavBar from "@/components/BottomNavBar";

const Dashboard = () => {
  const navigate = useNavigate();
  const [company, setCompany] = useState<any>(null);
  const [lifetimeValue, setLifetimeValue] = useState(0);
  const [activeOrder, setActiveOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { data: userData } = await supabase
        .from("users")
        .select("*, company:companies(*)")
        .eq("id", session.user.id)
        .single();
      if (userData?.company) setCompany(userData.company);

      const { data: orders } = await supabase
        .from("orders")
        .select("id, status, payment_status, sales_order_value, created_at")
        .order("created_at", { ascending: false });

      if (orders && orders.length > 0) {
        setLifetimeValue(orders.reduce((sum, ord) => sum + (Number(ord.sales_order_value) || 0), 0));
        // Find the most recent order that is NOT delivered or cancelled to act as the "Live" order
        const live = orders.find((o) => o.status !== "delivered" && o.status !== "cancelled");
        if (live) setActiveOrder(live);
      }
      setLoading(false);
    };
    fetchDashboardData();
  }, []);

  const formatPrice = (val: number) => "₹" + Math.round(val).toLocaleString("en-IN");

  // Helper to determine the active step in the timeline
  const getStepStatus = (order: any) => {
    const s = order.status;
    const p = order.payment_status;

    let currentStep = 1;
    if (p === "pending_verification" || p === "verified") currentStep = 2;
    if (s === "in_kitchen" || s === "processing") currentStep = 3;
    if (s === "dispatched" || s === "transit") currentStep = 4;
    if (s === "delivered") currentStep = 5;

    return currentStep;
  };

  if (loading)
    return (
      <AppShell>
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <Loader2 className="animate-spin text-[#B8860B]" size={32} />
        </div>
      </AppShell>
    );

  const step = activeOrder ? getStepStatus(activeOrder) : 0;

  return (
    <AppShell>
      <TopNavBar />
      <div className="min-h-screen bg-slate-50 px-5 pt-24 pb-32 max-w-3xl mx-auto space-y-6">
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

        {/* ── ACTION REQUIRED ALERT ── */}
        {activeOrder && activeOrder.payment_status === "awaiting_utr" && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                <Clock size={20} />
              </div>
              <div>
                <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">Action Required</p>
                <p className="text-[11px] text-amber-700 font-medium">
                  Upload UTR for ORD-{activeOrder.id.split("-")[0]}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate("/orders")}
              className="bg-amber-600 text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm hover:bg-amber-700"
            >
              Upload
            </button>
          </motion.div>
        )}

        {/* ── LIVE SHIPMENT TRACKER ── */}
        {activeOrder && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5 overflow-hidden relative"
          >
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-display text-sm font-bold text-slate-900">Live Shipment Tracker</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                  ORD-{activeOrder.id.split("-")[0]}
                </p>
              </div>
              <button
                onClick={() => navigate("/orders")}
                className="text-[10px] font-bold text-[#B8860B] bg-[#B8860B]/10 px-3 py-1.5 rounded-lg uppercase tracking-widest hover:bg-[#B8860B]/20 transition-colors"
              >
                Details
              </button>
            </div>

            {/* Visual Timeline Engine */}
            <div className="relative flex justify-between items-center mb-2 px-2">
              {/* Background Line */}
              <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-1 bg-slate-100 rounded-full z-0" />
              {/* Active Line Fill */}
              <div
                className="absolute left-6 top-1/2 -translate-y-1/2 h-1 bg-[#B8860B] rounded-full z-0 transition-all duration-1000"
                style={{ width: `${(Math.min(step, 4) - 1) * 33.33}%` }}
              />

              {/* Step 1: Placed */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 1 ? "bg-[#B8860B] border-[#B8860B] text-white shadow-md" : "bg-white border-slate-200 text-slate-300"}`}
                >
                  <FileText size={14} />
                </div>
              </div>
              {/* Step 2: Payment */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 2 ? "bg-[#B8860B] border-[#B8860B] text-white shadow-md" : "bg-white border-slate-200 text-slate-300"}`}
                >
                  <Wallet size={14} />
                </div>
              </div>
              {/* Step 3: Kitchen */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 3 ? "bg-[#B8860B] border-[#B8860B] text-white shadow-md" : "bg-white border-slate-200 text-slate-300"}`}
                >
                  <ChefHat size={14} />
                </div>
              </div>
              {/* Step 4: Dispatched */}
              <div className="relative z-10 flex flex-col items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors ${step >= 4 ? "bg-[#B8860B] border-[#B8860B] text-white shadow-md" : "bg-white border-slate-200 text-slate-300"}`}
                >
                  <Truck size={14} />
                </div>
              </div>
            </div>

            {/* Timeline Labels */}
            <div className="flex justify-between items-start px-1 mt-2">
              <div className="text-center w-12">
                <p
                  className={`text-[9px] font-bold uppercase tracking-wider ${step >= 1 ? "text-slate-800" : "text-slate-400"}`}
                >
                  Placed
                </p>
              </div>
              <div className="text-center w-12">
                <p
                  className={`text-[9px] font-bold uppercase tracking-wider ${step >= 2 ? "text-slate-800" : "text-slate-400"}`}
                >
                  Paid
                </p>
              </div>
              <div className="text-center w-12">
                <p
                  className={`text-[9px] font-bold uppercase tracking-wider ${step >= 3 ? "text-slate-800" : "text-slate-400"}`}
                >
                  Kitchen
                </p>
              </div>
              <div className="text-center w-12">
                <p
                  className={`text-[9px] font-bold uppercase tracking-wider ${step >= 4 ? "text-slate-800" : "text-slate-400"}`}
                >
                  Transit
                </p>
              </div>
            </div>
          </motion.section>
        )}

        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
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
                <Wallet size={14} className="text-slate-400" />
              </div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Wallet</p>
            </div>
            <p className="font-black text-slate-300 text-[15px]">₹0</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
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

        {/* ── BUSINESS RESOURCES (NEW B2B FEATURE) ── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-3xl shadow-sm border border-slate-100 p-5"
        >
          <h2 className="font-display text-sm font-bold text-slate-900 mb-4">Business Resources</h2>
          <div className="space-y-2.5">
            <button className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-[#B8860B]/30 hover:bg-[#B8860B]/5 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:text-[#B8860B] transition-colors">
                  <FileText size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900">Wholesale Price List</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">PDF • 2.4 MB</p>
                </div>
              </div>
              <Download size={16} className="text-slate-400 group-hover:text-[#B8860B]" />
            </button>
            <button className="w-full flex items-center justify-between p-3 rounded-2xl border border-slate-100 hover:border-[#B8860B]/30 hover:bg-[#B8860B]/5 transition-all group">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-slate-500 group-hover:text-[#B8860B] transition-colors">
                  <ShieldCheck size={16} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-slate-900">FSSAI & Compliance Certs</p>
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">ZIP • 1.1 MB</p>
                </div>
              </div>
              <Download size={16} className="text-slate-400 group-hover:text-[#B8860B]" />
            </button>
          </div>
        </motion.section>

        {/* ── VIP CONCIERGE ── */}
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
