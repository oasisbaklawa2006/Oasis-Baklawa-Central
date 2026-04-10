import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, Save, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Setting {
  id: string;
  setting_key: string;
  setting_value: unknown;
  updated_at: string;
}

interface WhatsAppConfig {
  id?: string;
  api_key: string;
  instance_id: string;
  webhook_secret: string;
  default_country_code: string;
  is_active: boolean;
}

const AdminSettings = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);

  // WhatsApp config
  const [waConfig, setWaConfig] = useState<WhatsAppConfig>({
    api_key: "",
    instance_id: "",
    webhook_secret: "",
    default_country_code: "+91",
    is_active: true,
  });
  const [waLoading, setWaLoading] = useState(true);
  const [waSaving, setWaSaving] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      const [settingsRes, waRes] = await Promise.all([
        supabase.from("app_settings").select("*").order("setting_key"),
        (supabase as any).from("whatsapp_config").select("*").eq("is_active", true).limit(1),
      ]);
      setSettings((settingsRes.data as Setting[]) ?? []);
      if (waRes.data && waRes.data.length > 0) {
        const c = waRes.data[0];
        setWaConfig({
          id: c.id,
          api_key: c.api_key || "",
          instance_id: c.instance_id || "",
          webhook_secret: c.webhook_secret || "",
          default_country_code: c.default_country_code || "+91",
          is_active: c.is_active ?? true,
        });
      }
      setLoading(false);
      setWaLoading(false);
    };
    fetchAll();
  }, []);

  const handleSaveWhatsApp = async () => {
    if (!waConfig.api_key.trim() || !waConfig.instance_id.trim()) {
      toast.error("API Key and Instance ID are required.");
      return;
    }
    setWaSaving(true);

    const payload = {
      api_key: waConfig.api_key.trim(),
      instance_id: waConfig.instance_id.trim(),
      webhook_secret: waConfig.webhook_secret.trim() || null,
      default_country_code: waConfig.default_country_code.trim() || "+91",
      is_active: waConfig.is_active,
      updated_at: new Date().toISOString(),
    };

    let error;
    if (waConfig.id) {
      ({ error } = await (supabase as any).from("whatsapp_config").update(payload).eq("id", waConfig.id));
    } else {
      const res = await (supabase as any).from("whatsapp_config").insert(payload).select("id").single();
      error = res.error;
      if (res.data) setWaConfig((prev) => ({ ...prev, id: res.data.id }));
    }

    setWaSaving(false);
    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("WhatsApp configuration saved.");
    }
  };

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
        {waLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-muted-foreground block mb-1">API Key *</label>
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={waConfig.api_key}
                  onChange={(e) => setWaConfig((p) => ({ ...p, api_key: e.target.value }))}
                  placeholder="Click2API API Key"
                />
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowApiKey(!showApiKey)}
                >
                  {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground block mb-1">Instance ID *</label>
              <Input
                value={waConfig.instance_id}
                onChange={(e) => setWaConfig((p) => ({ ...p, instance_id: e.target.value }))}
                placeholder="Click2API Instance ID"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground block mb-1">Webhook Secret</label>
              <Input
                value={waConfig.webhook_secret}
                onChange={(e) => setWaConfig((p) => ({ ...p, webhook_secret: e.target.value }))}
                placeholder="Optional webhook verification secret"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-muted-foreground block mb-1">Default Country Code</label>
              <Input
                value={waConfig.default_country_code}
                onChange={(e) => setWaConfig((p) => ({ ...p, default_country_code: e.target.value }))}
                placeholder="+91"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-semibold text-muted-foreground block mb-1">Webhook URL (paste in Click2API)</label>
              <Input value={webhookUrl} readOnly className="bg-muted/50 font-mono text-xs" />
            </div>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={handleSaveWhatsApp} disabled={waSaving} className="gap-2">
                {waSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Save WhatsApp Config
              </Button>
            </div>
          </div>
        )}
      </div>

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
