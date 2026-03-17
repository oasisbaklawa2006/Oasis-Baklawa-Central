import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Input } from "@/components/ui/input";

interface CompanyUser {
  id: string;
  business_name: string;
  gst_number: string | null;
  credit_limit: number | null;
  wallet_balance: number | null;
  created_at: string | null;
}

const AdminUsers = () => {
  const [companies, setCompanies] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCredit, setEditingCredit] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const fetchCompanies = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("companies")
      .select("*")
      .order("created_at", { ascending: false });
    setCompanies((data as CompanyUser[]) ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const handleSaveCredit = async (company: CompanyUser) => {
    const newLimit = editingCredit[company.id] ?? company.credit_limit ?? 0;
    setSaving(company.id);
    const { error } = await supabase
      .from("companies")
      .update({ credit_limit: newLimit })
      .eq("id", company.id);
    if (error) toast.error("Failed to update");
    else { toast.success(`Credit limit updated for ${company.business_name}`); fetchCompanies(); }
    setSaving(null);
  };

  const fmt = (n: number | null) => `₹${(n ?? 0).toLocaleString("en-IN")}`;

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-primary">Manage Users & Companies</h1>

      {companies.length === 0 ? (
        <p className="text-ui-label text-muted-foreground">No approved companies yet.</p>
      ) : (
        <div className="rounded-xl overflow-hidden border border-border bg-white" style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">GST</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Wallet Balance</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Credit Limit</th>
                <th className="text-right px-4 py-3 text-ui-label text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {companies.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-3 text-ui-cell text-foreground font-medium">{c.business_name}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{c.gst_number ?? "—"}</td>
                  <td className="px-4 py-3 text-right text-ui-kpi text-sm text-foreground">{fmt(c.wallet_balance)}</td>
                  <td className="px-4 py-3 text-right">
                    <Input
                      type="number"
                      className="w-28 text-right text-sm inline-block rounded-lg"
                      value={editingCredit[c.id] ?? c.credit_limit ?? 0}
                      onChange={(e) => setEditingCredit({ ...editingCredit, [c.id]: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleSaveCredit(c)}
                      disabled={saving === c.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-ui-button bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    >
                      {saving === c.id ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminUsers;
