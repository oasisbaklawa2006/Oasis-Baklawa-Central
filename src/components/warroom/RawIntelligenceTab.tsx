import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { AlertCircle, RefreshCw, MessageSquare } from "lucide-react";

interface RawMessage {
  id: string;
  phone_number: string | null;
  raw_payload: any;
  created_at: string;
  error_message: string | null;
  processed: boolean | null;
}

export default function RawIntelligenceTab() {
  const [messages, setMessages] = useState<RawMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRaw = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("debug_webhooks")
      .select("id, phone_number, raw_payload, created_at, error_message, processed")
      .eq("direction", "inbound")
      .order("created_at", { ascending: false })
      .limit(50);
    setMessages((data as RawMessage[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRaw();
    const channelName = "warroom-raw-intel";
    removeDuplicateRealtimeChannel(channelName);
    const ch = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "debug_webhooks" }, () => fetchRaw())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [fetchRaw]);

  const extractText = (payload: any): string => {
    if (!payload) return "—";
    // Try common WhatsApp payload shapes
    const msg = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (msg?.text?.body) return msg.text.body;
    if (msg?.type === "image") return "[Image Attachment]";
    if (msg?.type === "audio") return "[Audio Message]";
    if (msg?.type === "document") return "[Document: " + (msg?.document?.filename || "file") + "]";
    if (typeof payload === "string") return payload.slice(0, 200);
    return JSON.stringify(payload).slice(0, 200);
  };

  const extractSender = (payload: any, phone: string | null): string => {
    const contact = payload?.entry?.[0]?.changes?.[0]?.value?.contacts?.[0];
    if (contact?.profile?.name) return `${contact.profile.name} (${phone || "?"})`;
    return phone || "Unknown";
  };

  const relativeTime = (dateStr: string): string => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 60000) return "Just now";
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Split into unprocessed (failed) and processed
  const failed = messages.filter((m) => !m.processed || m.error_message);
  const processed = messages.filter((m) => m.processed && !m.error_message);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing unmatched/failed inbound messages. {failed.length} need attention.
        </p>
        <button onClick={fetchRaw} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {loading && <p className="text-sm text-muted-foreground text-center py-8">Loading…</p>}

      {!loading && failed.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">✅ All inbound messages successfully processed.</p>
      )}

      {failed.map((msg) => (
        <div key={msg.id} className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-start justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
              <span className="text-xs font-bold text-foreground">{extractSender(msg.raw_payload, msg.phone_number)}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">{relativeTime(msg.created_at)}</span>
          </div>
          <p className="text-xs text-foreground bg-background rounded p-2 border border-border mb-1.5 font-mono whitespace-pre-wrap break-all">
            {extractText(msg.raw_payload)}
          </p>
          {msg.error_message && (
            <p className="text-[10px] text-red-500">⚠ {msg.error_message}</p>
          )}
        </div>
      ))}

      {processed.length > 0 && (
        <details className="mt-4">
          <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
            <MessageSquare size={12} className="inline mr-1" />
            {processed.length} successfully processed messages
          </summary>
          <div className="space-y-2 mt-2">
            {processed.map((msg) => (
              <div key={msg.id} className="rounded-lg border border-border bg-card p-2.5 opacity-60">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium text-foreground">{extractSender(msg.raw_payload, msg.phone_number)}</span>
                  <span className="text-[10px] text-muted-foreground">{relativeTime(msg.created_at)}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{extractText(msg.raw_payload)}</p>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
