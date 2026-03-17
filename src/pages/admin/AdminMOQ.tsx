import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface MOQRule {
  id: string;
  rule_scope: string;
  product_id: string | null;
  category_id: string | null;
  customer_type: string | null;
  pack_size: string | null;
  carton_type: string | null;
  min_quantity: number | null;
  validation_mode: string | null;
  is_active: boolean | null;
}

const AdminMOQ = () => {
  const [rules, setRules] = useState<MOQRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("moq_rules").select("*").order("created_at", { ascending: false });
      setRules((data as MOQRule[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">MOQ Rule Control</h1>
      <p className="text-body-p2 text-muted-foreground">Minimum order quantities by product, category, pack size, carton type, and customer type</p>

      {rules.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-ui-label text-muted-foreground">No MOQ rules configured.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Scope</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Customer Type</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Pack / Carton</th>
                  <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Min Qty</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Mode</th>
                  <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Active</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3 text-ui-cell text-foreground">{r.rule_scope}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{r.customer_type || "All"}</td>
                    <td className="px-4 py-3 text-ui-cell text-muted-foreground">{r.pack_size || "—"} / {r.carton_type || "—"}</td>
                    <td className="px-4 py-3 text-ui-cell text-foreground text-right">{r.min_quantity ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${r.validation_mode === "hard_stop" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {r.validation_mode || "warning"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`w-2 h-2 rounded-full inline-block ${r.is_active ? "bg-green-500" : "bg-gray-300"}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminMOQ;
