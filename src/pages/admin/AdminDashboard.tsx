import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, UserCheck, Clock, Factory, Layers, Package, Truck, CreditCard } from "lucide-react";

interface KPI {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
}

const AdminDashboard = () => {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      const [approvals, awaiting, production, assembly, packing, dispatched, closed] = await Promise.all([
        supabase.from("b2b_applications").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "awaiting_advance"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "in_production"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "assembly"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "packing"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "dispatched"),
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "payment_pending"),
      ]);

      setKpis([
        { label: "Pending Approvals", value: approvals.count ?? 0, icon: UserCheck, color: "#f59e0b" },
        { label: "Awaiting Advance", value: awaiting.count ?? 0, icon: Clock, color: "#ef4444" },
        { label: "In Production", value: production.count ?? 0, icon: Factory, color: "#3b82f6" },
        { label: "Assembly", value: assembly.count ?? 0, icon: Layers, color: "#8b5cf6" },
        { label: "Packing", value: packing.count ?? 0, icon: Package, color: "#10b981" },
        { label: "Dispatch Pending", value: dispatched.count ?? 0, icon: Truck, color: "#06b6d4" },
        { label: "Payment Pending", value: closed.count ?? 0, icon: CreditCard, color: "#ec4899" },
      ]);
      setLoading(false);
    };
    fetchKpis();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Admin Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl p-5 border space-y-3"
            style={{ backgroundColor: "#1a1a1a", borderColor: "#2a2a2a" }}
          >
            <div className="flex items-center justify-between">
              <kpi.icon size={20} style={{ color: kpi.color }} />
              <span
                className="text-ui-kpi text-3xl"
                style={{ color: kpi.color }}
              >
                {kpi.value}
              </span>
            </div>
            <p className="text-ui-label text-[#999]">{kpi.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
