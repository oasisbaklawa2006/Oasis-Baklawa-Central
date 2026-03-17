import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface ExchangeRate {
  id: string;
  base_currency: string;
  target_currency: string;
  exchange_rate: number;
  source_type: string | null;
  updated_at: string;
}

const AdminCurrency = () => {
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("exchange_rates").select("*").order("updated_at", { ascending: false });
      setRates((data as ExchangeRate[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">Currency & Exchange Rates</h1>
      <p className="text-body-p2 text-muted-foreground">Manage base currency and exchange rates</p>

      {rates.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-ui-label text-muted-foreground">No exchange rates configured.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Base</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Target</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Rate</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Source</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => (
                <tr key={r.id} className="border-t border-border">
                  <td className="px-4 py-3 text-ui-cell text-foreground">{r.base_currency}</td>
                  <td className="px-4 py-3 text-ui-cell text-foreground">{r.target_currency}</td>
                  <td className="px-4 py-3 text-ui-cell text-foreground text-right">{r.exchange_rate}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{r.source_type || "manual"}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{new Date(r.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminCurrency;
