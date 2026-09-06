import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Bell, Save, Loader2, Info, Radio, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { processOutboxQueue } from "@/utils/notificationOutbox";
import {
  outboxDeliveryLabel,
  projectOutboxRows,
} from "@/lib/notification-infrastructure/outboxDeliveryView";
import type { OutboxDeliveryRecord } from "@/lib/notification-infrastructure/contract";

// ── Types ──
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

interface OutboxMessage {
  id: string;
  event_type: string | null;
  message_body: string;
  recipient_phone: string | null;
  recipient_email: string | null;
  status: string | null;
  priority: string | null;
  created_at: string | null;
  sent_at: string | null;
  error_log: string | null;
}

const projectOutboxForAdmin = (rows: OutboxMessage[]): OutboxDeliveryRecord[] =>
  projectOutboxRows(rows);

// ── Constants ──
const PRIORITY_STYLES: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border-slate-200",
  normal: "bg-sky-50 text-sky-700 border-sky-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-red-50 text-red-600 border-red-200 animate-pulse",
};

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  sent: "bg-emerald-100 text-emerald-800 border-emerald-300",
  failed: "bg-red-100 text-red-700 border-red-300",
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
  const [outbox, setOutbox] = useState<OutboxDeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [outboxLoading, setOutboxLoading] = useState(false);
  const [editedBodies, setEditedBodies] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_events")
      .select("*")
      .order("event_name");
    setEvents((data as NotificationEvent[]) || []);
    setLoading(false);
  };

  const fetchOutbox = async () => {
    setOutboxLoading(true);
    const { data, error } = await supabase
      .from("notification_outbox")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch Error:", error);
      toast.error("Failed to load outbox");
    } else {
      console.log("[Outbox] Fetched rows:", data?.length);
      setOutbox(projectOutboxForAdmin((data as OutboxMessage[]) || []));
    }
    setOutboxLoading(false);
  };

  useEffect(() => {
    fetchEvents();
    fetchOutbox();
  }, []);

  const handleToggle = async (id: string, current: boolean) => {
    const newVal = !current;
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_enabled: newVal } : e)));
    const { error } = await supabase
      .from("notification_events")
      .update({ is_enabled: newVal } as any)
      .eq("id", id);
    if (error) {
      toast.error("Failed to update toggle");
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, is_enabled: current } : e)));
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
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, template_body: body } : e)));
      setEditedBodies((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
    setSavingId(null);
  };

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      const count = await processOutboxQueue();
      if (count === 0) {
        toast.info("No pending messages to process (or missing auth session).");
      } else {
        toast.success(`Processed ${count} message(s)`);
      }
    } catch (err: any) {
      console.error("Process queue error:", err);
      toast.error(err?.message || "Failed to process queue");
    }
    await fetchOutbox();
    setProcessing(false);
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
    <div className="space-y-6 max-w-7xl mx-auto">
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

      <Tabs defaultValue="templates" className="w-full">
        <TabsList>
          <TabsTrigger value="templates">🔔 Event Templates</TabsTrigger>
          <TabsTrigger value="outbox">📡 Live Outbox</TabsTrigger>
        </TabsList>

        {/* ── TAB 1: TEMPLATES ── */}
        <TabsContent value="templates" className="space-y-6 mt-4">
          {/* Placeholder Legend */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-2 pt-4 px-5">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 text-primary">
                <Info size={14} /> Available Template Placeholders
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-4">
              <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                {PLACEHOLDERS.map((p) => (
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

          {events.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No notification events configured yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {events.map((evt) => {
                const priority = (evt.priority || "normal").toLowerCase();
                return (
                  <Card
                    key={evt.id}
                    className={`transition-shadow hover:shadow-md ${evt.is_enabled === false ? "opacity-60" : ""}`}
                  >
                    <CardHeader className="pb-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <CardTitle className="text-sm font-semibold leading-tight truncate">
                            {evt.event_name}
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground font-mono">{evt.event_key}</p>
                        </div>
                        <Switch
                          checked={evt.is_enabled !== false}
                          onCheckedChange={() => handleToggle(evt.id, evt.is_enabled !== false)}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[10px] uppercase tracking-wider font-bold ${PRIORITY_STYLES[priority] || PRIORITY_STYLES.normal}`}>
                          {priority}
                        </Badge>
                        {evt.channels?.map((ch) => (
                          <Badge key={ch} variant="secondary" className="text-[10px] uppercase tracking-wider">
                            {ch}
                          </Badge>
                        ))}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Textarea
                        value={getBody(evt)}
                        onChange={(e) => setEditedBodies((prev) => ({ ...prev, [evt.id]: e.target.value }))}
                        className="text-xs font-mono min-h-[100px] resize-y bg-muted/30"
                        placeholder="Enter template body..."
                      />
                      {isDirty(evt.id) && (
                        <Button size="sm" onClick={() => handleSaveTemplate(evt.id)} disabled={savingId === evt.id} className="w-full">
                          {savingId === evt.id ? <Loader2 size={14} className="animate-spin mr-2" /> : <Save size={14} className="mr-2" />}
                          Save Template
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── TAB 2: LIVE OUTBOX ── */}
        <TabsContent value="outbox" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <Radio size={18} className="text-primary" /> Message Outbox
            </h2>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchOutbox} disabled={outboxLoading}>
                <RefreshCw size={14} className={`mr-1.5 ${outboxLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button size="sm" onClick={handleProcessQueue} disabled={processing}>
                {processing ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Radio size={14} className="mr-1.5" />}
                Process Queue
              </Button>
            </div>
          </div>

          {outbox.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                No messages in the outbox yet.
              </CardContent>
            </Card>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden" style={{ boxShadow: "0 2px 10px rgba(0,0,0,0.04)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Timestamp</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Event</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Recipient</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Message</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outbox.map((msg) => {
                      const status = outboxDeliveryLabel(msg);
                      return (
                        <tr key={msg.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                            {msg.createdAt
                              ? new Date(msg.createdAt).toLocaleDateString("en-IN", {
                                  day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                                })
                              : "—"}
                          </td>
                          <td className="px-4 py-3 text-xs font-medium text-foreground">{msg.eventType || "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {msg.recipientPhone || msg.recipientEmail || "—"}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground max-w-[280px] truncate">
                            {msg.messageBody?.slice(0, 100)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-[10px] uppercase font-bold ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                              {status}
                            </Badge>
                            {msg.errorLog && status === "failed" && (
                              <p className="text-[10px] text-red-600 mt-1 truncate max-w-[200px]" title={msg.errorLog}>
                                {msg.errorLog}
                              </p>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminNotifications;
