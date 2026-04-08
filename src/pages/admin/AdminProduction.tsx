import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, ArrowRight, Factory, Wrench, Package } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Progress } from "@/components/ui/progress";
import StagnancyBadge from "@/components/StagnancyBadge";
import TopNavBar from "@/components/TopNavBar";

interface ProdOrder {
  id: string;
  status: string;
  sales_order_value: number | null;
  company_id: string | null;
  created_at: string | null;
  company?: { business_name: string } | null;
  order_items?: { id: string; quantity: number; actual_packed_qty: number | null; product_id: string | null; production_status: string | null; product?: { name: string } | null }[];
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
        "id, status, sales_order_value, company_id, created_at, company:companies(business_name), order_items(id, quantity, actual_packed_qty, product_id, production_status)",
      )
      .in("status", ["in_production", "manufacturing", "assembly"])
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
    tab === "production" ? ["in_production", "manufacturing"].includes(o.status) : o.status === "assembly",
  );
  const prodCount = orders.filter((o) => ["in_production", "manufacturing"].includes(o.status)).length;
  const asmCount = orders.filter((o) => o.status === "assembly").length;

  const handleAdvance = async (order: ProdOrder, targetStatus: string) => {
    setUpdating(order.id);
    const { error } = await supabase.from("orders").update({ status: targetStatus }).eq("id", order.id);

    if (error) {
      toast.error("Failed to move order");
      setUpdating(null);
      return;
    }

    await supabase
      .from("order_status_history")
      .insert({ order_id: order.id, old_status: order.status, new_status: targetStatus });

    const statusName = targetStatus.replace("_", " ");
    toast.success(`Moved to ${statusName.charAt(0).toUpperCase() + statusName.slice(1)}`);

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
              const readyPacks = order.order_items?.reduce((s, i) => s + (i.production_status === "completed" ? (i.actual_packed_qty || i.quantity) : (i.actual_packed_qty || 0)), 0) ?? 0;
              const progressPct = packs > 0 ? Math.round((readyPacks / packs) * 100) : 0;
              const daysSince = order.created_at
                ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 86400000)
                : 0;
              const hoursSince = order.created_at
                ? (Date.now() - new Date(order.created_at).getTime()) / 3600000
                : 0;
              const isPanic = hoursSince > 4;

              return (
                <div
                  key={order.id}
                  className={`bg-card border rounded-xl p-4 flex flex-col space-y-3 ${isPanic ? "border-destructive/40 animate-pulse" : "border-border"}`}
                  style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.04)" }}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-ui-h5 text-foreground">{order.company?.business_name ?? "—"}</p>
                      <p className="text-fine text-muted-foreground">{order.id.slice(0, 8)}…</p>
                    </div>
                    <StagnancyBadge createdAt={order.created_at} />
                  </div>

                  <div className="flex justify-between text-fine text-muted-foreground">
                    <span>{readyPacks}/{packs} packs ready</span>
                    <span>₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
                  </div>

                  {/* Live Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                      <span>Completion</span>
                      <span>{progressPct}%</span>
                    </div>
                    <Progress value={progressPct} className="h-2" />
                  </div>

                  {/* SMART ROUTING BUTTONS */}
                  <div className="mt-auto pt-3 border-t border-border flex gap-2">
                    {order.status === "in_production" ? (
                      <>
                        <button
                          onClick={() => handleAdvance(order, "assembly")}
                          disabled={updating === order.id}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors disabled:opacity-50"
                        >
                          {updating === order.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Wrench size={12} />
                          )}
                          To Assembly
                        </button>
                        <button
                          onClick={() => handleAdvance(order, "packing")}
                          disabled={updating === order.id}
                          className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {updating === order.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Package size={12} />
                          )}
                          To Packing
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => handleAdvance(order, "packing")}
                        disabled={updating === order.id}
                        className="w-full flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                      >
                        {updating === order.id ? <Loader2 size={12} className="animate-spin" /> : <Package size={12} />}
                        Assembly Complete ➔ Packing
                      </button>
                    )}
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

export default AdminProduction;
