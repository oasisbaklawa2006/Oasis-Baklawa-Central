import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { aggregateLiveFeeds, type AggregatedLiveFeeds } from "@/lib/live-feeds/aggregateLiveFeeds";
import type { OperationalFeedContext, OperationalOrderFeedRow } from "@/lib/live-feeds/feedTypes";
export interface UseOperationalLiveFeedsResult {
  loading: boolean;
  error: string | null;
  feeds: AggregatedLiveFeeds | null;
  /** Source context for entity graph / adapters (read-only). */
  feedContext: OperationalFeedContext | null;
  refresh: () => void;
}

/**
 * Read-only operational feeds for CMD / live queues / entity explorer.
 * Select-only Supabase reads — no writes, RPC, or Edge invokes.
 */
export function useOperationalLiveFeeds(): UseOperationalLiveFeedsResult {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feeds, setFeeds] = useState<AggregatedLiveFeeds | null>(null);
  const [feedContext, setFeedContext] = useState<OperationalFeedContext | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const loadedAt = new Date().toISOString();
    try {
      const { data: orderRows, error: orderErr } = await supabase
        .from("orders")
        .select(
          "id, status, payment_status, advance_paid, advance_required, created_at, sales_order_value, dispatch_urgency, company_id, needs_clarification, is_duplicate",
        )
        .not("status", "in", '("closed","cancelled")')
        .eq("is_waste", false)
        .order("created_at", { ascending: false })
        .limit(200);

      if (orderErr) throw new Error(orderErr.message);

      const rows = orderRows ?? [];
      const companyIds = [...new Set(rows.map((o) => o.company_id).filter(Boolean))] as string[];
      let companyMap: Record<string, { name: string; status: string | null }> = {};
      if (companyIds.length) {
        const { data: companies } = await supabase
          .from("companies")
          .select("id, business_name, status")
          .in("id", companyIds);
        companies?.forEach((c: { id: string; business_name: string; status: string | null }) => {
          companyMap[c.id] = { name: c.business_name, status: c.status };
        });
      }

      const orderIds = rows.map((o) => o.id);
      const complained = new Set<string>();
      if (orderIds.length) {
        const { data: tickets } = await supabase.from("support_tickets").select("order_id").in("order_id", orderIds);
        tickets?.forEach((t: { order_id: string }) => complained.add(t.order_id));
      }

      let minConfByOrder: Record<string, number | null> = {};
      if (orderIds.length) {
        const { data: items } = await supabase
          .from("order_items")
          .select("order_id, notes")
          .in("order_id", orderIds);
        items?.forEach((item: { order_id: string; notes: string | null }) => {
          let conf: number | null = null;
          if (item.notes && typeof item.notes === "string") {
            const cMatch = item.notes.match(/conf(?:idence)?[=:]\s*([0-9.]+)/i);
            if (cMatch) conf = Math.min(1, Math.max(0, parseFloat(cMatch[1])));
          }
          if (conf !== null) {
            const prev = minConfByOrder[item.order_id];
            minConfByOrder[item.order_id] = prev === null || prev === undefined ? conf : Math.min(prev, conf);
          }
        });
      }

      const orders: OperationalOrderFeedRow[] = rows.map((o) => {
        const cInfo = o.company_id ? companyMap[o.company_id] : null;
        return {
          id: o.id,
          status: o.status,
          payment_status: o.payment_status,
          advance_paid: o.advance_paid,
          advance_required: o.advance_required,
          created_at: o.created_at,
          sales_order_value: o.sales_order_value,
          dispatch_urgency: o.dispatch_urgency,
          company_id: o.company_id,
          company_name: cInfo?.name ?? "Unknown",
          company_status: cInfo?.status ?? null,
          needs_clarification: o.needs_clarification,
          is_duplicate: o.is_duplicate,
          has_complaint: complained.has(o.id),
          min_confidence: minConfByOrder[o.id] ?? null,
        };
      });

      const { count: invCount, error: invErr } = await supabase
        .from("factory_inventory")
        .select("id", { count: "exact", head: true });

      const ctx: OperationalFeedContext = {
        orders,
        loadedAt,
        orderQueryError: null,
        factoryInventoryCount: invErr ? null : invCount ?? 0,
        factoryInventoryError: invErr?.message ?? null,
        scanAnomalyCount: null,
        reservationRiskCount: null,
      };

      setFeedContext(ctx);
      setFeeds(aggregateLiveFeeds(ctx));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Operational feed load failed";
      setError(msg);
      const ctx: OperationalFeedContext = {
        orders: [],
        loadedAt,
        orderQueryError: msg,
        scanAnomalyCount: null,
        reservationRiskCount: null,
      };
      setFeedContext(ctx);
      setFeeds(aggregateLiveFeeds(ctx));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { loading, error, feeds, feedContext, refresh: load };
}
