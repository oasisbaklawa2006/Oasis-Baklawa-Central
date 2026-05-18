// src/components/WhatsAppInbox.tsx
// TOOL 1: Raw WhatsApp Inbox — Display stitched packets as conversations

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, MessageCircle, Clock } from "lucide-react";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";

interface Message {
  id: string;
  content: string | null;
  message_type: string;
  direction: "inbound" | "outbound";
  created_at: string | null;
  packet_sequence: number | null;
}

interface Packet {
  id: string;
  contact_id: string;
  fragment_count: number;
  status: string;
  first_message_at: string;
  last_message_at: string;
  stitched_content: unknown;
  messages?: Message[];
  customer_name?: string;
  phone_number?: string;
  whatsapp_contacts?: {
    phone_number: string | null;
    customer_name: string | null;
  } | null;
}

function packetPreviewSummary(packet: Packet): string {
  const sc = packet.stitched_content;
  if (sc && typeof sc === "object" && !Array.isArray(sc) && "summary" in sc) {
    const s = (sc as { summary?: unknown }).summary;
    if (typeof s === "string" && s.trim()) return s;
  }
  if (typeof sc === "string" && sc.trim()) return sc.trim().slice(0, 80);
  return `${packet.fragment_count} messages`;
}

const REALTIME_CHANNEL = "whatsapp-inbox-packets";

/** Suggestion-only payloads from Edge Functions (read-only UI). */
interface IntentSuggestion {
  intent_type: string;
  confidence: number;
  keywords: string[];
  metadata: Record<string, unknown>;
}

interface RouteSuggestion {
  assigned_to_team: string;
  priority: string;
  action: string;
  reason: string;
  metadata: Record<string, unknown>;
}

export function WhatsAppInbox() {
  const { user } = useAuth();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const selectedPacketIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [intentResult, setIntentResult] = useState<IntentSuggestion | null>(null);
  const [routeResult, setRouteResult] = useState<RouteSuggestion | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  useEffect(() => {
    selectedPacketIdRef.current = selectedPacket?.id ?? null;
  }, [selectedPacket?.id]);

  useEffect(() => {
    setIntentResult(null);
    setRouteResult(null);
    setSuggestionsError(null);
  }, [selectedPacket?.id]);

  const loadPackets = useCallback(async (opts?: { silent?: boolean }) => {
    try {
      if (!opts?.silent) setLoading(true);

      const { data: packetsData, error: packetsError } = await supabase
        // whatsapp_* tables not in generated Database types yet
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .from("whatsapp_message_packets" as any)
        .select(
          `
          id,
          contact_id,
          fragment_count,
          status,
          first_message_at,
          last_message_at,
          stitched_content,
          whatsapp_contacts (
            phone_number,
            customer_name
          )
        `,
        )
        .eq("status", "open")
        .order("last_message_at", { ascending: false })
        .limit(50);

      if (packetsError) throw packetsError;

      const rows = (packetsData ?? []) as unknown as Packet[];

      const enrichedPackets = await Promise.all(
        rows.map(async (packet) => {
          const { data: messages, error: messagesError } = await supabase
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .from("whatsapp_messages" as any)
            .select("id, content, message_type, direction, created_at, packet_sequence")
            .eq("packet_id", packet.id)
            .order("packet_sequence", { ascending: true });

          if (messagesError) console.warn("Failed to load messages:", messagesError);

          const contact = packet.whatsapp_contacts;
          return {
            ...packet,
            messages: (messages ?? []) as unknown as Message[],
            customer_name: contact?.customer_name ?? "Unknown",
            phone_number: contact?.phone_number ?? "---",
          };
        }),
      );

      setPackets(enrichedPackets);
      setSelectedPacket((prev) => {
        if (!prev) return null;
        return enrichedPackets.find((p) => p.id === prev.id) ?? prev;
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load inbox");
      console.error("Inbox error:", err);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  const handleSendReply = useCallback(async () => {
    const trimmed = replyText.trim();
    if (!trimmed || !selectedPacket) return;

    const digits = String(selectedPacket.phone_number ?? "").replace(/\D/g, "");
    if (digits.length < 10) {
      alert("Missing or invalid phone number for this contact.");
      return;
    }

    setReplySending(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-operator-reply", {
        body: {
          packet_id: selectedPacket.id,
          contact_id: selectedPacket.contact_id,
          phone_number: selectedPacket.phone_number,
          message: trimmed,
          operator_id: user?.id,
        },
      });

      if (invokeError) {
        alert(`Failed to send: ${invokeError.message}`);
        return;
      }

      const result = data as { success?: boolean; error?: string } | null;
      if (result?.success) {
        setReplyText("");
        await loadPackets({ silent: true });
      } else {
        alert(`Failed to send: ${result?.error ?? "Unknown error"}`);
      }
    } catch (err) {
      console.error("Reply error:", err);
      alert("Failed to send reply");
    } finally {
      setReplySending(false);
    }
  }, [replyText, selectedPacket, user?.id, loadPackets]);

  const handleClassifyIntent = useCallback(async () => {
    if (!selectedPacket) return;
    const packetId = selectedPacket.id;
    const contactId = selectedPacket.contact_id;
    setClassifyLoading(true);
    setSuggestionsError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-classify-intent", {
        body: { packet_id: packetId, contact_id: contactId },
      });
      if (selectedPacketIdRef.current !== packetId) return;
      if (invokeError) {
        if (selectedPacketIdRef.current !== packetId) return;
        setSuggestionsError(invokeError.message);
        return;
      }
      const body = data as { success?: boolean; intent?: IntentSuggestion; error?: string } | null;
      if (!body?.success || !body.intent) {
        if (selectedPacketIdRef.current !== packetId) return;
        setSuggestionsError(body?.error ?? "Classification failed");
        return;
      }
      if (selectedPacketIdRef.current !== packetId) return;
      setIntentResult(body.intent);
    } catch (err) {
      if (selectedPacketIdRef.current !== packetId) return;
      setSuggestionsError(err instanceof Error ? err.message : "Classification failed");
    } finally {
      setClassifyLoading(false);
    }
  }, [selectedPacket]);

  const handleSuggestRoute = useCallback(async () => {
    if (!selectedPacket) return;
    const packetId = selectedPacket.id;
    const contactId = selectedPacket.contact_id;
    setRouteLoading(true);
    setSuggestionsError(null);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("whatsapp-route-packet", {
        body: {
          packet_id: packetId,
          contact_id: contactId,
          intent: intentResult ?? undefined,
        },
      });
      if (selectedPacketIdRef.current !== packetId) return;
      if (invokeError) {
        if (selectedPacketIdRef.current !== packetId) return;
        setSuggestionsError(invokeError.message);
        return;
      }
      const body = data as { success?: boolean; decision?: RouteSuggestion; error?: string } | null;
      if (!body?.success || !body.decision) {
        if (selectedPacketIdRef.current !== packetId) return;
        setSuggestionsError(body?.error ?? "Routing suggestion failed");
        return;
      }
      if (selectedPacketIdRef.current !== packetId) return;
      setRouteResult(body.decision);
    } catch (err) {
      if (selectedPacketIdRef.current !== packetId) return;
      setSuggestionsError(err instanceof Error ? err.message : "Routing suggestion failed");
    } finally {
      setRouteLoading(false);
    }
  }, [selectedPacket, intentResult]);

  useEffect(() => {
    void loadPackets();
  }, [loadPackets]);

  useEffect(() => {
    removeDuplicateRealtimeChannel(REALTIME_CHANNEL);

    const channel = supabase
      .channel(REALTIME_CHANNEL)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "whatsapp_message_packets",
        },
        () => {
          void loadPackets();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPackets]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 animate-spin text-green-500" />
          <p className="text-gray-600">Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-full max-w-md overflow-y-auto border-r border-gray-300 bg-white">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
          <h2 className="text-xl font-bold text-gray-900">WhatsApp Inbox</h2>
          <p className="text-sm text-gray-500">{packets.length} conversations</p>
        </div>

        {error && (
          <div className="border-b border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {packets.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <MessageCircle className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>No open conversations</p>
          </div>
        ) : (
          packets.map((packet) => (
            <div
              key={packet.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedPacket(packet)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setSelectedPacket(packet);
                }
              }}
              className={`cursor-pointer border-b border-gray-200 p-4 transition ${
                selectedPacket?.id === packet.id
                  ? "border-l-4 border-l-green-500 bg-green-50"
                  : "hover:bg-gray-50"
              }`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{packet.customer_name}</p>
                  <p className="text-xs text-gray-500">{packet.phone_number}</p>
                </div>
                <ChevronRight className="h-5 w-5 text-gray-400" />
              </div>

              <p className="mb-2 truncate text-sm text-gray-600">{packetPreviewSummary(packet)}</p>

              <div className="flex items-center justify-between">
                <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                  {packet.fragment_count} messages
                </span>
                <span className="flex items-center text-xs text-gray-500">
                  <Clock className="mr-1 h-3 w-3" />
                  {formatDistanceToNow(new Date(packet.last_message_at), {
                    addSuffix: true,
                  })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {selectedPacket ? (
        <div className="flex flex-1 flex-col bg-white">
          <div className="border-b border-gray-200 bg-green-50 p-4">
            <h3 className="font-bold text-gray-900">{selectedPacket.customer_name}</h3>
            <p className="text-sm text-gray-600">{selectedPacket.phone_number}</p>
            <p className="mt-1 text-xs text-gray-500">
              {selectedPacket.fragment_count} messages • Packet: {selectedPacket.status}
            </p>
          </div>

          <div className="border-b border-gray-200 bg-white px-4 py-3">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleClassifyIntent()}
                disabled={classifyLoading || routeLoading}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {classifyLoading ? "Classifying…" : "Classify Intent"}
              </button>
              <button
                type="button"
                onClick={() => void handleSuggestRoute()}
                disabled={classifyLoading || routeLoading}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {routeLoading ? "Suggesting…" : "Suggest Route"}
              </button>
            </div>
            {suggestionsError && (
              <p className="mt-2 text-sm text-red-600" role="alert">
                {suggestionsError}
              </p>
            )}
            {intentResult && (
              <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                <p className="font-semibold text-gray-900">Intent (suggestion)</p>
                <p className="mt-1">
                  <span className="text-gray-500">Type:</span> {intentResult.intent_type}
                </p>
                <p>
                  <span className="text-gray-500">Confidence:</span> {intentResult.confidence}
                </p>
                {intentResult.keywords?.length > 0 && (
                  <p>
                    <span className="text-gray-500">Keywords:</span> {intentResult.keywords.join(", ")}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-600">
                  <span className="text-gray-500">Metadata:</span>{" "}
                  {JSON.stringify(intentResult.metadata ?? {})}
                </p>
              </div>
            )}
            {routeResult && (
              <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                <p className="font-semibold text-gray-900">Route (suggestion)</p>
                <p className="mt-1">
                  <span className="text-gray-500">Team:</span> {routeResult.assigned_to_team}
                </p>
                <p>
                  <span className="text-gray-500">Priority:</span> {routeResult.priority}
                </p>
                <p>
                  <span className="text-gray-500">Action:</span> {routeResult.action}
                </p>
                <p>
                  <span className="text-gray-500">Reason:</span> {routeResult.reason}
                </p>
                <p className="mt-1 text-xs text-gray-600">
                  <span className="text-gray-500">Metadata:</span>{" "}
                  {JSON.stringify(routeResult.metadata ?? {})}
                </p>
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {selectedPacket.messages && selectedPacket.messages.length > 0 ? (
              selectedPacket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.direction === "inbound" ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-xs rounded-lg px-4 py-2 ${
                      msg.direction === "inbound"
                        ? "bg-gray-200 text-gray-900"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    <p className="text-sm">{msg.content ?? ""}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {msg.created_at ? new Date(msg.created_at).toLocaleTimeString() : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500">No messages in this packet</p>
            )}
          </div>

          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !replySending) {
                    e.preventDefault();
                    void handleSendReply();
                  }
                }}
                placeholder="Type a reply..."
                disabled={replySending}
                className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 focus:border-green-500 focus:outline-none disabled:bg-gray-100"
              />
              <button
                type="button"
                onClick={() => void handleSendReply()}
                disabled={replySending || !replyText.trim()}
                className="rounded-full bg-green-500 px-6 py-2 font-medium text-white transition hover:bg-green-600 disabled:bg-gray-300"
              >
                {replySending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center bg-gray-50">
          <p className="text-gray-500">Select a conversation to view messages</p>
        </div>
      )}
    </div>
  );
}

export default WhatsAppInbox;
