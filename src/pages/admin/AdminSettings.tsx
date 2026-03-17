import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: unknown;
  updated_at: string;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from("app_settings").select("*").order("setting_key");
      setSettings((data as Setting[]) ?? []);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">System Settings</h1>
      <p className="text-body-p2 text-muted-foreground">Company defaults, numbering rules, status labels, dispatch rules, support settings</p>

      {settings.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <p className="text-ui-label text-muted-foreground">No system settings configured. Settings will appear here once added to the app_settings table.</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Key</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Value</th>
                <th className="text-left px-4 py-3 text-ui-label text-muted-foreground">Updated</th>
              </tr>
            </thead>
            <tbody>
              {settings.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="px-4 py-3 text-ui-cell text-foreground font-medium">{s.setting_key}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground max-w-[300px] truncate">{JSON.stringify(s.setting_value)}</td>
                  <td className="px-4 py-3 text-ui-cell text-muted-foreground">{new Date(s.updated_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
