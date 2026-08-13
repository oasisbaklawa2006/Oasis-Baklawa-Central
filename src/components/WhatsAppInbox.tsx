// src/components/WhatsAppInbox.tsx
// TOOL 1: Raw WhatsApp Inbox — Display stitched packets as conversations

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Download, MessageCircle, Paperclip } from "lucide-react";
import { removeDuplicateRealtimeChannel } from "@/utils/realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { OperatorInboxPacket } from "@/components/whatsapp/operatorInboxTypes";
import {
  groupMessagesByDayWithGapMarkers,
  inferLocalIntentFromText,
  inferPacketHealth,
  isLastMessageInboundUnanswered,
  medianResponseLagSeconds,
  messageHasAttachmentHint,
  operatorInboxPacketPreviewSummary,
  packetStitchedPlainText,
  packetSlaUiMeta,
  sortMessagesChronological,
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
import { buildVisiblePacketsCsv, downloadOperatorInboxCsv } from "@/components/whatsapp/operatorInboxCsvExport";
import {
  addSavedView,
  loadSavedViews,
  removeSavedView,
  type OperatorInboxSavedView,
  type OperatorInboxSavedViewSnapshot,
} from "@/components/whatsapp/operatorInboxSavedViews";
import {
  loadPacketNotesMap,
  persistPacketNotesMap,
  type OperatorInboxPacketNotesMap,
} from "@/components/whatsapp/operatorInboxLocalNotes";
import { OperatorInboxLoadingShell } from "@/components/whatsapp/OperatorInboxSkeletons";
import {
  OperatorInboxVirtualizedPacketList,
  type OperatorInboxVirtualizedPacketListHandle,
} from "@/components/whatsapp/OperatorInboxVirtualizedPacketList";
import {
  OperatorInboxCustomerActivitySummary,
  OperatorInboxFailedMessagesReadOnlyPanel,
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
import { OperatorInboxOperationalContextPanel } from "@/components/whatsapp/OperatorInboxOperationalContextPanel";
import { OperatorInboxSenderIdentityPanel } from "@/components/whatsapp/OperatorInboxSenderIdentityPanel";
import { useOperatorInboxSenderIdentity } from "@/components/whatsapp/useOperatorInboxSenderIdentity";
import { OperatorInboxClientResolutionPanel } from "@/components/whatsapp/OperatorInboxClientResolutionPanel";
import { useOperatorInboxClientResolution } from "@/components/whatsapp/useOperatorInboxClientResolution";
import { OperatorInboxProductResolutionPanel } from "@/components/whatsapp/OperatorInboxProductResolutionPanel";
import { useOperatorInboxProductResolution } from "@/components/whatsapp/useOperatorInboxProductResolution";
import { OperatorInboxQuantityResolutionPanel } from "@/components/whatsapp/OperatorInboxQuantityResolutionPanel";
import { useOperatorInboxQuantityResolution } from "@/components/whatsapp/useOperatorInboxQuantityResolution";
import { OperatorInboxDraftOrderPanel } from "@/components/whatsapp/OperatorInboxDraftOrderPanel";
import { OperatorInboxSalesOrderDraftSection } from "@/components/whatsapp/OperatorInboxSalesOrderDraftSection";
import {
  getDraftOrderLocalEdits,
  setDraftOrderLineQuantity,
} from "@/components/whatsapp/operatorInboxDraftOrderLocalState";
import { useOperatorInboxDraftOrderExtraction } from "@/components/whatsapp/useOperatorInboxDraftOrderExtraction";
import { useOperatorInboxSalesOrderDraft } from "@/components/whatsapp/useOperatorInboxSalesOrderDraft";
import { buildWhatsAppOperationalFeed, normalizeWhatsAppEvents } from "@/lib/operational-events";
import { Wa1PotentialOrderQueueStrip } from "@/components/whatsapp/Wa1PotentialOrderQueueStrip";
import { Wa3ClarificationQueueStrip } from "@/components/whatsapp/Wa3ClarificationQueueStrip";
import { useWhatsAppPermissions } from "@/hooks/useWhatsAppPermissions";

const REALTIME_CHANNEL = "whatsapp-inbox-packets";
const PACKET_FETCH_LIMIT = 1000;
const REALTIME_RELOAD_DEBOUNCE_MS = 480;

function isTypingSurfaceForEsc(el: HTMLElement | null): boolean {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable;
}

/** Global `/` and `j`/`k` should not steal keys from toolbar controls or form fields. */
function shouldIgnoreGlobalInboxShortcuts(el: HTMLElement | null): boolean {
  if (!el) return false;
  if (el.closest("[data-operator-inbox-interactive]")) return true;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON" || tag === "A") return true;
  if (el.isContentEditable) return true;
  const role = el.getAttribute("role");
  if (
    role === "button" ||
    role === "checkbox" ||
    role === "tab" ||
    role === "switch" ||
    role === "menuitem"
  ) {
    return true;
  }
  return false;
}

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
  const whatsappAuthority = useWhatsAppPermissions();
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
  const [compactMode, setCompactMode] = useState(false);
  const [showObservabilityStrip, setShowObservabilityStrip] = useState(true);
  const [showAiPreviewPanel, setShowAiPreviewPanel] = useState(true);
  /** Collapsible read-only insights column (Esc when open; respects user collapse). */
  const [insightsAsideExpanded, setInsightsAsideExpanded] = useState(true);
  /** When true, do not auto-expand insights on packet change until user clicks Show. */
  const [insightsAsideUserCollapsed, setInsightsAsideUserCollapsed] = useState(false);
  const [savedViews, setSavedViews] = useState<OperatorInboxSavedView[]>([]);
  const [savedViewNameDraft, setSavedViewNameDraft] = useState("");
  const [packetNotes, setPacketNotes] = useState<OperatorInboxPacketNotesMap>(() => {
    if (typeof window === "undefined") return {};
    return loadPacketNotesMap();
  });
  const [selectionAnnouncement, setSelectionAnnouncement] = useState("");
  const [obsRefreshKey, setObsRefreshKey] = useState(0);
  const observability = useOperatorInboxObservability(obsRefreshKey);
  const senderIdentityState = useOperatorInboxSenderIdentity(selectedPacket);
  const { state: clientResolutionState, requestKey: clientResolutionRequestKey } =
    useOperatorInboxClientResolution(selectedPacket, senderIdentityState);
  const { state: productResolutionState, requestKey: productResolutionRequestKey } =
    useOperatorInboxProductResolution(
      selectedPacket,
      senderIdentityState,
      clientResolutionState,
    );
  const { state: quantityResolutionState, requestKey: quantityResolutionRequestKey } =
    useOperatorInboxQuantityResolution(
      selectedPacket,
      senderIdentityState,
      clientResolutionState,
      productResolutionState,
    );
  const { state: draftOrderExtractionState, requestKey: draftOrderExtractionRequestKey } =
    useOperatorInboxDraftOrderExtraction(
      selectedPacket,
      senderIdentityState,
      clientResolutionState,
      productResolutionState,
      quantityResolutionState,
    );
  const [draftOrderLineQuantities, setDraftOrderLineQuantities] = useState<Record<number, number>>(
    {},
  );

  useEffect(() => {
    if (!selectedPacket) {
      setDraftOrderLineQuantities({});
      return;
    }
    setDraftOrderLineQuantities(getDraftOrderLocalEdits(selectedPacket.id).lineQuantities);
  }, [selectedPacket?.id]);

  const handleDraftOrderLineQuantityChange = useCallback(
    (lineIndex: number, quantity: number) => {
      if (!selectedPacket) return;
      setDraftOrderLineQuantity(selectedPacket.id, lineIndex, quantity);
      setDraftOrderLineQuantities((current) => ({ ...current, [lineIndex]: quantity }));
    },
    [selectedPacket?.id],
  );

  const handleDraftOrderLineQuantitiesReset = useCallback(() => {
    setDraftOrderLineQuantities({});
  }, []);

  const salesOrderDraftHook = useOperatorInboxSalesOrderDraft({
    packetId: selectedPacket?.id ?? null,
    extracted:
      draftOrderExtractionState.status === "ready" ? draftOrderExtractionState.draft : null,
    operatorLineQuantities: draftOrderLineQuantities,
    user,
    enabled: Boolean(selectedPacket?.id),
  });
  const packetListVirtualRef = useRef<OperatorInboxVirtualizedPacketListHandle>(null);
  const [messagesBatchWarnings, setMessagesBatchWarnings] = useState<string[]>([]);
  const inboxLoadGenerationRef = useRef(0);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const filterInputRef = useRef<HTMLInputElement | null>(null);
  const filterQueryRef = useRef(filterQuery);
  filterQueryRef.current = filterQuery;
  const realtimeDebounceRef = useRef<number | null>(null);

  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      persistPacketNotesMap(packetNotes);
    }, 480);
    return () => window.clearTimeout(t);
  }, [packetNotes]);

  useEffect(() => {
    if (!selectedPacket) {
      setSelectionAnnouncement("No conversation selected.");
      return;
    }
    const name = selectedPacket.customer_name ?? "Unknown contact";
    const phone = selectedPacket.phone_number ?? "";
    setSelectionAnnouncement(
      `Selected conversation ${name}${phone ? `, ${phone}` : ""}. Packet id ${selectedPacket.id}.`,
    );
  }, [selectedPacket]);

  useEffect(() => {
    const saved = loadOperatorInboxUiState();
    if (saved) {
      if (typeof saved.filterQuery === "string") setFilterQuery(saved.filterQuery);
      if (typeof saved.unansweredOnly === "boolean") setUnansweredOnly(saved.unansweredOnly);
      if (Array.isArray(saved.pinnedIds)) setPinnedIds(saved.pinnedIds);
      setBulkFilters(normalizePersistedBulkFilters(saved.bulkFilters));
      if (typeof saved.compactMode === "boolean") setCompactMode(saved.compactMode);
      if (typeof saved.showObservabilityStrip === "boolean") setShowObservabilityStrip(saved.showObservabilityStrip);
      if (typeof saved.showAiPreviewPanel === "boolean") setShowAiPreviewPanel(saved.showAiPreviewPanel);
    }
    setUiHydrated(true);
  }, []);

  useEffect(() => {
    if (!uiHydrated) return;
    const t = window.setTimeout(() => {
      saveOperatorInboxUiState({
        filterQuery,
        unansweredOnly,
        pinnedIds,
        bulkFilters,
        compactMode,
        showObservabilityStrip,
        showAiPreviewPanel,
      });
    }, 360);
    return () => window.clearTimeout(t);
  }, [
    filterQuery,
    unansweredOnly,
    pinnedIds,
    bulkFilters,
    compactMode,
    showObservabilityStrip,
    showAiPreviewPanel,
    uiHydrated,
  ]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const fn = () => setIsNarrow(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
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
    const gen = ++inboxLoadGenerationRef.current;
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

      if (gen !== inboxLoadGenerationRef.current) return;

      if (batchMessageErrors.length > 0) {
        setMessagesBatchWarnings(batchMessageErrors);
      }

      setPackets(enrichedPackets);

      const prevId = selectedPacketIdRef.current;
      let nextSelected: OperatorInboxPacket | null = null;
      if (prevId) {
        nextSelected = enrichedPackets.find((p) => p.id === prevId) ?? null;
        if (!nextSelected && enrichedPackets.length > 0) {
          nextSelected = enrichedPackets[0] ?? null;
        }
      }
      setSelectedPacket(nextSelected);

      setError(null);
      setRefreshError(null);
      setObsRefreshKey((k) => k + 1);
    } catch (err) {
      if (gen !== inboxLoadGenerationRef.current) return;
      const msg = err instanceof Error ? err.message : "Failed to load inbox";
      if (silent) {
        setRefreshError(msg);
      } else {
        setError(msg);
        console.error("Inbox error:", err);
      }
    } finally {
      if (gen === inboxLoadGenerationRef.current) {
        setIsRefreshing(false);
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

  const selectPacketAtIndex = useCallback(
    (index: number) => {
      if (orderedPackets.length === 0) return;
      const clamped = Math.max(0, Math.min(orderedPackets.length - 1, index));
      const p = orderedPackets[clamped];
      if (p) {
        setSelectedPacket(p);
        window.requestAnimationFrame(() => {
          packetListVirtualRef.current?.scrollToIndex(clamped);
        });
      }
    },
    [orderedPackets],
  );

  const moveSelectionBy = useCallback(
    (delta: number) => {
      if (orderedPackets.length === 0) return;
      const cur = selectedPacket ? orderedPackets.findIndex((x) => x.id === selectedPacket.id) : -1;
      const base = cur < 0 ? (delta > 0 ? -1 : 0) : cur;
      selectPacketAtIndex(base + delta);
    },
    [orderedPackets, selectedPacket, selectPacketAtIndex],
  );

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;

      if (e.key === "Escape") {
        if (isTypingSurfaceForEsc(t) && t !== filterInputRef.current) {
          return;
        }
        if (filterQueryRef.current.trim()) {
          e.preventDefault();
          setFilterQuery("");
          return;
        }
        if (insightsAsideExpanded) {
          e.preventDefault();
          setInsightsAsideExpanded(false);
          setInsightsAsideUserCollapsed(true);
        }
        return;
      }

      if (shouldIgnoreGlobalInboxShortcuts(t)) return;

      if (e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        filterInputRef.current?.focus();
        return;
      }
      if ((e.key === "j" || e.key === "J") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        moveSelectionBy(1);
        return;
      }
      if ((e.key === "k" || e.key === "K") && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        moveSelectionBy(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [moveSelectionBy, insightsAsideExpanded]);

  /** Keep detail pane aligned with the filtered list (drop selection if the thread is hidden by filters). */
  useEffect(() => {
    if (!selectedPacket) return;
    if (orderedPackets.some((p) => p.id === selectedPacket.id)) return;
    setSelectedPacket(orderedPackets[0] ?? null);
  }, [orderedPackets, selectedPacket]);

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
        selectPacketAtIndex(next);
      }
    },
    [orderedPackets, selectedPacket, selectPacketAtIndex],
  );

  const highlightInboundMessageId = useMemo(() => {
    const m = selectedPacket?.messages ?? [];
    if (!isLastMessageInboundUnanswered(m)) return null;
    const sorted = sortMessagesChronological(m);
    return sorted[sorted.length - 1]?.id ?? null;
  }, [selectedPacket?.messages]);

  const selectedOperationalEvents = useMemo(() => {
    if (!selectedPacket) return [];
    return normalizeWhatsAppEvents(buildWhatsAppOperationalFeed({ packet: selectedPacket }));
  }, [selectedPacket]);

  const selectedHeaderIntent = useMemo(() => {
    if (!selectedPacket) return null;
    return inferLocalIntentFromText(packetStitchedPlainText(selectedPacket.stitched_content));
  }, [selectedPacket]);

  const hasBulkFilters = useMemo(
    () =>
      bulkFilters.healthAnyOf.length > 0 ||
      bulkFilters.ageAnyOf.length > 0 ||
      bulkFilters.intentToneAnyOf.length > 0,
    [bulkFilters],
  );

  const buildCurrentSavedViewSnapshot = useCallback((): OperatorInboxSavedViewSnapshot => {
    return {
      filterQuery,
      unansweredOnly,
      pinnedIds: [...pinnedIds],
      bulkFilters: {
        healthAnyOf: [...bulkFilters.healthAnyOf],
        ageAnyOf: [...bulkFilters.ageAnyOf],
        intentToneAnyOf: [...bulkFilters.intentToneAnyOf],
      },
      compactMode,
      showObservabilityStrip,
      showAiPreviewPanel,
    };
  }, [
    filterQuery,
    unansweredOnly,
    pinnedIds,
    bulkFilters,
    compactMode,
    showObservabilityStrip,
    showAiPreviewPanel,
  ]);

  const handleSaveCurrentView = useCallback(() => {
    const trimmed = savedViewNameDraft.trim();
    if (!trimmed) return;
    const snap = buildCurrentSavedViewSnapshot();
    setSavedViews((prev) => addSavedView(prev, trimmed, snap));
    setSavedViewNameDraft("");
  }, [savedViewNameDraft, buildCurrentSavedViewSnapshot]);

  const handleApplySavedView = useCallback((view: OperatorInboxSavedView) => {
    const s = view.snapshot;
    setFilterQuery(s.filterQuery);
    setUnansweredOnly(s.unansweredOnly);
    setPinnedIds([...s.pinnedIds]);
    setBulkFilters(normalizePersistedBulkFilters(s.bulkFilters));
    setCompactMode(s.compactMode);
    setShowObservabilityStrip(s.showObservabilityStrip);
    setShowAiPreviewPanel(s.showAiPreviewPanel);
  }, []);

  const handleDeleteSavedView = useCallback((id: string) => {
    setSavedViews((prev) => removeSavedView(prev, id));
  }, []);

  const handleExportVisibleCsv = useCallback(() => {
    const csv = buildVisiblePacketsCsv(orderedPackets);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    downloadOperatorInboxCsv(`operator-inbox-visible-packets-${stamp}.csv`, csv);
  }, [orderedPackets]);

  const handlePacketNoteChange = useCallback((packetId: string, text: string) => {
    setPacketNotes((prev) => ({
      ...prev,
      [packetId]: { text, updatedAt: new Date().toISOString() },
    }));
  }, []);

  const handleClearPacketNote = useCallback((packetId: string) => {
    setPacketNotes((prev) => {
      const next = { ...prev };
      delete next[packetId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!insightsAsideUserCollapsed) {
      setInsightsAsideExpanded(true);
    }
  }, [selectedPacket?.id, insightsAsideUserCollapsed]);

  useEffect(() => {
    packetListVirtualRef.current?.remeasureAll();
  }, [compactMode]);

  if (loading) {
    return <OperatorInboxLoadingShell />;
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-gray-100" role="main" aria-label="WhatsApp operator inbox">
      <a
        href="#operator-inbox-packet-list"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
      >
        Skip to packet list
      </a>
      <a
        href="#operator-inbox-detail-region"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-14 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow focus:outline-none focus:ring-2 focus:ring-green-600 focus:ring-offset-2"
      >
        Skip to conversation detail
      </a>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {selectionAnnouncement}
      </div>
      <Wa1PotentialOrderQueueStrip />
      <Wa3ClarificationQueueStrip />
      {showObservabilityStrip ? (
        <OperatorInboxObservabilityPanel
          snapshot={observability.snapshot}
          loading={observability.loading}
          medianLagSecondsFromThreads={medianLagSecondsFromThreads}
        />
      ) : null}
      <div className={cn("relative z-0 flex min-h-0 flex-1 isolate", isNarrow ? "flex-col" : "flex-row")}>
        <div
          className={cn(
            "flex min-h-0 flex-col overflow-hidden border-gray-300 bg-white lg:border-r",
            "w-full max-w-none lg:max-w-md",
            isNarrow &&
              "max-h-[min(46vh,26rem)] shrink-0 border-b border-gray-200 lg:max-h-none lg:shrink lg:border-b-0",
          )}
        >
          <div
            className="sticky top-0 z-20 border-b border-gray-200 bg-white/95 p-4 shadow-sm supports-[backdrop-filter]:backdrop-blur-sm"
            id="operator-inbox-filter-panel"
            data-operator-inbox-interactive
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-xl font-bold text-gray-900" id="operator-inbox-heading">
                WhatsApp Inbox
              </h2>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                onClick={handleExportVisibleCsv}
                disabled={orderedPackets.length === 0}
                aria-label="Download currently visible packet list as CSV"
              >
                <Download className="mr-1.5 h-4 w-4" aria-hidden />
                Export CSV
              </Button>
            </div>
            <p className="text-sm text-gray-500" aria-describedby="operator-inbox-heading">
              {orderedPackets.length} shown · {packets.length} loaded (open)
              {pinnedIds.length > 0 ? ` · ${pinnedIds.length} pinned` : ""}
            </p>
            <p className="text-[11px] text-gray-400">
              Same read-only inbox: <span className="font-mono text-gray-500">/admin/whatsapp</span> (URL alias).
            </p>
            <p className="mt-1 text-[11px] text-gray-500">
              Shortcuts: <kbd className="rounded border bg-gray-100 px-1">/</kbd>, <kbd className="rounded border bg-gray-100 px-1">Esc</kbd>,{" "}
              <kbd className="rounded border bg-gray-100 px-1">j</kbd>/<kbd className="rounded border bg-gray-100 px-1">k</kbd>, arrows on list.
              See help panel below.
            </p>
            <details className="mt-2 rounded-md border border-gray-200 bg-gray-50/90 p-2 text-[11px] text-gray-700">
              <summary className="cursor-pointer font-medium text-gray-800 outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
                Keyboard and export help
              </summary>
              <ul className="mt-2 list-inside list-disc space-y-1 pl-1 text-gray-600">
                <li>
                  <kbd className="rounded border bg-white px-1">/</kbd> moves focus to packet search (when not typing in a field).
                </li>
                <li>
                  <kbd className="rounded border bg-white px-1">Esc</kbd> clears a non-empty search first; if search is empty and insights are open, it collapses insights. Skips reply and local-note fields, but still works from the packet search box.
                </li>
                <li>
                  <kbd className="rounded border bg-white px-1">j</kbd> and <kbd className="rounded border bg-white px-1">k</kbd> move the selected packet up and down the visible list.
                </li>
                <li>Arrow keys, Home, and End navigate when the packet list has keyboard focus.</li>
                <li>Export CSV downloads only the rows currently visible after filters, using data already loaded in this browser.</li>
                <li>
                  You can open this screen from <span className="font-mono">/admin/operator-inbox</span> or the alias{" "}
                  <span className="font-mono">/admin/whatsapp</span> — same page, no extra data load.
                </li>
              </ul>
            </details>
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
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Display (local only)</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="operator-inbox-compact"
                      checked={compactMode}
                      onCheckedChange={(v) => setCompactMode(v === true)}
                    />
                    <label htmlFor="operator-inbox-compact" className="text-xs text-gray-600">
                      Compact packet list
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="operator-inbox-show-obs"
                      checked={showObservabilityStrip}
                      onCheckedChange={(v) => setShowObservabilityStrip(v === true)}
                    />
                    <label htmlFor="operator-inbox-show-obs" className="text-xs text-gray-600">
                      Show analytics / observability strip
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="operator-inbox-show-ai"
                      checked={showAiPreviewPanel}
                      onCheckedChange={(v) => setShowAiPreviewPanel(v === true)}
                    />
                    <label htmlFor="operator-inbox-show-ai" className="text-xs text-gray-600">
                      Show local AI preview panel
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2 rounded-md border border-indigo-100 bg-indigo-50/50 p-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
                  Saved views (this browser only)
                </p>
                <p className="text-[10px] text-indigo-900/80">
                  Saves search, unanswered toggle, pins, bulk filters, and display toggles. Nothing is written to the
                  server.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="operator-inbox-save-view-name" className="sr-only">
                      Name for saved view
                    </label>
                    <Input
                      id="operator-inbox-save-view-name"
                      value={savedViewNameDraft}
                      onChange={(e) => setSavedViewNameDraft(e.target.value)}
                      placeholder="e.g. Unanswered + stale"
                      className="h-9 text-sm"
                      autoComplete="off"
                    />
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="shrink-0 focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2"
                    onClick={handleSaveCurrentView}
                    disabled={!savedViewNameDraft.trim()}
                    aria-label="Save current inbox filters as a named view"
                  >
                    Save current
                  </Button>
                </div>
                {savedViews.length > 0 ? (
                  <ul className="max-h-40 space-y-1.5 overflow-y-auto border-t border-indigo-100 pt-2">
                    {savedViews.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center gap-1 rounded bg-white/80 px-2 py-1 text-xs text-indigo-950"
                      >
                        <span className="min-w-0 flex-1 truncate font-medium" title={v.name}>
                          {v.name}
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 shrink-0 px-2 text-[10px] focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-1"
                          onClick={() => handleApplySavedView(v)}
                          aria-label={`Apply saved view ${v.name}`}
                        >
                          Apply
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 shrink-0 px-2 text-[10px] text-red-700 focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-1"
                          onClick={() => handleDeleteSavedView(v.id)}
                          aria-label={`Delete saved view ${v.name}`}
                        >
                          Delete
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[10px] text-indigo-800/80">No saved views yet.</p>
                )}
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
                      <ToggleGroupItem
                        key={val}
                        value={val}
                        className="h-7 px-2 text-[10px]"
                        aria-label={`${label} packet health filter`}
                      >
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
                    {(["fresh", "active", "aging", "stale"] as const).map((val) => {
                      const m = packetSlaUiMeta(val);
                      return (
                        <ToggleGroupItem
                          key={val}
                          value={val}
                          className="h-7 px-2 text-[10px]"
                          title={`${m.title}: ${m.range} since last activity`}
                          aria-label={`${m.title} age filter, ${m.range} since last activity`}
                        >
                          {m.title}
                        </ToggleGroupItem>
                      );
                    })}
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
                      <ToggleGroupItem
                        key={val}
                        value={val}
                        className="h-7 px-2 text-[10px]"
                        aria-label={`${label} local intent tone filter`}
                      >
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
                className="mt-3 min-h-11 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white outline-none hover:bg-red-700 focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
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
            <div
              className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-gray-600"
              role="status"
            >
              {unansweredOnly && !filterQuery.trim() && !hasBulkFilters ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">No unanswered packets right now</p>
                  <p className="max-w-xs text-xs text-gray-500">
                    Every loaded thread already has an outbound after the latest inbound, or has no inbound yet.
                    Turn off “Unanswered only” to see all open packets.
                  </p>
                </>
              ) : filterQuery.trim() && !hasBulkFilters && !unansweredOnly ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">No search results</p>
                  <p className="max-w-xs text-xs text-gray-500">
                    Nothing in the loaded list matches <span className="font-medium text-gray-700">“{filterQuery}”</span>{" "}
                    for name, phone, or preview text. Try a shorter query or clear the filter.
                  </p>
                </>
              ) : filterQuery.trim() || unansweredOnly || hasBulkFilters ? (
                <>
                  <p className="text-sm font-semibold text-gray-800">No packets match these filters</p>
                  <p className="max-w-xs text-xs text-gray-500">
                    Combine search, unanswered-only, and bulk filters narrows the list. Pinned packets still obey search
                    and bulk rules. Adjust or reset below.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-gray-800">No packets to show</p>
                  <p className="max-w-xs text-xs text-gray-500">Try changing filters or wait for new open packets.</p>
                </>
              )}
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
              aria-activedescendant={selectedPacket ? `packet-row-${selectedPacket.id}` : undefined}
              onKeyDown={onPacketListKeyDown}
              className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
              aria-controls="operator-inbox-detail-region"
            >
              <OperatorInboxVirtualizedPacketList
                ref={packetListVirtualRef}
                scrollRef={listScrollRef}
                orderedPackets={orderedPackets}
                selectedPacketId={selectedPacket?.id ?? null}
                pinnedIds={pinnedIds}
                onSelect={setSelectedPacket}
                onPin={togglePin}
                compact={compactMode}
              />
            </div>
          ) : null}
        </div>

        {selectedPacket ? (
          <div
            id="operator-inbox-detail-region"
            className="flex min-h-0 min-w-0 flex-1 flex-col bg-white lg:min-h-0"
            role="region"
            aria-label="Selected WhatsApp packet"
            tabIndex={-1}
          >
            <div className="sticky top-0 z-20 shrink-0 max-h-[min(42dvh,22rem)] overflow-y-auto overscroll-y-contain border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur-sm supports-[backdrop-filter]:backdrop-blur-sm lg:max-h-none">
              <OperatorInboxGovernanceBar />
              <OperatorInboxRefreshingBanner isRefreshing={isRefreshing} refreshError={refreshError} />
              <div className="border-t border-green-100 bg-green-50 p-4">
                {isNarrow ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mb-2 -ml-2 h-10 px-2 text-gray-800 lg:hidden"
                    onClick={() => {
                      document.getElementById("operator-inbox-heading")?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                      });
                      window.setTimeout(() => listScrollRef.current?.focus(), 350);
                    }}
                  >
                    <ArrowLeft className="mr-1 h-4 w-4 shrink-0" aria-hidden />
                    Scroll to packet list
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
                <OperatorInboxSenderIdentityPanel state={senderIdentityState} />
                <OperatorInboxClientResolutionPanel
                  state={clientResolutionState}
                  requestKey={clientResolutionRequestKey}
                />
                <OperatorInboxProductResolutionPanel
                  state={productResolutionState}
                  requestKey={productResolutionRequestKey}
                />
                <OperatorInboxQuantityResolutionPanel
                  state={quantityResolutionState}
                  requestKey={quantityResolutionRequestKey}
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
                      aria-busy={classifyLoading}
                      aria-label={classifyLoading ? "Classifying intent, please wait" : "Classify intent with Edge suggestion"}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 outline-none hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
                    >
                      {classifyLoading ? "Classifying…" : "Classify Intent"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSuggestRoute()}
                      disabled={classifyLoading || routeLoading}
                      aria-busy={routeLoading}
                      aria-label={routeLoading ? "Suggesting route, please wait" : "Suggest routing with Edge function"}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-800 outline-none hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2"
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

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-y-contain scroll-pt-2 scroll-pb-3 p-4">
                  {selectedPacket.messages && selectedPacket.messages.length > 0 ? (
                    groupMessagesByDayWithGapMarkers(selectedPacket.messages).map((group) => (
                      <div key={group.dayKey}>
                        <p className="mb-3 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                          {group.dayLabel}
                        </p>
                        <div className="space-y-3">
                          {group.items.map(({ message: msg, showGap }) => (
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
                                    {messageHasAttachmentHint(msg) ? (
                                      <span
                                        className="inline-flex h-5 items-center rounded border border-dashed border-current/40 px-1 text-[10px] opacity-90"
                                        title="Possible attachment or media (heuristic)"
                                      >
                                        <Paperclip className="h-3 w-3" aria-hidden />
                                        <span className="sr-only">Attachment hint</span>
                                      </span>
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
                    <p className="text-center text-gray-500" role="status">
                      No messages in this packet
                    </p>
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
                      aria-label="Operator reply message draft"
                      className="flex-1 rounded-full border border-gray-300 bg-white px-4 py-2 focus:border-green-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2 disabled:bg-gray-100"
                    />
                    <button
                      type="button"
                      onClick={() => void handleSendReply()}
                      disabled={replySending || !replyText.trim()}
                      aria-label="Send WhatsApp reply"
                      className="rounded-full bg-green-500 px-6 py-2 font-medium text-white transition hover:bg-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-700 focus-visible:ring-offset-2 disabled:bg-gray-300"
                    >
                      {replySending ? "Sending..." : "Send"}
                    </button>
                  </div>
                </div>
              </div>

              {!insightsAsideExpanded ? (
                <div className="w-full shrink-0 border-t border-slate-200 bg-slate-100/90 px-3 py-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 w-full text-xs font-medium text-slate-800"
                    onClick={() => {
                      setInsightsAsideUserCollapsed(false);
                      setInsightsAsideExpanded(true);
                    }}
                  >
                    Show read-only insights
                  </Button>
                </div>
              ) : (
                <aside
                  data-operator-inbox-local-insights
                  tabIndex={-1}
                  className="w-full shrink-0 border-t border-gray-200 bg-slate-50/60 p-4 outline-none lg:sticky lg:top-0 lg:z-10 lg:max-h-[min(100dvh,100%)] lg:w-80 lg:self-start lg:overflow-y-auto lg:overscroll-y-contain lg:border-l lg:border-t-0"
                >
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">Read-only insights</h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 shrink-0 px-2 text-[10px] text-slate-600"
                      onClick={() => {
                        setInsightsAsideExpanded(false);
                        setInsightsAsideUserCollapsed(true);
                      }}
                    >
                      Hide
                    </Button>
                  </div>
                  <div className="space-y-4">
                    <OperatorInboxOperationalContextPanel packet={selectedPacket} events={selectedOperationalEvents} />
                    <OperatorInboxFailedMessagesReadOnlyPanel messages={selectedPacket.messages ?? []} />
                    <section
                      className="rounded-lg border border-amber-200 bg-amber-50/50 p-3"
                      aria-labelledby="operator-inbox-local-note-heading"
                    >
                      <h4
                        id="operator-inbox-local-note-heading"
                        className="text-xs font-semibold uppercase tracking-wide text-amber-950"
                      >
                        Local packet note
                      </h4>
                      <p className="mt-1 text-[11px] font-medium leading-snug text-amber-950">
                        Local note only — not sent or saved to server.
                      </p>
                      <Textarea
                        value={packetNotes[selectedPacket.id]?.text ?? ""}
                        onChange={(e) => handlePacketNoteChange(selectedPacket.id, e.target.value)}
                        placeholder="Private reminder for this packet…"
                        className="mt-2 min-h-[72px] text-xs"
                        aria-label={`Local private note for packet ${selectedPacket.id}`}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 h-8 text-xs focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2"
                        onClick={() => handleClearPacketNote(selectedPacket.id)}
                        disabled={!(packetNotes[selectedPacket.id]?.text ?? "").trim()}
                        aria-label="Clear local note for this packet"
                      >
                        Clear local note
                      </Button>
                    </section>
                    <OperatorInboxCustomerActivitySummary messages={selectedPacket.messages ?? []} />
                    <OperatorInboxLocalExplanationCards
                      messages={selectedPacket.messages ?? []}
                      lastMessageAtIso={selectedPacket.last_message_at}
                    />
                    <OperatorInboxLocalDraftPreview messages={selectedPacket.messages ?? []} />
                    <OperatorInboxDraftOrderPanel
                      state={draftOrderExtractionState}
                      requestKey={draftOrderExtractionRequestKey}
                      packetId={selectedPacket.id}
                      lineQuantities={draftOrderLineQuantities}
                      onLineQuantityChange={handleDraftOrderLineQuantityChange}
                      onLineQuantitiesReset={handleDraftOrderLineQuantitiesReset}
                      quantityEditsLocked={
                        salesOrderDraftHook.draftStatus === "UNDER_REVIEW" ||
                        salesOrderDraftHook.draftStatus === "APPROVED_FOR_SO"
                      }
                    />
                    <OperatorInboxSalesOrderDraftSection
                      extracted={
                        draftOrderExtractionState.status === "ready"
                          ? draftOrderExtractionState.draft
                          : null
                      }
                      draftHook={salesOrderDraftHook}
                      extractionReady={draftOrderExtractionState.status === "ready"}
                      canManageDraft={whatsappAuthority.has("wa.draft.manage")}
                      canPromoteDraft={whatsappAuthority.has("wa.draft.promote")}
                    />
                    {showAiPreviewPanel ? (
                      <OperatorInboxLocalAiPreviewPanel messages={selectedPacket.messages ?? []} />
                    ) : (
                      <p className="rounded-md border border-dashed border-slate-200 bg-white/60 p-2 text-[11px] text-slate-600">
                        Local AI preview is off. Enable “Show local AI preview panel” in the list header to see keyword
                        heuristics here.
                      </p>
                    )}
                  </div>
                </aside>
              )}
            </div>
          </div>
        ) : (
          <div
            id="operator-inbox-detail-region"
            className={cn(
              "flex min-h-0 flex-1 flex-col items-center justify-center bg-gray-50 p-6 text-center",
              isNarrow && "min-h-[28vh] border-t border-gray-200 lg:min-h-0",
            )}
            role="status"
            aria-label="No conversation selected"
            tabIndex={-1}
          >
            <MessageCircle className="mb-3 h-10 w-10 text-gray-300" aria-hidden />
            <p className="text-gray-600">
              Select a conversation from the list to open the operator dashboard, or use{" "}
              <kbd className="rounded border bg-white px-1">j</kbd> / <kbd className="rounded border bg-white px-1">k</kbd>{" "}
              when the list has focus.
            </p>
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
