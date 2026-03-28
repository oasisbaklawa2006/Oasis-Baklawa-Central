import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Save, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

interface NotificationEvent {
  id: string;
  event_key: string;
  event_name: string;
  template_body: string;
  channels: string[] | null;
  is_enabled: boolean | null;
  priority: string | null;
  created_at: string | null;
}

const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-sky-50 text-sky-700 border-sky-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-600 border-red-200 animate-pulse",
};

const PLACEHOLDERS = [
  { tag: "{{client_name}}", desc: "Client / Company name" },
  { tag: "{{order_id}}", desc: "Order reference ID" },
  { tag: "{{lr_number}}", desc: "LR / Tracking number" },
  { tag: "{{dispatch_date}}", desc: "Scheduled dispatch date" },
  { tag: "{{amount}}", desc: "Transaction amount (₹)" },
  { tag: "{{status}}", desc: "Current status label" },
];

const AdminNotifications = () => {
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_events")
      .select("*")
      .order("event_name");
    setEvents((data as NotificationEvent[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchEvents(); }, []);

  const handleToggle = async (id: string, current: boolean) => {
    const newVal = !current;
    setEvents(prev => prev.map(e => e.id === id ? { ...e, is_enabled: newVal } : e));
    const { error } = await supabase
      .from("notification_events")
      .update({ is_enabled: newVal } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update toggle");
      setEvents(prev => prev.map(e => e.id === id ? { ...e, is_enabled: current } : e));
    } else {
      toast.success(newVal ? "Notification enabled" : "Notification disabled");
    }
  };

  const handleSaveTemplate = async (id: string) => {
    const body = editedBodies[id];
    if (body === undefined) return;
    setSavingId(id);
    const { error } = await supabase
      .from("notification_events")
      .update({ template_body: body } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to save template");
    } else {
      toast.success("Template saved");
      setEvents(prev => prev.map(e => e.id === id ? { ...e, template_body: body } : e));
      setEditedBodies(prev => { const n = { ...prev }; delete n[id]; return n; });
    }
    setSavingId(null);
  };

  const getBody = (evt: NotificationEvent) =>
    editedBodies[evt.id] !== undefined ? editedBodies[evt.id] : evt.template_body;

  const isDirty = (id: string) => editedBodies[id] !== undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell size={22} className="text-primary" />
            Notification Control Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage automated communications across all system events.
          </p>
        </div>
      </div>

      {/* Placeholder Legend */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader className="pb-2 pt-4 px-5">
          <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
            <Info size={14} /> Available Template Placeholders
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-4">
          <div className="flex flex-wrap gap-x-6 gap-y-1.5">
            {PLACEHOLDERS.map(p => (
              <span key={p.tag} className="text-xs text-muted-foreground">
                <code className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold text-foreground">
                  {p.tag}
                </code>{" "}
                — {p.desc}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Event Grid */}
      {events.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            No notification events configured yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {events.map(evt => {
            const priority = (evt.priority || "normal").toLowerCase();
            return (
              <Card
                key={evt.id}
                className={`transition-shadow hover:shadow-md ${
                  evt.is_enabled === false ? "opacity-60" : ""
                }`}
              >
                <CardHeader className="pb-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 flex-1 min-w-0">
                      <CardTitle className="text-sm font-semibold leading-tight truncate">
                        {evt.event_name}
                      </CardTitle>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        {evt.event_key}
                      </p>
                    </div>
                    <Switch
                      checked={evt.is_enabled !== false}
                      onCheckedChange={() => handleToggle(evt.id, evt.is_enabled !== false)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] uppercase tracking-wider font-bold ${
                        PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal
                      }`}
                    >
                      {priority}
                    </Badge>
                    {evt.channels?.map(ch => (
                      <Badge
                        key={ch}
                        variant="secondary"
                        className="text-[10px] uppercase tracking-wider"
                      >
                        {ch}
                      </Badge>
                    ))}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Textarea
                    value={getBody(evt)}
                    onChange={e =>
                      setEditedBodies(prev => ({ ...prev, [evt.id]: e.target.value }))
                    }
                    className="text-xs font-mono min-h-[100px] resize-y bg-muted/30"
                    placeholder="Enter template body..."
                  />
                  {isDirty(evt.id) && (
                    <Button
                      size="sm"
                      onClick={() => handleSaveTemplate(evt.id)}
                      disabled={savingId === evt.id}
                      className="w-full"
                    >
                      {savingId === evt.id ? (
                        <Loader2 size={14} className="animate-spin mr-2" />
                      ) : (
                        <Save size={14} className="mr-2" />
                      )}
                      Save Template
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminNotifications;
