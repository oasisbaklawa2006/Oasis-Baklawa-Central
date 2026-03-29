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
  const { formatPrice } = useCurrency();
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

        // Total orders & business value
        const { data: orders } = await supabase
          .from("orders")
          .select("id, sales_order_value")
          .eq("company_id", companyId);

        const totalOrders = orders?.length ?? 0;
        const totalBusiness = orders?.reduce((s, o) => s + (o.sales_order_value ?? 0), 0) ?? 0;

        // Wallet & credit from companies table
        const { data: company } = await supabase
          .from("companies")
          .select("wallet_balance, current_balance")
          .eq("id", companyId)
          .maybeSingle();

        const walletBalance = company?.wallet_balance ?? 0;
        const creditBalance = company?.current_balance ?? 0;

        // Most ordered product
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
    { label: "Product Catalogue", icon: Package, route: "/catalogue", color: "bg-primary/10 text-primary" },
    { label: "My Orders", icon: ShoppingBag, route: "/orders", color: "bg-primary/10 text-primary" },
    { label: "Documents", icon: FileText, route: "/documents", color: "bg-primary/10 text-primary" },
    { label: "My Account", icon: CreditCard, route: "/account", color: "bg-primary/10 text-primary" },
    { label: "Favorites", icon: Star, route: "/favorites", color: "bg-primary/10 text-primary" },
    { label: "Dashboard", icon: BarChart3, route: "/dashboard", color: "bg-primary/10 text-primary" },
  ];

  const cards = [
    { label: "Total Business", value: formatPrice(overview.totalBusiness), icon: TrendingUp },
    { label: "Total Orders", value: String(overview.totalOrders), icon: ShoppingBag },
    { label: "Wallet Balance", value: formatPrice(overview.walletBalance), icon: CreditCard },
    { label: "Credit Balance", value: formatPrice(overview.creditBalance), icon: CreditCard },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <TopNavBar />
      <SystemAlertMarquee />

      <div className="pt-20 px-4 sm:px-6 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">Buyer Portal</h1>
          <p className="font-body text-muted-foreground text-sm mt-1">Your business at a glance.</p>
        </motion.div>

        {/* Overview Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {cards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <card.icon size={16} className="text-primary" />
                <span className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">{card.label}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Most Ordered */}
        {overview.mostOrdered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-10 bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-3"
          >
            <Star size={18} className="text-primary fill-primary" />
            <div>
              <p className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">Most Ordered Product</p>
              <p className="font-bold text-foreground">{overview.mostOrdered}</p>
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
              transition={{ delay: i * 0.04 }}
              onClick={() => navigate(tile.route)}
              className="flex flex-col items-center gap-3 bg-card border border-border rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-primary/30 transition-all active:scale-95"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${tile.color}`}>
                <tile.icon size={22} />
              </div>
              <span className="text-xs font-bold text-foreground">{tile.label}</span>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BuyerPortal;
