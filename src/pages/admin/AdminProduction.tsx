import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight, Factory, Wrench } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import TopNavBar from "@/components/TopNavBar"; // <-- Fixed missing import

interface ProdOrder {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  created_at: string | null;
  company?: { business_name: string } | null;
  order_items?: { id: string; quantity: number; product_id: string | null; product?: { name: string } | null }[];
}

const AdminProduction = () => {
  const [orders, setOrders] = useState<ProdOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"production" | "assembly">("production");
  const [updating, setUpdating] = useState<string | null>(null);
  const { t } = useLanguage();

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, status, sales_order_value, company_id, created_at, company:companies(business_name), order_items(id, quantity, product_id)",
      )
      .in("status", ["in_production", "assembly"])
      .order("created_at", { ascending: true });

    if (error) {
      toast.error("Failed to fetch production orders.");
      console.error(error);
    } else {
      setOrders((data as unknown as ProdOrder[]) ?? []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const filtered = orders.filter((o) =>
    tab === "production" ? o.status === "in_production" : o.status === "assembly",
  );
  const prodCount = orders.filter((o) => o.status === "in_production").length;
  const asmCount = orders.filter((o) => o.status === "assembly").length;

  const handleAdvance = async (order: ProdOrder) => {
    const next = order.status === "in_production" ? "assembly" : "packing";
    setUpdating(order.id);
    const { error } = await supabase.from("orders").update({ status: next }).eq("id", order.id);
    if (error) {
      toast.error("Failed");
      setUpdating(null);
      return;
    }
    await supabase
      .from("order_status_history")
      .insert({ order_id: order.id, old_status: order.status, new_status: next });
    toast.success(`Moved to ${next === "assembly" ? t("Assembly") : t("Packing")}`);
    setUpdating(null);
    fetchOrders();
  };

  const totalItems = filtered.reduce((s, o) => s + (o.order_items?.reduce((a, i) => a + i.quantity, 0) ?? 0), 0);
  const maxItems = Math.max(totalItems, 1);

  if (loading)
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />
      <main className="pt-24 px-5 max-w-5xl mx-auto space-y-8">
        <h1 className="text-display-h2 text-foreground">{t("Production & Assembly")}</h1>

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setTab("production")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-ui-button transition-colors ${tab === "production" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Factory size={14} /> {t("In Production")} ({prodCount})
          </button>
          <button
            onClick={() => setTab("assembly")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-ui-button transition-colors ${tab === "assembly" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
          >
            <Wrench size={14} /> {t("Assembly")} ({asmCount})
          </button>
        </div>

        {/* Workload bar */}
        <div
          className="bg-card border border-border rounded-xl p-4"
          style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-ui-label text-muted-foreground">
              {tab === "production" ? "Production" : "Assembly"} Workload
            </span>
            <span className="text-ui-kpi text-primary">
              {filtered.length} orders · {totalItems} packs
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary/70 rounded-full transition-all"
              style={{ width: `${Math.min((filtered.length / Math.max(orders.length, 1)) * 100, 100)}%` }}
            />
          </div>
        </div>

        {/* Orders */}
        {filtered.length === 0 ? (
          <p className="text-ui-label text-muted-foreground">No orders in {tab} queue.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((order) => {
              const packs = order.order_items?.reduce((s, i) => s + i.quantity, 0) ?? 0;
              const nextLabel = order.status === "in_production" ? t("Assembly") : t("Packing");
              const daysSince = order.created_at
                ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000)
                : 0;
              const isDelayed = daysSince > 5;
              return (
                <div
                  key={order.id}
                  className={`bg-card border rounded-xl p-4 space-y-3 ${isDelayed ? "border-destructive/40" : "border-border"}`}
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-ui-h5 text-foreground">{order.company?.business_name ?? "—"}</p>
                      <p className="text-fine text-muted-foreground">{order.id.slice(0, 8)}…</p>
                    </div>
                    {isDelayed && (
                      <span className="text-fine text-destructive font-semibold">Delayed {daysSince}d</span>
                    )}
                  </div>
                  <div className="flex justify-between text-fine text-muted-foreground">
                    <span>{packs} packs</span>
                    <span>₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
                  </div>
                  {/* Item workload bar */}
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary/60 rounded-full"
                      style={{ width: `${Math.min((packs / maxItems) * 100, 100)}%` }}
                    />
                  </div>
                  <button
                    onClick={() => handleAdvance(order)}
                    disabled={updating === order.id}
                    className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-ui-button text-sm bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                    {nextLabel}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminProduction;
