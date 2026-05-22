// src/components/WhatsAppInbox.tsx
// TOOL 1: Raw WhatsApp Inbox — Display stitched packets as conversations

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ChevronRight, MessageCircle, Clock, Pin } from "lucide-react";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Message } from "@/components/whatsapp/operatorInboxTypes";
import {
  groupMessagesByDay,
  inferLocalIntentFromText,
  inferPacketHealth,
  isLastMessageInboundUnanswered,
  medianResponseLagSeconds,
  messagePairsWithGapMarkers,
  operatorInboxIntentRowBorderClass,
  packetAgeBucket,
  packetStitchedPlainText,
} from "@/components/whatsapp/operatorInboxUtils";
import {
  OperatorInboxCustomerActivitySummary,
  OperatorInboxGovernanceBar,
  OperatorInboxIntentDot,
  OperatorInboxLocalAiPreviewPanel,
  OperatorInboxLocalDraftPreview,
  OperatorInboxLocalExplanationCards,
  OperatorInboxObservabilityPanel,
  OperatorInboxPacketBadges,
  OperatorInboxPacketHealthBadge,
  OperatorInboxRefreshingBanner,
} from "@/components/whatsapp/OperatorInboxReadOnlyPanels";
import { useOperatorInboxObservability } from "@/components/whatsapp/useOperatorInboxObservability";

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
  wa_contact_id?: string | null;
  whatsapp_contacts?: {
    phone_number: string | null;
    customer_name: string | null;
    wa_contact_id?: string | null;
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

function sidebarAgeLabel(age: ReturnType<typeof packetAgeBucket>): string {
  switch (age) {
    case "fresh":
      return "<15m";
    case "active":
      return "<2h";
    case "aging":
      return "<24h";
    default:
      return "24h+";
  }
}

function SidebarPacketMeta({ packet }: { packet: Packet }) {
  const msgs = packet.messages ?? [];
  const inbound = msgs.filter((m) => m.direction === "inbound").length;
  const outbound = msgs.filter((m) => m.direction === "outbound").length;
  const age = packetAgeBucket(packet.last_message_at);
  const health = inferPacketHealth(packet.last_message_at, msgs);
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
        {packet.status}
      </Badge>
      <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-normal">
        in {inbound} · out {outbound}
      </Badge>
      <Badge variant="outline" className="border-teal-200 bg-teal-50 px-1.5 py-0 text-[10px] font-normal text-teal-900">
        age {sidebarAgeLabel(age)}
      </Badge>
      <OperatorInboxPacketHealthBadge health={health} />
    </div>
  );
}

export function WhatsAppInbox() {
  const { user } = useAuth();
  const [packets, setPackets] = useState<Packet[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<Packet | null>(null);
  const selectedPacketIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [classifyLoading, setClassifyLoading] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [intentResult, setIntentResult] = useState<IntentSuggestion | null>(null);
  const [routeResult, setRouteResult] = useState<RouteSuggestion | null>(null);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [unansweredOnly, setUnansweredOnly] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [obsRefreshKey, setObsRefreshKey] = useState(0);
  const observability = useOperatorInboxObservability(obsRefreshKey);

  useEffect(() => {
    selectedPacketIdRef.current = selectedPacket?.id ?? null;
  }, [selectedPacket?.id]);

  useEffect(() => {
    setIntentResult(null);
    setRouteResult(null);
    setSuggestionsError(null);
  }, [selectedPacket?.id]);

  const loadPackets = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent);
    try {
      if (silent) {
        setIsRefreshing(true);
        setRefreshError(null);
      } else {
        setLoading(true);
      }

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
            customer_name,
            wa_contact_id
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
            .select(
              "id, content, message_type, direction, created_at, packet_sequence, status, provider",
            )
            .eq("packet_id", packet.id)
            .order("packet_sequence", { ascending: true });

          if (messagesError) console.warn("Failed to load messages:", messagesError);

          const contact = packet.whatsapp_contacts;
          return {
            ...packet,
            messages: (messages ?? []) as unknown as Message[],
            customer_name: contact?.customer_name ?? "Unknown",
            phone_number: contact?.phone_number ?? "---",
            wa_contact_id: contact?.wa_contact_id ?? null,
          };
        }),
      );

      setPackets(enrichedPackets);
      setSelectedPacket((prev) => {
        if (!prev) return null;
        return enrichedPackets.find((p) => p.id === prev.id) ?? prev;
      });
      setError(null);
      setRefreshError(null);
      setObsRefreshKey((k) => k + 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load inbox";
      if (silent) {
        setRefreshError(msg);
      } else {
        setError(msg);
        console.error("Inbox error:", err);
      }
    } finally {
      if (silent) {
        setIsRefreshing(false);
      } else {
        setLoading(false);
      }
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
          void loadPackets({ silent: true });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadPackets]);

  const togglePin = useCallback((id: string, e: MouseEvent) => {
    e.stopPropagation();
    setPinnedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const medianLagSecondsFromThreads = useMemo(() => {
    const lags: number[] = [];
    for (const p of packets) {
      const sec = medianResponseLagSeconds(p.messages ?? []);
      if (sec != null) lags.push(sec);
    }
    if (lags.length === 0) return null;
    lags.sort((a, b) => a - b);
    const mid = Math.floor(lags.length / 2);
    return lags.length % 2 ? lags[mid]! : (lags[mid - 1]! + lags[mid]!) / 2;
  }, [packets]);

  const filteredPackets = useMemo(() => {
    const q = filterQuery.trim().toLowerCase();
    return packets.filter((p) => {
      if (unansweredOnly && !isLastMessageInboundUnanswered(p.messages ?? [])) return false;
      if (!q) return true;
      const preview = packetPreviewSummary(p).toLowerCase();
      return (
        (p.customer_name ?? "").toLowerCase().includes(q) ||
        (p.phone_number ?? "").toLowerCase().includes(q) ||
        preview.includes(q)
      );
    });
  }, [packets, filterQuery, unansweredOnly]);

  const orderedPackets = useMemo(() => {
    const pinSet = new Set(pinnedIds);
    return [...filteredPackets].sort((a, b) => {
      const ap = pinSet.has(a.id) ? 1 : 0;
      const bp = pinSet.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [filteredPackets, pinnedIds]);

  const highlightInboundMessageId = useMemo(() => {
    const m = selectedPacket?.messages ?? [];
    if (!isLastMessageInboundUnanswered(m)) return null;
    const sorted = [...m].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return ta - tb;
    });
    return sorted[sorted.length - 1]?.id ?? null;
  }, [selectedPacket?.messages]);

  const selectedHeaderIntent = useMemo(() => {
    if (!selectedPacket) return null;
    return inferLocalIntentFromText(packetStitchedPlainText(selectedPacket.stitched_content));
  }, [selectedPacket]);

  if (loading) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        aria-busy="true"
        aria-live="polite"
        aria-label="Loading WhatsApp inbox"
      >
        <div className="text-center">
          <MessageCircle className="mx-auto mb-4 h-12 w-12 animate-spin text-green-500" />
          <p className="text-gray-600">Loading conversations…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100">
      <OperatorInboxObservabilityPanel
        snapshot={observability.snapshot}
        loading={observability.loading}
        medianLagSecondsFromThreads={medianLagSecondsFromThreads}
      />
      <div className="flex min-h-0 flex-1">
        <div className="flex w-full max-w-md flex-col overflow-hidden border-r border-gray-300 bg-white">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
            <h2 className="text-xl font-bold text-gray-900">WhatsApp Inbox</h2>
            <p className="text-sm text-gray-500">
              {orderedPackets.length} shown · {packets.length} open
              {pinnedIds.length > 0 ? ` · ${pinnedIds.length} pinned` : ""}
            </p>
            <div className="mt-3 space-y-2">
              <Input
                type="search"
                placeholder="Search name, phone, preview…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-9 text-sm"
                aria-label="Filter packets"
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  id="operator-inbox-unanswered-only"
                  checked={unansweredOnly}
                  onCheckedChange={(v) => setUnansweredOnly(v === true)}
                />
                <label htmlFor="operator-inbox-unanswered-only" className="text-xs text-gray-600">
                  Unanswered only (last message inbound)
                </label>
              </div>
            </div>
            {isRefreshing ? (
              <p className="mt-1 text-xs text-green-700" role="status">
                Syncing list…
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="border-b border-red-200 bg-red-50 p-4">
              <p className="text-sm font-medium text-red-800">Could not load inbox</p>
              <p className="mt-1 text-sm text-red-700">{error}</p>
              <button
                type="button"
                className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                onClick={() => void loadPackets()}
              >
                Retry
              </button>
            </div>
          ) : null}

          {!error && packets.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-gray-500">
              <MessageCircle className="mb-4 h-12 w-12 opacity-50" aria-hidden />
              <p className="font-medium text-gray-700">No open conversations</p>
              <p className="mt-2 max-w-xs text-sm">When new stitched packets arrive, they will appear here.</p>
            </div>
          ) : null}

          {!error && packets.length > 0 && orderedPackets.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-gray-500">
              <p className="text-sm font-medium text-gray-700">No packets match your filters</p>
              <button
                type="button"
                className="mt-3 text-xs font-medium text-green-700 underline"
                onClick={() => {
                  setFilterQuery("");
                  setUnansweredOnly(false);
                }}
              >
                Clear filters
              </button>
            </div>
          ) : null}

          {!error && packets.length > 0 && orderedPackets.length > 0 ? (
            <div className="flex-1 overflow-y-auto">
              {orderedPackets.map((packet) => {
                const stitchedText = packetStitchedPlainText(packet.stitched_content);
                const intent = inferLocalIntentFromText(stitchedText);
                const selected = selectedPacket?.id === packet.id;
                return (
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
                    className={cn(
                      "cursor-pointer border-b border-gray-200 p-4 transition",
                      selected ? "border-l-4 border-l-green-500 bg-green-50" : cn("border-l-4", operatorInboxIntentRowBorderClass(intent.tone), "hover:bg-gray-50"),
                    )}
                  >
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate font-semibold text-gray-900">{packet.customer_name}</p>
                          <OperatorInboxIntentDot tone={intent.tone} label={intent.label} />
                        </div>
                        <p className="truncate text-xs text-gray-500">{packet.phone_number}</p>
                        <SidebarPacketMeta packet={packet} />
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          className={cn(
                            "rounded p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-900",
                            pinnedIds.includes(packet.id) && "text-amber-700",
                          )}
                          title={pinnedIds.includes(packet.id) ? "Unpin" : "Pin (local)"}
                          aria-pressed={pinnedIds.includes(packet.id)}
                          onClick={(e) => togglePin(packet.id, e)}
                        >
                          <Pin className={cn("h-4 w-4", pinnedIds.includes(packet.id) && "fill-amber-200")} aria-hidden />
                        </button>
                        <ChevronRight className="h-5 w-5 text-gray-400" aria-hidden />
                      </div>
                    </div>

                    <p className="mb-2 line-clamp-2 text-sm text-gray-600">{packetPreviewSummary(packet)}</p>

                    <div className="flex items-center justify-between">
                      <span className="inline-block rounded bg-green-100 px-2 py-1 text-xs font-medium text-green-800">
                        {packet.fragment_count} fragments
                      </span>
                      <span className="flex items-center text-xs text-gray-500">
                        <Clock className="mr-1 h-3 w-3" aria-hidden />
                        {formatDistanceToNow(new Date(packet.last_message_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>

        {selectedPacket ? (
          <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
            <OperatorInboxGovernanceBar />
            <OperatorInboxRefreshingBanner isRefreshing={isRefreshing} refreshError={refreshError} />

            <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-green-50 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-green-900/80">Contact / sender</p>
                  <h3 className="text-lg font-bold text-gray-900">{selectedPacket.customer_name}</h3>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {selectedHeaderIntent ? (
                    <OperatorInboxIntentDot tone={selectedHeaderIntent.tone} label={selectedHeaderIntent.label} />
                  ) : null}
                  <OperatorInboxPacketHealthBadge
                    health={inferPacketHealth(selectedPacket.last_message_at, selectedPacket.messages ?? [])}
                  />
                </div>
              </div>
              <p className="text-sm text-gray-700">WhatsApp: {selectedPacket.phone_number}</p>
              {selectedPacket.wa_contact_id ? (
                <p className="text-xs text-gray-500">WA id: {selectedPacket.wa_contact_id}</p>
              ) : null}
              <p className="mt-2 text-xs text-gray-600">
                Company or profile name above comes from <code className="rounded bg-white/80 px-1">whatsapp_contacts</code>{" "}
                only (no order join in this view).
              </p>
              <div className="mt-3">
                <OperatorInboxPacketBadges
                  packetStatus={selectedPacket.status}
                  fragmentCount={selectedPacket.fragment_count}
                  messages={selectedPacket.messages ?? []}
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col border-gray-200 lg:border-r">
                <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-3">
                  <p className="mb-2 text-xs font-medium text-gray-500">
                    Edge suggestions (on demand — not saved until governance allows persistence)
                  </p>
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
                  {suggestionsError ? (
                    <p className="mt-2 text-sm text-red-600" role="alert">
                      {suggestionsError}
                    </p>
                  ) : null}
                  {intentResult ? (
                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                      <p className="font-semibold text-gray-900">Intent (Edge suggestion)</p>
                      <p className="mt-1">
                        <span className="text-gray-500">Type:</span> {intentResult.intent_type}
                      </p>
                      <p>
                        <span className="text-gray-500">Confidence:</span> {intentResult.confidence}
                      </p>
                      {intentResult.keywords?.length > 0 ? (
                        <p>
                          <span className="text-gray-500">Keywords:</span> {intentResult.keywords.join(", ")}
                        </p>
                      ) : null}
                      <p className="mt-1 text-xs text-gray-600">
                        <span className="text-gray-500">Metadata:</span>{" "}
                        {JSON.stringify(intentResult.metadata ?? {})}
                      </p>
                    </div>
                  ) : null}
                  {routeResult ? (
                    <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-3 text-sm text-gray-800">
                      <p className="font-semibold text-gray-900">Route (Edge suggestion)</p>
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
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
                  {selectedPacket.messages && selectedPacket.messages.length > 0 ? (
                    groupMessagesByDay(selectedPacket.messages).map((group) => (
                      <div key={group.dayKey}>
                        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          {group.dayLabel}
                        </p>
                        <div className="space-y-3">
                          {messagePairsWithGapMarkers(group.messages).map(({ message: msg, showGap }) => (
                            <div key={msg.id}>
                              {showGap ? (
                                <div className="flex justify-center py-2" role="separator">
                                  <span className="rounded-full bg-gray-100 px-3 py-0.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
                                    Long gap
                                  </span>
                                </div>
                              ) : null}
                              <div
                                className={`flex ${msg.direction === "inbound" ? "justify-start" : "justify-end"}`}
                              >
                                <div
                                  className={cn(
                                    "max-w-[min(100%,20rem)] rounded-lg px-4 py-2",
                                    msg.direction === "inbound" ? "bg-gray-200 text-gray-900" : "bg-green-500 text-white",
                                    msg.id === highlightInboundMessageId &&
                                      msg.direction === "inbound" &&
                                      "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-100",
                                  )}
                                >
                                  <div className="mb-1 flex flex-wrap gap-1">
                                    <Badge
                                      variant="secondary"
                                      className={`h-5 px-1.5 text-[10px] font-normal ${
                                        msg.direction === "inbound" ? "" : "bg-white/20 text-white"
                                      }`}
                                    >
                                      {msg.direction}
                                    </Badge>
                                    {msg.status ? (
                                      <Badge
                                        variant="outline"
                                        className={`h-5 px-1.5 text-[10px] font-normal ${
                                          msg.direction === "outbound" ? "border-white/40 text-white" : ""
                                        }`}
                                      >
                                        {msg.status}
                                      </Badge>
                                    ) : null}
                                    {msg.provider ? (
                                      <Badge
                                        variant="outline"
                                        className={`h-5 px-1.5 text-[10px] font-normal ${
                                          msg.direction === "outbound" ? "border-white/40 text-white" : ""
                                        }`}
                                      >
                                        {msg.provider}
                                      </Badge>
                                    ) : null}
                                    {msg.packet_sequence != null ? (
                                      <Badge
                                        variant="outline"
                                        className={`h-5 px-1.5 text-[10px] font-normal ${
                                          msg.direction === "outbound" ? "border-white/40 text-white" : ""
                                        }`}
                                      >
                                        #{msg.packet_sequence}
                                      </Badge>
                                    ) : null}
                                  </div>
                                  <p className="whitespace-pre-wrap text-sm">{msg.content ?? ""}</p>
                                  <p className="mt-1 text-xs opacity-70">
                                    {msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}
                                  </p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-gray-500">No messages in this packet</p>
                  )}
                </div>

                <div className="shrink-0 border-t border-gray-200 bg-gray-50 p-4">
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

              <aside className="w-full shrink-0 border-t border-gray-200 bg-slate-50/60 p-4 lg:sticky lg:top-0 lg:max-h-[min(100dvh,100%)] lg:w-80 lg:self-start lg:overflow-y-auto lg:border-l lg:border-t-0">
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-600">Read-only insights</h3>
                <div className="space-y-4">
                  <OperatorInboxCustomerActivitySummary messages={selectedPacket.messages ?? []} />
                  <OperatorInboxLocalExplanationCards
                    messages={selectedPacket.messages ?? []}
                    lastMessageAtIso={selectedPacket.last_message_at}
                  />
                  <OperatorInboxLocalDraftPreview messages={selectedPacket.messages ?? []} />
                  <OperatorInboxLocalAiPreviewPanel messages={selectedPacket.messages ?? []} />
                </div>
              </aside>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50 p-6 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-gray-300" aria-hidden />
            <p className="text-gray-600">Select a conversation to open the operator dashboard</p>
            {packets.length === 0 && !error ? (
              <p className="mt-2 max-w-sm text-sm text-gray-500">There are no open packets right now.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

export default WhatsAppInbox;
