import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Lock,
  PackageCheck,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { dispatchDb, dispatchGovernedRpc } from "@/lib/dispatchGovernedRpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

/**
 * Canonical Dispatch operator workflow (FACT-C3): the single governed path
 * from a released Sales Order through consignment creation, carton opening,
 * scanned/evidenced/locked carton truth (FACT-C1), and Dispatch Packing
 * List creation, correction and submission to Finance (FACT-C2).
 *
 * This replaces the legacy handheld packing screen -- it no longer writes
 * to `dispatch_cartons`, `order_items.actual_packed_qty`, or any
 * order-status-flipping "Finalize DPL" action. Every mutation here goes
 * through a governed oasis-supabase-core RPC against the `b2b_dispatch_*`
 * schema; there is exactly one DPL-mutation authority in the app --
 * create/supersede/submit_b2b_dispatch_packing_list_to_finance, called only
 * from this page. FACT-C3 stops at "submitted to Finance": no transporter
 * selection, loading, gate, departure or POD/delivery is implemented here.
 */

type ShipmentExecutionRow = {
  consignment_id: string;
  consignment_number: string;
  order_id: string;
  order_number: string;
  consignment_status: string;
  dispatch_mode: string;
  consignee_name: string | null;
  destination_city: string | null;
  carton_count: number;
  selected_qty: number;
  packed_qty: number;
  dispatched_qty: number;
  transporter_name: string | null;
  finance_status: "CLEARED" | "HOLD";
  open_exception_count: number;
};

type CartonRow = {
  id: string;
  carton_code: string;
  carton_sequence: number;
  status: string;
  net_weight: number | null;
  gross_weight: number | null;
  open_photo_ref: string | null;
  locked_by: string | null;
  locked_at: string | null;
  current_version: number;
};

type CartonItemRow = {
  id: string;
  barcode_value: string;
  batch_lot: string;
  quantity: number;
  product_code: string;
  scanned_at: string;
};

type ScanEventRow = {
  id: string;
  barcode_value: string;
  scan_result: string;
  reason: string | null;
  created_at: string;
};

type ConsignmentLineRow = {
  id: string;
  product_code: string;
  uom: string;
  accepted_ready_qty: number;
  packed_qty: number;
};

type DplVersionRow = {
  id: string;
  version_number: number;
  status: string;
  submitted_to_finance_at: string | null;
  finance_check_state: string;
  superseded_by: string | null;
  generated_at: string;
  correlation_id: string;
};

const DISPATCH_MODES = [
  "road_transporter",
  "courier",
  "air",
  "train",
  "direct_special_delivery",
  "customer_pickup",
  "approved_special",
] as const;

const LOCKED_CARTON_STATUSES = new Set([
  "locked",
  "finance_check_open",
  "verified",
  "labelled",
  "ready_to_load",
  "loaded",
  "handed_over",
]);

/** Dropdown of governed consignments; selecting one drives all downstream carton/DPL panels below. */
function ConsignmentSelect({
  id,
  rows,
  value,
  onValueChange,
}: {
  id: string;
  rows: ShipmentExecutionRow[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id}>
        <SelectValue placeholder="Select a consignment" />
      </SelectTrigger>
      <SelectContent>
        {rows.map((row) => (
          <SelectItem key={row.consignment_id} value={row.consignment_id}>
            {row.consignment_number}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Canonical governed operator surface for the FACT-C1/FACT-C2 Dispatch RPC chain: consignment
 * and carton creation, barcode/batch scanning, weight/photo evidence, carton locking, DPL
 * generation and supersession, and Finance submission. This is the sole screen authorized to
 * mutate B2B carton, packing-list, and packed-quantity state (see `blockLegacyB2bCartonDplMutation`).
 */
export default function DispatchManagement() {
  const [rows, setRows] = useState<ShipmentExecutionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Consignment creation
  const [orderId, setOrderId] = useState("");
  const [dispatchMode, setDispatchMode] = useState<string>(DISPATCH_MODES[0]);
  const [orderItemId, setOrderItemId] = useState("");
  const [selectedQty, setSelectedQty] = useState("");
  const [creating, setCreating] = useState(false);
  const [createCorrelationId, setCreateCorrelationId] = useState(() => crypto.randomUUID());

  // Working consignment (the one being packed / whose DPL is being managed)
  const [workingConsignmentId, setWorkingConsignmentId] = useState("");
  const [cartons, setCartons] = useState<CartonRow[]>([]);
  const [consignmentLines, setConsignmentLines] = useState<ConsignmentLineRow[]>([]);
  const [dplVersions, setDplVersions] = useState<DplVersionRow[]>([]);
  const [supersessionReasons, setSupersessionReasons] = useState<Map<string, string>>(new Map());
  const [workingLoading, setWorkingLoading] = useState(false);

  // Open carton
  const [cartonCode, setCartonCode] = useState("");
  const [openingCarton, setOpeningCarton] = useState(false);

  // Selected carton (scan / evidence / lock)
  const [selectedCartonId, setSelectedCartonId] = useState("");
  const [cartonItems, setCartonItems] = useState<CartonItemRow[]>([]);
  const [scanEvents, setScanEvents] = useState<ScanEventRow[]>([]);

  const [scanLineId, setScanLineId] = useState("");
  const [scanBarcode, setScanBarcode] = useState("");
  const [scanBatchLot, setScanBatchLot] = useState("");
  const [scanQuantity, setScanQuantity] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanCorrelationId, setScanCorrelationId] = useState(() => crypto.randomUUID());

  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [evidencePhoto, setEvidencePhoto] = useState<File | null>(null);
  const [recordingEvidence, setRecordingEvidence] = useState(false);
  const [evidenceCorrelationId, setEvidenceCorrelationId] = useState(() => crypto.randomUUID());

  const [locking, setLocking] = useState(false);
  const [lockCorrelationId, setLockCorrelationId] = useState(() => crypto.randomUUID());

  // DPL actions
  const [creatingDpl, setCreatingDpl] = useState(false);
  const [dplCreateCorrelationId, setDplCreateCorrelationId] = useState(() => crypto.randomUUID());
  const [supersedeReason, setSupersedeReason] = useState("");
  const [superseding, setSuperseding] = useState(false);
  const [supersedeCorrelationId, setSupersedeCorrelationId] = useState(() => crypto.randomUUID());
  const [submittingDpl, setSubmittingDpl] = useState(false);
  const [dplSubmitCorrelationId, setDplSubmitCorrelationId] = useState(() => crypto.randomUUID());

  // Throws after recording the error so a mutation handler awaiting this as
  // part of its authoritative-refresh postcondition can observe the failure
  // and avoid claiming a fully-reconciled success. Callers that only want the
  // side effect (initial load, manual refresh button) must swallow the
  // rejection themselves -- see the mount effect and refresh button below.
  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await dispatchDb
        .from("b2b_dispatch_shipment_execution_view")
        .select("*")
        .order("consignment_number", { ascending: false })
        .limit(50);
      if (fetchError) throw fetchError;
      setRows((data ?? []) as ShipmentExecutionRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load governed dispatch consignments.");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows().catch(() => {});
  }, [fetchRows]);

  const workingRequestIdRef = useRef(0);
  const refreshWorkingConsignment = useCallback(async (consignmentId: string) => {
    const requestId = ++workingRequestIdRef.current;
    if (!consignmentId) {
      setCartons([]);
      setConsignmentLines([]);
      setDplVersions([]);
      setSupersessionReasons(new Map());
      return;
    }
    setWorkingLoading(true);
    try {
      const [cartonsRes, linesRes, dplRes, eventsRes] = await Promise.all([
        supabase
          .from("b2b_dispatch_cartons")
          .select(
            "id, carton_code, carton_sequence, status, net_weight, gross_weight, open_photo_ref, locked_by, locked_at, current_version",
          )
          .eq("consignment_id", consignmentId)
          .order("carton_sequence", { ascending: true }),
        supabase
          .from("b2b_dispatch_consignment_lines")
          .select("id, product_code, uom, accepted_ready_qty, packed_qty")
          .eq("consignment_id", consignmentId)
          .order("product_code", { ascending: true }),
        supabase
          .from("b2b_dispatch_packing_list_versions")
          .select(
            "id, version_number, status, submitted_to_finance_at, finance_check_state, superseded_by, generated_at, correlation_id",
          )
          .eq("consignment_id", consignmentId)
          .order("version_number", { ascending: false }),
        supabase
          .from("b2b_dispatch_events")
          .select("document_version_id, reason")
          .eq("consignment_id", consignmentId)
          .eq("event_type", "packing_list_superseded"),
      ]);
      if (cartonsRes.error) throw new Error(cartonsRes.error.message);
      if (linesRes.error) throw new Error(linesRes.error.message);
      if (dplRes.error) throw new Error(dplRes.error.message);
      if (eventsRes.error) throw new Error(eventsRes.error.message);
      if (requestId !== workingRequestIdRef.current) return;
      setCartons((cartonsRes.data ?? []) as CartonRow[]);
      setConsignmentLines((linesRes.data ?? []) as ConsignmentLineRow[]);
      setDplVersions((dplRes.data ?? []) as DplVersionRow[]);
      const reasonMap = new Map<string, string>();
      for (const evt of (eventsRes.data ?? []) as { document_version_id: string | null; reason: string | null }[]) {
        if (evt.document_version_id && evt.reason) reasonMap.set(evt.document_version_id, evt.reason);
      }
      setSupersessionReasons(reasonMap);
    } catch (err) {
      if (requestId !== workingRequestIdRef.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load consignment detail.");
      throw err;
    } finally {
      if (requestId === workingRequestIdRef.current) setWorkingLoading(false);
    }
  }, []);

  useEffect(() => {
    // Invalidate every piece of the previous consignment's detail immediately
    // on selection change -- before the new consignment's data has loaded --
    // so a stale carton/line/DPL row from the old consignment is never left
    // rendered or selectable under the new workingConsignmentId, whether the
    // new load succeeds, fails, or is still pending.
    setCartons([]);
    setConsignmentLines([]);
    setDplVersions([]);
    setSupersessionReasons(new Map());
    setSelectedCartonId("");
    setCartonItems([]);
    setScanEvents([]);
    refreshWorkingConsignment(workingConsignmentId).catch(() => {});
  }, [workingConsignmentId, refreshWorkingConsignment]);

  const cartonRequestIdRef = useRef(0);
  const refreshCartonDetail = useCallback(async (cartonId: string) => {
    const requestId = ++cartonRequestIdRef.current;
    if (!cartonId) {
      setCartonItems([]);
      setScanEvents([]);
      return;
    }
    try {
      const [itemsRes, eventsRes] = await Promise.all([
        supabase
          .from("b2b_dispatch_carton_items")
          .select("id, barcode_value, batch_lot, quantity, product_code, scanned_at")
          .eq("carton_id", cartonId)
          .order("scanned_at", { ascending: false }),
        supabase
          .from("b2b_dispatch_product_scan_events")
          .select("id, barcode_value, scan_result, reason, created_at")
          .eq("carton_id", cartonId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);
      if (itemsRes.error) throw new Error(itemsRes.error.message);
      if (eventsRes.error) throw new Error(eventsRes.error.message);
      if (requestId !== cartonRequestIdRef.current) return;
      setCartonItems((itemsRes.data ?? []) as CartonItemRow[]);
      setScanEvents((eventsRes.data ?? []) as ScanEventRow[]);
    } catch (err) {
      if (requestId !== cartonRequestIdRef.current) return;
      toast.error(err instanceof Error ? err.message : "Failed to load carton detail.");
      throw err;
    }
  }, []);

  useEffect(() => {
    refreshCartonDetail(selectedCartonId).catch(() => {});
  }, [selectedCartonId, refreshCartonDetail]);

  const selectedCarton = cartons.find((c) => c.id === selectedCartonId) ?? null;
  const currentDplVersion = dplVersions.find((v) => v.status !== "superseded") ?? null;
  const supersededVersions = dplVersions.filter((v) => v.status === "superseded");

  const handleCreateConsignment = async () => {
    const trimmedOrderId = orderId.trim();
    const trimmedOrderItemId = orderItemId.trim();
    const qty = Number(selectedQty);
    if (!trimmedOrderId || !trimmedOrderItemId) {
      toast.error("Order ID and order item ID are required.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Selected quantity must be a positive number.");
      return;
    }
    setCreating(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("create_b2b_dispatch_consignment", {
        p_order_id: trimmedOrderId,
        p_dispatch_mode: dispatchMode,
        p_lines: [{ order_item_id: trimmedOrderItemId, selected_qty: qty }],
        p_correlation_id: createCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      try {
        await fetchRows();
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Consignment created, but the consignment list could not be refreshed. Reload and verify before retrying.",
        );
        return;
      }
      toast.success("Governed dispatch consignment created.");
      setOrderId("");
      setOrderItemId("");
      setSelectedQty("");
      setCreateCorrelationId(crypto.randomUUID());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create the consignment.");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenCarton = async () => {
    const trimmedCartonCode = cartonCode.trim();
    if (!workingConsignmentId || !trimmedCartonCode) {
      toast.error("Select a consignment and enter a carton code.");
      return;
    }
    setOpeningCarton(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("open_b2b_dispatch_carton", {
        p_consignment_id: workingConsignmentId,
        p_carton_code: trimmedCartonCode,
      });
      if (rpcError) throw new Error(rpcError.message);
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Carton opened, but the consignment view could not be refreshed. Reload and verify before retrying.",
        );
        return;
      }
      toast.success("Carton opened.");
      setCartonCode("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to open the carton.");
    } finally {
      setOpeningCarton(false);
    }
  };

  const handleScan = async () => {
    const barcode = scanBarcode.trim();
    const batchLot = scanBatchLot.trim();
    const qty = Number(scanQuantity);
    if (!selectedCartonId || !scanLineId) {
      toast.error("Select a carton and the consignment line being packed.");
      return;
    }
    if (!barcode || !batchLot) {
      toast.error("Barcode and batch/lot are required.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      toast.error("Scan quantity must be a positive number.");
      return;
    }
    setScanning(true);
    try {
      const { data, error: rpcError } = await dispatchGovernedRpc.rpc<{ scan_result: string; reason: string | null }>(
        "record_b2b_dispatch_carton_item_scan",
        {
          p_carton_id: selectedCartonId,
          p_consignment_line_id: scanLineId,
          p_barcode_value: barcode,
          p_batch_lot: batchLot,
          p_quantity: qty,
          p_correlation_id: scanCorrelationId,
        },
      );
      if (rpcError) throw new Error(rpcError.message);
      if (data?.scan_result === "verified") {
        toast.success(`Scan verified: ${barcode}`);
      } else {
        toast.error(`Scan rejected (${data?.scan_result ?? "unknown"})${data?.reason ? `: ${data.reason}` : ""}`);
      }
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId), refreshCartonDetail(selectedCartonId)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Scan recorded, but the authoritative view could not be refreshed. Reload before retrying -- do not rescan.",
        );
        return;
      }
      setScanBarcode("");
      setScanBatchLot("");
      setScanQuantity("");
      setScanCorrelationId(crypto.randomUUID());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  };

  const handleRecordEvidence = async () => {
    if (!selectedCartonId) {
      toast.error("Select a carton first.");
      return;
    }
    if (!netWeight.trim() || !grossWeight.trim()) {
      toast.error("Net and gross weight are required.");
      return;
    }
    const net = Number(netWeight);
    const gross = Number(grossWeight);
    if (!Number.isFinite(net) || net < 0 || !Number.isFinite(gross) || gross < 0) {
      toast.error("Net and gross weight are required.");
      return;
    }
    if (!evidencePhoto && !selectedCarton?.open_photo_ref) {
      toast.error("A carton photo is required.");
      return;
    }
    const ALLOWED_PHOTO_TYPES: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
    };
    if (evidencePhoto) {
      const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
      if (!(evidencePhoto.type in ALLOWED_PHOTO_TYPES)) {
        toast.error("Carton photo must be a JPEG, PNG, WEBP or HEIC image.");
        return;
      }
      if (evidencePhoto.size > MAX_PHOTO_BYTES) {
        toast.error("Carton photo must be 10 MB or smaller.");
        return;
      }
    }
    setRecordingEvidence(true);
    let uploadedPath: string | null = null;
    try {
      let photoRef = selectedCarton?.open_photo_ref ?? null;
      if (evidencePhoto) {
        const ext = ALLOWED_PHOTO_TYPES[evidencePhoto.type];
        const path = `dispatch-carton-evidence/${selectedCartonId}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from("receipts").upload(path, evidencePhoto);
        if (uploadError) throw new Error(uploadError.message ?? "Photo upload failed.");
        uploadedPath = path;
        const { data: urlData } = supabase.storage.from("receipts").getPublicUrl(path);
        photoRef = urlData.publicUrl;
      }
      const { error: rpcError } = await dispatchGovernedRpc.rpc("record_b2b_dispatch_carton_evidence", {
        p_carton_id: selectedCartonId,
        p_net_weight: net,
        p_gross_weight: gross,
        p_open_photo_ref: photoRef,
        p_correlation_id: evidenceCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      // The evidence RPC succeeded, so any uploaded photo is now referenced
      // by the governed record -- do not delete it even if the refresh
      // below fails.
      uploadedPath = null;
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId), refreshCartonDetail(selectedCartonId)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Evidence recorded, but the authoritative view could not be refreshed. Reload before retrying.",
        );
        return;
      }
      toast.success("Evidence recorded.");
      setNetWeight("");
      setGrossWeight("");
      setEvidencePhoto(null);
      setEvidenceCorrelationId(crypto.randomUUID());
    } catch (err) {
      if (uploadedPath) {
        await supabase.storage.from("receipts").remove([uploadedPath]);
      }
      toast.error(err instanceof Error ? err.message : "Failed to record evidence.");
    } finally {
      setRecordingEvidence(false);
    }
  };

  const handleLockCarton = async () => {
    if (!selectedCarton) {
      toast.error("Select a carton first.");
      return;
    }
    setLocking(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("lock_b2b_dispatch_carton", {
        p_carton_id: selectedCarton.id,
        p_expected_version: selectedCarton.current_version,
        p_correlation_id: lockCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId), refreshCartonDetail(selectedCarton.id)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Carton locked, but the authoritative view could not be refreshed. Reload before retrying.",
        );
        return;
      }
      toast.success("Carton locked.");
      setLockCorrelationId(crypto.randomUUID());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to lock the carton. Reload and retry if the carton changed.");
    } finally {
      setLocking(false);
    }
  };

  const handleCreateDpl = async () => {
    if (!workingConsignmentId) {
      toast.error("Select a consignment first.");
      return;
    }
    setCreatingDpl(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("create_b2b_dispatch_packing_list", {
        p_consignment_id: workingConsignmentId,
        p_correlation_id: dplCreateCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Packing list generated, but the authoritative view could not be refreshed. Reload before retrying.",
        );
        return;
      }
      toast.success("Packing list generated.");
      setDplCreateCorrelationId(crypto.randomUUID());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate the packing list.");
    } finally {
      setCreatingDpl(false);
    }
  };

  const handleSupersedeDpl = async () => {
    const reason = supersedeReason.trim();
    if (!currentDplVersion) {
      toast.error("There is no current packing list version to correct.");
      return;
    }
    if (!reason) {
      toast.error("A correction reason is required.");
      return;
    }
    setSuperseding(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("supersede_b2b_dispatch_packing_list", {
        p_consignment_id: workingConsignmentId,
        p_current_version_id: currentDplVersion.id,
        p_reason: reason,
        p_correlation_id: supersedeCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Packing list corrected, but the authoritative view could not be refreshed. Reload before retrying.",
        );
        return;
      }
      toast.success("Packing list corrected with a new version.");
      setSupersedeReason("");
      setSupersedeCorrelationId(crypto.randomUUID());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to correct the packing list.");
    } finally {
      setSuperseding(false);
    }
  };

  const handleSubmitDpl = async () => {
    if (!currentDplVersion) {
      toast.error("There is no current packing list version to submit.");
      return;
    }
    setSubmittingDpl(true);
    try {
      const { error: rpcError } = await dispatchGovernedRpc.rpc("submit_b2b_dispatch_packing_list_to_finance", {
        p_consignment_id: workingConsignmentId,
        p_version_id: currentDplVersion.id,
        p_correlation_id: dplSubmitCorrelationId,
      });
      if (rpcError) throw new Error(rpcError.message);
      try {
        await Promise.all([fetchRows(), refreshWorkingConsignment(workingConsignmentId)]);
      } catch (refreshErr) {
        console.error("Authoritative refresh failed after a successful mutation:", refreshErr);
        toast.error(
          "Packing list submitted to Finance, but the authoritative view could not be refreshed. Reload to confirm before retrying.",
        );
        return;
      }
      toast.success("Packing list submitted to Finance.");
      setDplSubmitCorrelationId(crypto.randomUUID());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit the packing list to Finance.");
    } finally {
      setSubmittingDpl(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <PackageCheck className="h-7 w-7 text-primary" aria-hidden />
          <h1 className="text-xl font-bold tracking-tight">Dispatch</h1>
          <Badge variant="outline" className="text-[10px] uppercase">
            Governed carton &amp; DPL authority
          </Badge>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => fetchRows().catch(() => {})} disabled={loading}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Start a governed consignment</CardTitle>
          <CardDescription className="text-xs">
            Calls <code>create_b2b_dispatch_consignment</code>. Requires an existing order with a company and an
            order item on it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="dispatch-order-id">Order ID</Label>
            <Input id="dispatch-order-id" value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="uuid" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-dispatch-mode">Dispatch mode</Label>
            <Select value={dispatchMode} onValueChange={setDispatchMode}>
              <SelectTrigger id="dispatch-dispatch-mode">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DISPATCH_MODES.map((mode) => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-order-item-id">Order item ID</Label>
            <Input
              id="dispatch-order-item-id"
              value={orderItemId}
              onChange={(e) => setOrderItemId(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dispatch-selected-qty">Selected quantity</Label>
            <Input
              id="dispatch-selected-qty"
              type="number"
              min="0"
              value={selectedQty}
              onChange={(e) => setSelectedQty(e.target.value)}
            />
          </div>
          <Button type="button" className="sm:col-span-2" disabled={creating} onClick={() => void handleCreateConsignment()}>
            {creating ? "Creating…" : "Create consignment"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Governed consignments</CardTitle>
          <CardDescription className="text-xs">
            Select a consignment below to open cartons, scan contents, capture evidence, lock cartons and manage its
            packing list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1 sm:max-w-xs">
            <Label htmlFor="dispatch-working-consignment">Working consignment</Label>
            <ConsignmentSelect
              id="dispatch-working-consignment"
              rows={rows}
              value={workingConsignmentId}
              onValueChange={setWorkingConsignmentId}
            />
          </div>
          {!loading && rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No governed consignments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Consignment</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cartons</TableHead>
                    <TableHead>Selected / Packed / Dispatched</TableHead>
                    <TableHead>Finance</TableHead>
                    <TableHead>Exceptions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.consignment_id}
                      className={row.consignment_id === workingConsignmentId ? "bg-primary/5" : undefined}
                    >
                      <TableCell className="text-xs">{row.consignment_number}</TableCell>
                      <TableCell className="text-xs">{row.order_number}</TableCell>
                      <TableCell className="text-xs">{row.consignment_status}</TableCell>
                      <TableCell className="text-xs">{row.carton_count}</TableCell>
                      <TableCell className="text-xs">
                        {row.selected_qty} / {row.packed_qty} / {row.dispatched_qty}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Badge variant={row.finance_status === "CLEARED" ? "default" : "outline"}>
                          {row.finance_status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.open_exception_count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {workingConsignmentId ? (
        <>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cartons</CardTitle>
              <CardDescription className="text-xs">
                Calls <code>open_b2b_dispatch_carton</code>. Select a carton row to scan contents, capture evidence
                and lock it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor="dispatch-carton-code">Carton code</Label>
                  <Input
                    id="dispatch-carton-code"
                    value={cartonCode}
                    onChange={(e) => setCartonCode(e.target.value)}
                    placeholder="e.g. CTN-0001"
                  />
                </div>
                <Button type="button" disabled={openingCarton || workingLoading} onClick={() => void handleOpenCarton()}>
                  {openingCarton ? "Opening…" : "Open carton"}
                </Button>
              </div>

              {workingLoading ? (
                <p className="text-xs text-muted-foreground">Loading cartons…</p>
              ) : cartons.length === 0 ? (
                <p className="text-xs text-muted-foreground">No cartons opened yet for this consignment.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Carton</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Net / Gross</TableHead>
                        <TableHead>Locked</TableHead>
                        <TableHead />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cartons.map((carton) => (
                        <TableRow key={carton.id} className={carton.id === selectedCartonId ? "bg-primary/5" : undefined}>
                          <TableCell className="text-xs">{carton.carton_code}</TableCell>
                          <TableCell className="text-xs">
                            <Badge variant={LOCKED_CARTON_STATUSES.has(carton.status) ? "default" : "outline"}>
                              {carton.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">
                            {carton.net_weight ?? "—"} / {carton.gross_weight ?? "—"}
                          </TableCell>
                          <TableCell className="text-xs">
                            {carton.locked_at ? <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-label="Locked" /> : "—"}
                          </TableCell>
                          <TableCell>
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedCartonId(carton.id)}>
                              {carton.id === selectedCartonId ? "Selected" : "Select"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {selectedCarton ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">
                  Carton {selectedCarton.carton_code} -- {selectedCarton.status}
                </CardTitle>
                <CardDescription className="text-xs">
                  Scan contents, capture net/gross weight and a photo, then lock once evidence is complete.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-semibold">Scan a product</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="dispatch-scan-line">Consignment line</Label>
                      <Select value={scanLineId} onValueChange={setScanLineId}>
                        <SelectTrigger id="dispatch-scan-line">
                          <SelectValue placeholder="Select the product being packed" />
                        </SelectTrigger>
                        <SelectContent>
                          {consignmentLines.map((line) => (
                            <SelectItem key={line.id} value={line.id}>
                              {line.product_code} ({line.packed_qty}/{line.accepted_ready_qty} {line.uom})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dispatch-scan-barcode">Barcode</Label>
                      <Input
                        id="dispatch-scan-barcode"
                        value={scanBarcode}
                        onChange={(e) => setScanBarcode(e.target.value)}
                        placeholder="Scan or type barcode"
                        autoFocus
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dispatch-scan-batch">Batch / lot</Label>
                      <Input id="dispatch-scan-batch" value={scanBatchLot} onChange={(e) => setScanBatchLot(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dispatch-scan-qty">Quantity</Label>
                      <Input
                        id="dispatch-scan-qty"
                        type="number"
                        min="0"
                        value={scanQuantity}
                        onChange={(e) => setScanQuantity(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="button" disabled={scanning} onClick={() => void handleScan()}>
                    <ScanLine className="mr-1 h-4 w-4" aria-hidden />
                    {scanning ? "Scanning…" : "Record scan"}
                  </Button>

                  {scanEvents.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground">Recent scans</p>
                      {scanEvents.map((evt) => (
                        <div key={evt.id} className="flex items-center justify-between text-[11px]">
                          <span className="font-mono">{evt.barcode_value}</span>
                          <Badge variant={evt.scan_result === "verified" ? "default" : "destructive"} className="text-[10px]">
                            {evt.scan_result}
                            {evt.reason ? `: ${evt.reason}` : ""}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {cartonItems.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground">Carton contents</p>
                      {cartonItems.map((item) => (
                        <div key={item.id} className="flex justify-between text-[11px]">
                          <span>
                            {item.product_code} ({item.batch_lot})
                          </span>
                          <span className="font-mono">{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-semibold">Evidence</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="dispatch-net-weight">Net weight</Label>
                      <Input id="dispatch-net-weight" type="number" min="0" value={netWeight} onChange={(e) => setNetWeight(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="dispatch-gross-weight">Gross weight</Label>
                      <Input
                        id="dispatch-gross-weight"
                        type="number"
                        min="0"
                        value={grossWeight}
                        onChange={(e) => setGrossWeight(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="dispatch-evidence-photo">Carton photo</Label>
                    <Input
                      id="dispatch-evidence-photo"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => setEvidencePhoto(e.target.files?.[0] ?? null)}
                    />
                    {selectedCarton.open_photo_ref ? (
                      <p className="text-[11px] text-muted-foreground">A photo is already on file for this carton.</p>
                    ) : null}
                  </div>
                  <Button type="button" disabled={recordingEvidence} onClick={() => void handleRecordEvidence()}>
                    {recordingEvidence ? "Recording…" : "Record evidence"}
                  </Button>
                </div>

                <Button
                  type="button"
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                  disabled={locking || LOCKED_CARTON_STATUSES.has(selectedCarton.status)}
                  onClick={() => void handleLockCarton()}
                >
                  <Lock className="mr-1 h-4 w-4" aria-hidden />
                  {LOCKED_CARTON_STATUSES.has(selectedCarton.status)
                    ? "Carton locked"
                    : locking
                      ? "Locking…"
                      : "Lock carton"}
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Dispatch Packing List</CardTitle>
              <CardDescription className="text-xs">
                Calls <code>create_b2b_dispatch_packing_list</code>, <code>supersede_b2b_dispatch_packing_list</code>{" "}
                and <code>submit_b2b_dispatch_packing_list_to_finance</code>. All cartons must be locked before a
                packing list can be generated.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {currentDplVersion ? (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">Version {currentDplVersion.version_number}</p>
                    <Badge variant={currentDplVersion.status === "submitted_to_finance" ? "default" : "outline"}>
                      {currentDplVersion.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Finance check: {currentDplVersion.finance_check_state}
                    {currentDplVersion.submitted_to_finance_at
                      ? ` -- submitted ${new Date(currentDplVersion.submitted_to_finance_at).toLocaleString()}`
                      : ""}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No packing list generated yet for this consignment.</p>
              )}

              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={creatingDpl || workingLoading || !!currentDplVersion}
                  onClick={() => void handleCreateDpl()}
                >
                  {creatingDpl ? "Generating…" : "Create packing list"}
                </Button>
                <Button
                  type="button"
                  className="bg-emerald-600 hover:bg-emerald-700"
                  disabled={submittingDpl || !currentDplVersion || currentDplVersion.status !== "generated"}
                  onClick={() => void handleSubmitDpl()}
                >
                  {submittingDpl ? "Submitting…" : "Submit to Finance"}
                </Button>
              </div>

              {currentDplVersion ? (
                <div className="space-y-2 rounded-lg border p-3">
                  <p className="text-xs font-semibold">Correct this version</p>
                  <Textarea
                    placeholder="Reason for correction (required)"
                    value={supersedeReason}
                    onChange={(e) => setSupersedeReason(e.target.value)}
                  />
                  <Button type="button" variant="outline" disabled={superseding} onClick={() => void handleSupersedeDpl()}>
                    {superseding ? "Correcting…" : "Supersede with a corrected version"}
                  </Button>
                </div>
              ) : null}

              {supersededVersions.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">Superseded history</p>
                  {supersededVersions.map((version) => (
                    <div key={version.id} className="flex items-center justify-between text-[11px]">
                      <span>Version {version.version_number} -- superseded</span>
                      {supersessionReasons.get(version.id) ? (
                        <span className="text-muted-foreground">Reason: {supersessionReasons.get(version.id)}</span>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <ShieldAlert className="h-4 w-4" aria-hidden />
            Select a working consignment above to manage cartons and its packing list.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
