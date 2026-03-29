import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Loader2, ShoppingBag, FileText, Package, CreditCard, TrendingUp, Star, BarChart3 } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";
import SystemAlertMarquee from "@/components/buyer/SystemAlertMarquee";
import { useCurrency } from "@/hooks/useCurrency";

interface OverviewData {
  totalBusiness: number;
  totalOrders: number;
  walletBalance: number;
  creditBalance: number;
  mostOrdered: string | null;
}

const BuyerPortal = () => {
  const navigate = useNavigate();
  const { format } = useCurrency();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData>({
    totalBusiness: 0,
    totalOrders: 0,
    walletBalance: 0,
    creditBalance: 0,
    mostOrdered: null,
  });

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        const { data: authData } = await supabase.auth.getUser();
        const userId = authData?.user?.id;
        if (!userId) { setLoading(false); return; }

        const { data: appUser } = await supabase
          .from("users")
          .select("company_id")
          .eq("id", userId)
          .maybeSingle();

        const companyId = appUser?.company_id;
        if (!companyId) { setLoading(false); return; }

        const { data: orders } = await supabase
          .from("orders")
          .select("id, sales_order_value")
          .eq("company_id", companyId);

        const totalOrders = orders?.length ?? 0;
        const totalBusiness = orders?.reduce((s, o) => s + (o.sales_order_value ?? 0), 0) ?? 0;

        const { data: company } = await supabase
          .from("companies")
          .select("wallet_balance, current_balance")
          .eq("id", companyId)
          .maybeSingle();

        const walletBalance = company?.wallet_balance ?? 0;
        const creditBalance = company?.current_balance ?? 0;

        let mostOrdered: string | null = null;
        if (orders && orders.length > 0) {
          const orderIds = orders.map((o) => o.id);
          const { data: items } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .in("order_id", orderIds);

          if (items && items.length > 0) {
            const freq: Record<string, number> = {};
            items.forEach((i) => {
              if (i.product_id) freq[i.product_id] = (freq[i.product_id] ?? 0) + Number(i.quantity ?? 0);
            });
            const topId = Object.entries(freq).sort((a, b) => b[1] - a[1])[0]?.[0];
            if (topId) {
              const { data: prod } = await supabase
                .from("products")
                .select("name")
                .eq("id", topId)
                .maybeSingle();
              mostOrdered = prod?.name ?? null;
            }
          }
        }

        setOverview({ totalBusiness, totalOrders, walletBalance, creditBalance, mostOrdered });
      } catch (err) {
        console.error("BuyerPortal fetch error:", err);
      }
      setLoading(false);
    };
    fetchOverview();
  }, []);

  const tiles = [
    { label: "Product Catalogue", icon: Package, route: "/catalogue" },
    { label: "My Orders", icon: ShoppingBag, route: "/orders" },
    { label: "Documents", icon: FileText, route: "/documents" },
    { label: "My Account", icon: CreditCard, route: "/account" },
    { label: "Favorites", icon: Star, route: "/favorites" },
    { label: "Dashboard", icon: BarChart3, route: "/dashboard" },
  ];

  const cards = [
    { label: "Total Business", value: format(overview.totalBusiness), icon: TrendingUp, gold: true },
    { label: "Total Orders", value: String(overview.totalOrders), icon: ShoppingBag, gold: false },
    { label: "Wallet Balance", value: format(overview.walletBalance), icon: CreditCard, gold: false },
    { label: "Credit Balance", value: format(overview.creditBalance), icon: CreditCard, gold: true },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#121212]">
        <Loader2 className="animate-spin text-[#D4AF37]" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] pb-24">
      <TopNavBar />
      <SystemAlertMarquee />

      <div className="pt-20 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-white">
            Buyer Portal
          </h1>
          <p className="font-body text-[#9CA3AF] text-sm mt-1.5">Your business at a glance.</p>
        </motion.div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-[#1E1E1E] border border-white/[0.06] rounded-2xl p-6 hover:border-[#D4AF37]/20 transition-colors"
            >
              <div className="flex items-center gap-2 mb-3">
                <card.icon size={14} className="text-[#D4AF37]" />
                <span className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#9CA3AF]">
                  {card.label}
                </span>
              </div>
              <p className={`text-2xl lg:text-3xl font-bold ${card.gold ? "text-[#D4AF37]" : "text-white"}`}>
                {card.value}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Most Ordered */}
        {overview.mostOrdered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-10 bg-[#1E1E1E] border border-[#D4AF37]/20 rounded-2xl p-6 flex items-center gap-4"
          >
            <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center flex-shrink-0">
              <Star size={18} className="text-[#D4AF37] fill-[#D4AF37]" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.15em] font-semibold text-[#9CA3AF]">
                Most Ordered Product
              </p>
              <p className="font-bold text-white text-lg mt-0.5">{overview.mostOrdered}</p>
            </div>
          </motion.div>
        )}

        {/* Navigation Tiles */}
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-4">
          {tiles.map((tile, i) => (
            <motion.button
              key={tile.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => navigate(tile.route)}
              className="group flex flex-col items-center gap-3 bg-[#1E1E1E] border border-white/[0.06] rounded-2xl p-6 hover:border-[#D4AF37]/30 hover:scale-[1.03] transition-all duration-200 active:scale-95"
            >
              <div className="w-12 h-12 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center group-hover:bg-[#D4AF37]/20 transition-colors">
                <tile.icon size={22} className="text-[#D4AF37]" />
              </div>
              <span className="text-xs font-bold text-[#9CA3AF] group-hover:text-white transition-colors">
                {tile.label}
              </span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BuyerPortal;
