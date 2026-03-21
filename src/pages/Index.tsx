import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ChefHat, Loader2, Printer, ClipboardList, Package } from "lucide-react";
import TopNavBar from "@/components/TopNavBar";

const PACKS_PER_CARTON = 9;

// We look at orders that haven't been dispatched yet
const ACTIVE_STATUSES = ["submitted", "approved", "in_production", "packing"];

interface AggregatedItem {
  productId: string;
  name: string;
  totalPacks: number;
  packSize: string | null;
  cartonType: string | null;
}

const AdminProduction = () => {
  const [loading, setLoading] = useState(true);
  const [rawData, setRawData] = useState<any[]>([]);

  const fetchProductionData = async () => {
    setLoading(true);
    // Fetch all active orders and their items
    const { data, error } = await supabase
      .from("orders")
      .select(
        `
        status,
        order_items (
          quantity,
          product_id,
          pack_size,
          carton_type,
          products ( name )
        )
      `,
      )
      .in("status", ACTIVE_STATUSES);

    if (error) {
      console.error("Production fetch error:", error);
      toast.error("Failed to load production data");
    } else {
      setRawData(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProductionData();
  }, []);

  // The Aggregation Engine: Combines all items from all active orders
  const productionList = useMemo(() => {
    const totals = new Map<string, AggregatedItem>();

    rawData.forEach((order) => {
      if (!order.order_items) return;

      order.order_items.forEach((item: any) => {
        // Fallback for product name depending on how Supabase returns the join
        const productName = item.products?.name || item.product?.name || "Unknown Product";
        const key = item.product_id || productName; // Group by ID if possible, else name

        if (totals.has(key)) {
          const existing = totals.get(key)!;
          existing.totalPacks += Number(item.quantity || 0);
        } else {
          totals.set(key, {
            productId: item.product_id,
            name: productName,
            totalPacks: Number(item.quantity || 0),
            packSize: item.pack_size || "Standard",
            cartonType: item.carton_type || "Standard",
          });
        }
      });
    });

    // Convert map to array and sort by highest quantity needed
    return Array.from(totals.values()).sort((a, b) => b.totalPacks - a.totalPacks);
  }, [rawData]);

  const totalBakePacks = productionList.reduce((sum, item) => sum + item.totalPacks, 0);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 size={32} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopNavBar />

      <main className="pt-24 px-5 max-w-5xl mx-auto space-y-8 print:pt-10 print:px-0">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 text-primary mb-2">
              <ChefHat size={20} />
              <span className="font-bold text-sm tracking-widest uppercase">Kitchen View</span>
            </div>
            <h1 className="text-display-h1 text-foreground">Master Prep List</h1>
            <p className="text-body-p2 text-muted-foreground mt-1">Aggregated requirements for all active orders.</p>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors print:hidden shadow-sm"
          >
            <Printer size={16} />
            Print for Kitchen
          </button>
        </div>

        {/* Global KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 print:hidden">
          <div className="bg-primary/10 border border-primary/20 rounded-2xl p-5">
            <p className="text-xs font-bold text-primary uppercase tracking-wider mb-1">Total Packs to Bake</p>
            <p className="text-3xl font-display text-primary">{totalBakePacks}</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-2xl p-5">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1">Active Orders</p>
            <p className="text-3xl font-display text-foreground">{rawData.length}</p>
          </div>
        </div>

        {/* Production Table */}
        {productionList.length === 0 ? (
          <div className="text-center py-20 bg-muted/10 rounded-[2rem] border border-dashed border-border">
            <ClipboardList size={48} className="mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-bold text-foreground">No active prep required</h3>
            <p className="text-sm text-muted-foreground mt-1">There are currently no orders in the active pipeline.</p>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">Product</th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      Pack Config
                    </th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-muted-foreground text-right">
                      Master Cartons
                    </th>
                    <th className="p-4 font-bold text-xs uppercase tracking-wider text-primary text-right bg-primary/5">
                      Total Packs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {productionList.map((item, idx) => {
                    const cartons = Math.floor(item.totalPacks / PACKS_PER_CARTON);
                    const loosePacks = item.totalPacks % PACKS_PER_CARTON;

                    return (
                      <tr key={idx} className="hover:bg-muted/10 transition-colors group">
                        <td className="p-4">
                          <p className="font-bold text-foreground">{item.name}</p>
                        </td>
                        <td className="p-4">
                          <p className="text-sm text-muted-foreground">
                            {item.packSize} • {item.cartonType}
                          </p>
                        </td>
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600">
                            <Package size={14} className="text-slate-400" />
                            {cartons} {cartons === 1 ? "Box" : "Boxes"}
                            {loosePacks > 0 && (
                              <span className="text-amber-600 text-xs ml-1">(+{loosePacks} loose)</span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right bg-primary/5">
                          <p className="font-display text-xl text-primary">{item.totalPacks}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminProduction;
