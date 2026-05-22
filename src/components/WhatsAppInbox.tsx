// src/components/WhatsAppInbox.tsx
// TOOL 1: Raw WhatsApp Inbox — Display stitched packets as conversations

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { OperatorInboxPacket } from "@/components/whatsapp/operatorInboxTypes";
import {
  groupMessagesByDay,
  inferLocalIntentFromText,
  inferPacketHealth,
  isLastMessageInboundUnanswered,
  medianResponseLagSeconds,
  messagePairsWithGapMarkers,
  operatorInboxPacketPreviewSummary,
  packetStitchedPlainText,
  type LocalIntentTone,
  type PacketAgeBucket,
  type PacketHealth,
} from "@/components/whatsapp/operatorInboxUtils";
import {
  EMPTY_INBOX_BULK_FILTERS,
  packetMatchesBulkFilters,
  type OperatorInboxBulkFilters,
} from "@/components/whatsapp/operatorInboxBulkFilter";
import { fetchMessagesForPacketIdsBatch } from "@/components/whatsapp/operatorInboxMessagesBatch";
import {
  loadOperatorInboxUiState,
  normalizePersistedBulkFilters,
  saveOperatorInboxUiState,
} from "@/components/whatsapp/operatorInboxUiPersistence";
import { OperatorInboxLoadingShell } from "@/components/whatsapp/OperatorInboxSkeletons";
import {
  OperatorInboxVirtualizedPacketList,
  type OperatorInboxVirtualizedPacketListHandle,
} from "@/components/whatsapp/OperatorInboxVirtualizedPacketList";
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

const REALTIME_CHANNEL = "whatsapp-inbox-packets";
const PACKET_FETCH_LIMIT = 1000;
const REALTIME_RELOAD_DEBOUNCE_MS = 480;

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
  const [packets, setPackets] = useState<OperatorInboxPacket[]>([]);
  const [selectedPacket, setSelectedPacket] = useState<OperatorInboxPacket | null>(null);
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
  const [bulkFilters, setBulkFilters] = useState<OperatorInboxBulkFilters>({ ...EMPTY_INBOX_BULK_FILTERS });
  const [uiHydrated, setUiHydrated] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [obsRefreshKey, setObsRefreshKey] = useState(0);
  const observability = useOperatorInboxObservability(obsRefreshKey);
  const packetListVirtualRef = useRef<OperatorInboxVirtualizedPacketListHandle>(null);
  const [messagesBatchWarnings, setMessagesBatchWarnings] = useState<string[]>([]);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const realtimeDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    const saved = loadOperatorInboxUiState();
    if (saved) {
      if (typeof saved.filterQuery === "string") setFilterQuery(saved.filterQuery);
      if (typeof saved.unansweredOnly === "boolean") setUnansweredOnly(saved.unansweredOnly);
      if (Array.isArray(saved.pinnedIds)) setPinnedIds(saved.pinnedIds);
      setBulkFilters(normalizePersistedBulkFilters(saved.bulkFilters));
    }
    setUiHydrated(true);
  }, []);

  useEffect(() => {
    if (!uiHydrated) return;
    const t = window.setTimeout(() => {
      saveOperatorInboxUiState({ filterQuery, unansweredOnly, pinnedIds, bulkFilters });
    }, 360);
    return () => window.clearTimeout(t);
  }, [filterQuery, unansweredOnly, pinnedIds, bulkFilters, uiHydrated]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setIsNarrow(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        filterInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
      setMessagesBatchWarnings([]);
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
        .limit(PACKET_FETCH_LIMIT);

      if (packetsError) throw packetsError;

      const rows = (packetsData ?? []) as unknown as OperatorInboxPacket[];
      const ids = rows.map((r) => r.id);
      const { byPacket: messagesByPacket, errors: batchMessageErrors } = await fetchMessagesForPacketIdsBatch(ids);
      if (batchMessageErrors.length > 0) {
        setMessagesBatchWarnings(batchMessageErrors);
      }

      const enrichedPackets = rows.map((packet) => {
        const contact = packet.whatsapp_contacts;
        const messages = messagesByPacket.get(packet.id) ?? [];
        return {
          ...packet,
          messages,
          customer_name: contact?.customer_name ?? "Unknown",
          phone_number: contact?.phone_number ?? "---",
          wa_contact_id: contact?.wa_contact_id ?? null,
        };
      });

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

  const scheduleRealtimeReload = useCallback(() => {
    if (realtimeDebounceRef.current) window.clearTimeout(realtimeDebounceRef.current);
    realtimeDebounceRef.current = window.setTimeout(() => {
      realtimeDebounceRef.current = null;
      void loadPackets({ silent: true });
    }, REALTIME_RELOAD_DEBOUNCE_MS);
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
          scheduleRealtimeReload();
        },
      )
      .subscribe();

    return () => {
      if (realtimeDebounceRef.current) window.clearTimeout(realtimeDebounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [loadPackets, scheduleRealtimeReload]);

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
      if (!packetMatchesBulkFilters(p, bulkFilters)) return false;
      if (unansweredOnly && !isLastMessageInboundUnanswered(p.messages ?? [])) return false;
      if (!q) return true;
      const preview = operatorInboxPacketPreviewSummary(p).toLowerCase();
      return (
        (p.customer_name ?? "").toLowerCase().includes(q) ||
        (p.phone_number ?? "").toLowerCase().includes(q) ||
        preview.includes(q)
      );
    });
  }, [packets, filterQuery, unansweredOnly, bulkFilters]);

  const orderedPackets = useMemo(() => {
    const pinSet = new Set(pinnedIds);
    return [...filteredPackets].sort((a, b) => {
      const ap = pinSet.has(a.id) ? 1 : 0;
      const bp = pinSet.has(b.id) ? 1 : 0;
      if (ap !== bp) return bp - ap;
      return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
    });
  }, [filteredPackets, pinnedIds]);

  const onPacketListKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (orderedPackets.length === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Home" || e.key === "End") {
        const cur = selectedPacket ? orderedPackets.findIndex((x) => x.id === selectedPacket.id) : -1;
        let next = cur < 0 ? 0 : cur;
        if (e.key === "ArrowDown") {
          e.preventDefault();
          next = cur < 0 ? 0 : Math.min(orderedPackets.length - 1, cur + 1);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          next = cur <= 0 ? 0 : cur - 1;
        } else if (e.key === "Home") {
          e.preventDefault();
          next = 0;
        } else if (e.key === "End") {
          e.preventDefault();
          next = orderedPackets.length - 1;
        }
        const p = orderedPackets[next];
        if (p) {
          setSelectedPacket(p);
          window.requestAnimationFrame(() => {
            packetListVirtualRef.current?.scrollToIndex(next);
          });
        }
      }
    },
    [orderedPackets, selectedPacket],
  );

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
    return <OperatorInboxLoadingShell />;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-100">
      <a
        href="#operator-inbox-packet-list"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
      >
        Skip to packet list
      </a>
      <div className="sr-only" aria-live="polite">
        {orderedPackets.length} packets match the current filters out of {packets.length} loaded.
      </div>
      <OperatorInboxObservabilityPanel
        snapshot={observability.snapshot}
        loading={observability.loading}
        medianLagSecondsFromThreads={medianLagSecondsFromThreads}
      />
      <div className={cn("flex min-h-0 flex-1", isNarrow ? "flex-col" : "flex-row")}>
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-gray-300 bg-white lg:border-r",
            "w-full max-w-none lg:max-w-md",
            isNarrow && selectedPacket ? "hidden lg:flex" : "flex",
          )}
        >
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white p-4">
            <h2 className="text-xl font-bold text-gray-900" id="operator-inbox-heading">
              WhatsApp Inbox
            </h2>
            <p className="text-sm text-gray-500" aria-describedby="operator-inbox-heading">
              {orderedPackets.length} shown · {packets.length} loaded (open)
              {pinnedIds.length > 0 ? ` · ${pinnedIds.length} pinned` : ""}
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Press <kbd className="rounded border bg-gray-100 px-1">/</kbd> to focus search. Use arrow keys when the
              list is focused.
            </p>
            <div className="mt-3 space-y-3">
              <Input
                ref={filterInputRef}
                type="search"
                placeholder="Search name, phone, preview…"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                className="h-9 text-sm"
                aria-label="Filter packets by name, phone, or preview text"
                autoComplete="off"
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

              <div className="space-y-2 rounded-md border border-gray-100 bg-gray-50/80 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Bulk filters (local)</p>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500">Health</p>
                  <ToggleGroup
                    type="multiple"
                    className="flex flex-wrap justify-start gap-1"
                    value={bulkFilters.healthAnyOf}
                    onValueChange={(v) =>
                      setBulkFilters((prev) => ({ ...prev, healthAnyOf: v as PacketHealth[] }))
                    }
                    aria-label="Filter by packet health"
                  >
                    {(
                      [
                        ["healthy", "OK"],
                        ["needs_reply", "Reply"],
                        ["stale_open", "Stale"],
                        ["operator_issue", "Fail"],
                      ] as const
                    ).map(([val, label]) => (
                      <ToggleGroupItem key={val} value={val} className="h-7 px-2 text-[10px]">
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500">Age</p>
                  <ToggleGroup
                    type="multiple"
                    className="flex flex-wrap justify-start gap-1"
                    value={bulkFilters.ageAnyOf}
                    onValueChange={(v) =>
                      setBulkFilters((prev) => ({ ...prev, ageAnyOf: v as PacketAgeBucket[] }))
                    }
                    aria-label="Filter by last activity age"
                  >
                    {(
                      [
                        ["fresh", "<15m"],
                        ["active", "<2h"],
                        ["aging", "<24h"],
                        ["stale", "24h+"],
                      ] as const
                    ).map(([val, label]) => (
                      <ToggleGroupItem key={val} value={val} className="h-7 px-2 text-[10px]">
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-500">Intent (keywords)</p>
                  <ToggleGroup
                    type="multiple"
                    className="flex flex-wrap justify-start gap-1"
                    value={bulkFilters.intentToneAnyOf}
                    onValueChange={(v) =>
                      setBulkFilters((prev) => ({ ...prev, intentToneAnyOf: v as LocalIntentTone[] }))
                    }
                    aria-label="Filter by local intent tone"
                  >
                    {(
                      [
                        ["slate", "Gen"],
                        ["blue", "Log"],
                        ["violet", "Bill"],
                        ["emerald", "Price"],
                        ["rose", "Sup"],
                        ["amber", "Urg"],
                      ] as const
                    ).map(([val, label]) => (
                      <ToggleGroupItem key={val} value={val} className="h-7 px-2 text-[10px]">
                        {label}
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                </div>
                {(bulkFilters.healthAnyOf.length > 0 ||
                  bulkFilters.ageAnyOf.length > 0 ||
                  bulkFilters.intentToneAnyOf.length > 0) && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[10px] text-gray-600"
                    onClick={() => setBulkFilters({ ...EMPTY_INBOX_BULK_FILTERS })}
                  >
                    Clear bulk filters
                  </Button>
                )}
              </div>
            </div>
            {isRefreshing ? (
              <p className="mt-1 text-xs text-green-700" role="status">
                Syncing list…
              </p>
            ) : null}
          </div>

          {error ? (
            <div className="border-b border-red-200 bg-red-50 p-4" role="alert">
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

          {!error && messagesBatchWarnings.length > 0 ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-950" role="status">
              <p className="font-medium text-amber-900">Some message history loaded partially</p>
              <ul className="mt-1 list-inside list-disc text-amber-900/90">
                {messagesBatchWarnings.map((w, idx) => (
                  <li key={`${idx}-${w.slice(0, 80)}`}>{w}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {!error && packets.length === 0 ? (
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-gray-500"
              role="status"
            >
              <MessageCircle className="h-14 w-14 opacity-40" aria-hidden />
              <div>
                <p className="text-base font-semibold text-gray-800">Inbox is clear</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed">
                  There are no open stitched packets right now. When customers message and the stitcher groups their
                  fragments, threads will appear here automatically.
                </p>
              </div>
              <p className="max-w-sm text-xs text-gray-500">
                If you expected traffic, confirm realtime is connected (no errors above) and that packets are still
                marked <span className="font-medium">open</span> in the database.
              </p>
            </div>
          ) : null}

          {!error && packets.length > 0 && orderedPackets.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-gray-600">
              <p className="text-sm font-semibold text-gray-800">No packets match these filters</p>
              <p className="max-w-xs text-xs text-gray-500">
                Try clearing search, unanswered-only, or bulk filters. Pinned packets still respect text search and
                bulk rules.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilterQuery("");
                  setUnansweredOnly(false);
                  setBulkFilters({ ...EMPTY_INBOX_BULK_FILTERS });
                }}
              >
                Reset all filters
              </Button>
            </div>
          ) : null}

          {!error && packets.length > 0 && orderedPackets.length > 0 ? (
            <div
              id="operator-inbox-packet-list"
              ref={listScrollRef}
              tabIndex={0}
              role="listbox"
              aria-label="Open WhatsApp packets"
              aria-multiselectable={false}
              onKeyDown={onPacketListKeyDown}
              className="min-h-0 flex-1 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
            >
              <OperatorInboxVirtualizedPacketList
                ref={packetListVirtualRef}
                scrollRef={listScrollRef}
                orderedPackets={orderedPackets}
                selectedPacketId={selectedPacket?.id ?? null}
                pinnedIds={pinnedIds}
                onSelect={setSelectedPacket}
                onPin={togglePin}
              />
            </div>
          ) : null}
        </div>

        {selectedPacket ? (
          <div
            className="flex min-h-0 min-w-0 flex-1 flex-col bg-white"
            role="region"
            aria-label="Selected WhatsApp packet"
          >
            <OperatorInboxGovernanceBar />
            <OperatorInboxRefreshingBanner isRefreshing={isRefreshing} refreshError={refreshError} />

            <div className="sticky top-0 z-20 shrink-0 border-b border-gray-200 bg-green-50 p-4 shadow-sm">
              {isNarrow ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="mb-2 -ml-2 h-10 px-2 text-gray-800 lg:hidden"
                  onClick={() => setSelectedPacket(null)}
                >
                  <ArrowLeft className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                  All packets
                </Button>
              ) : null}
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
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50 p-6 text-center",
              isNarrow ? "hidden lg:flex" : "flex",
            )}
            role="region"
            aria-label="Packet list placeholder"
          >
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
