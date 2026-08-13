import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: unknown;
  updated_at: string;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const settingsRes = await supabase.from("app_settings").select("*").order("setting_key");
        if (settingsRes.error) {
          setLoadError(settingsRes.error.message);
          return;
        }
        setSettings((settingsRes.data as Setting[]) ?? []);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Failed to load system settings");
      } finally {
        setLoading(false);
      }
    };
    void fetchAll();
  }, []);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  if (loading) return <div className="flex justify-center py-20"><Loader2 size={24} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-display-h2 text-foreground">System Settings</h1>
      <p className="text-body-p2 text-muted-foreground">Company defaults, numbering rules, status labels, dispatch rules, support settings</p>

      {/* WhatsApp Configuration */}
      <div className="bg-card border border-border rounded-xl p-6" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
        <div className="flex items-center gap-2 mb-4">
          <MessageSquare size={20} className="text-primary" />
          <h2 className="text-lg font-bold text-foreground">WhatsApp API (Click2API)</h2>
        </div>
        <div className="grid grid-cols-1 gap-4">
            <div className="flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-semibold" data-testid="whatsapp-secrets-server-managed">Secrets are server-managed</p>
                <p className="mt-1 text-emerald-900">
                  Click2API keys, access tokens, and webhook secrets are never loaded into browser state.
                  Replacement and rotation are performed only through the staging Edge Function secret store.
                </p>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground block mb-1">Webhook URL (paste in Click2API)</label>
              <Input value={webhookUrl} readOnly className="bg-muted/50 font-mono text-xs" />
            </div>
          </div>
      </div>

      {loadError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          Unable to load system settings: {loadError}
        </div>
      ) : null}

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
