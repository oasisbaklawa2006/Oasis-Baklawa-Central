import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { dispatchDb } from "@/lib/dispatchGovernedRpc";
import {
  evaluatePackingContracts,
  type GovernedCartonItemRow,
  type GovernedCartonRow,
  type GovernedConsignmentLineRow,
  type GovernedDplVersionRow,
} from "@/lib/packing-carton-dpl";

const DEFAULT_LIMIT = 50;

export type CartonExplorerConsignmentSummary = {
  consignment_id: string;
  consignment_number: string;
  order_number: string;
  consignment_status: string;
  carton_count: number;
  packed_qty: number;
  selected_qty: number;
};

export type CartonExplorerDetail = {
  cartons: GovernedCartonRow[];
  lines: GovernedConsignmentLineRow[];
  cartonItems: GovernedCartonItemRow[];
  dplVersions: GovernedDplVersionRow[];
  contracts: ReturnType<typeof evaluatePackingContracts>;
};

export interface CartonExplorerState {
  consignments: CartonExplorerConsignmentSummary[];
  selectedConsignmentId: string;
  setSelectedConsignmentId: (id: string) => void;
  detail: CartonExplorerDetail | null;
  loading: boolean;
  detailLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Read-only carton explorer — SELECT on governed b2b_dispatch_* relations only.
 * No RPC mutations; operators mutate via DispatchManagement (FACT-C3).
 */
export function useCartonExplorer(limit = DEFAULT_LIMIT): CartonExplorerState {
  const [consignments, setConsignments] = useState<CartonExplorerConsignmentSummary[]>([]);
  const [selectedConsignmentId, setSelectedConsignmentId] = useState("");
  const [cartons, setCartons] = useState<GovernedCartonRow[]>([]);
  const [lines, setLines] = useState<GovernedConsignmentLineRow[]>([]);
  const [cartonItems, setCartonItems] = useState<GovernedCartonItemRow[]>([]);
  const [dplVersions, setDplVersions] = useState<GovernedDplVersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConsignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await dispatchDb
        .from<CartonExplorerConsignmentSummary>("b2b_dispatch_shipment_execution_view")
        .select(
          "consignment_id, consignment_number, order_number, consignment_status, carton_count, packed_qty, selected_qty",
        )
        .order("consignment_number", { ascending: false })
        .limit(limit);

      if (queryError) {
        if (queryError.message.includes("does not exist")) {
          setConsignments([]);
          return;
        }
        throw new Error(queryError.message);
      }

      setConsignments((data ?? []) as CartonExplorerConsignmentSummary[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load consignments");
      setConsignments([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const loadDetail = useCallback(async (consignmentId: string) => {
    if (!consignmentId) {
      setCartons([]);
      setLines([]);
      setCartonItems([]);
      setDplVersions([]);
      return;
    }
    setDetailLoading(true);
    try {
      const [cartonsRes, linesRes, dplRes] = await Promise.all([
        supabase
          .from("b2b_dispatch_cartons")
          .select(
            "id, consignment_id, carton_code, carton_sequence, status, net_weight, gross_weight, open_photo_ref, seal_reference, locked_by, locked_at, current_version",
          )
          .eq("consignment_id", consignmentId)
          .order("carton_sequence", { ascending: true }),
        supabase
          .from("b2b_dispatch_consignment_lines")
          .select("id, product_code, accepted_ready_qty, packed_qty")
          .eq("consignment_id", consignmentId)
          .order("product_code", { ascending: true }),
        supabase
          .from("b2b_dispatch_packing_list_versions")
          .select(
            "id, consignment_id, version_number, status, submitted_to_finance_at, finance_check_state, superseded_by, generated_at",
          )
          .eq("consignment_id", consignmentId)
          .order("version_number", { ascending: false }),
      ]);

      if (cartonsRes.error) throw new Error(cartonsRes.error.message);
      if (linesRes.error) throw new Error(linesRes.error.message);
      if (dplRes.error) throw new Error(dplRes.error.message);

      const nextCartons = (cartonsRes.data ?? []) as GovernedCartonRow[];
      const nextLines = (linesRes.data ?? []) as GovernedConsignmentLineRow[];
      const nextDpl = (dplRes.data ?? []) as GovernedDplVersionRow[];

      const cartonIds = nextCartons.map((c) => c.id);
      let nextItems: GovernedCartonItemRow[] = [];
      if (cartonIds.length > 0) {
        const itemsRes = await supabase
          .from("b2b_dispatch_carton_items")
          .select(
            "id, carton_id, consignment_line_id, order_item_id, product_code, barcode_value, batch_lot, quantity, scanned_at",
          )
          .in("carton_id", cartonIds)
          .order("scanned_at", { ascending: false });
        if (itemsRes.error) throw new Error(itemsRes.error.message);
        nextItems = (itemsRes.data ?? []) as GovernedCartonItemRow[];
      }

      setCartons(nextCartons);
      setLines(nextLines);
      setCartonItems(nextItems);
      setDplVersions(nextDpl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load carton detail");
      setCartons([]);
      setLines([]);
      setCartonItems([]);
      setDplVersions([]);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadConsignments();
  }, [loadConsignments]);

  useEffect(() => {
    if (!selectedConsignmentId && consignments.length > 0) {
      setSelectedConsignmentId(consignments[0].consignment_id);
    }
  }, [consignments, selectedConsignmentId]);

  useEffect(() => {
    setCartons([]);
    setLines([]);
    setCartonItems([]);
    setDplVersions([]);
    void loadDetail(selectedConsignmentId);
  }, [selectedConsignmentId, loadDetail]);

  const detail = useMemo<CartonExplorerDetail | null>(() => {
    if (!selectedConsignmentId) return null;
    const contracts = evaluatePackingContracts({
      cartons,
      cartonItems,
      lines,
      dplVersions,
    });
    return { cartons, lines, cartonItems, dplVersions, contracts };
  }, [selectedConsignmentId, cartons, lines, cartonItems, dplVersions]);

  const refresh = useCallback(async () => {
    await loadConsignments();
    if (selectedConsignmentId) await loadDetail(selectedConsignmentId);
  }, [loadConsignments, loadDetail, selectedConsignmentId]);

  return {
    consignments,
    selectedConsignmentId,
    setSelectedConsignmentId,
    detail,
    loading,
    detailLoading,
    error,
    refresh,
  };
}
