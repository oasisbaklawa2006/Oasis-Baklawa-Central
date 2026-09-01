import type { Database as GeneratedDatabase, Json } from "./database.types";

/**
 * Backwards-compatible Supabase contract.
 *
 * `database.types.ts` remains the canonical generated snapshot. The operational
 * scan table and Finance/Exit RPCs below are already deployed Core authority but
 * are newer than that snapshot, so they are added here without weakening the
 * client to untyped string/table casts. Remove these supplements after the next
 * canonical generated-type refresh includes them verbatim.
 */
export * from "./database.types";

type OperationalScanRecordsTable = {
  Row: {
    id: string;
    scan_type: string;
    verification_type: string;
    entity_type: string;
    entity_id: string;
    order_id: string | null;
    queue_item_id: string | null;
    barcode_value: string;
    expected_barcode: string | null;
    verification_status: string;
    mismatch_reason: string | null;
    scan_source: string;
    scan_device_id: string | null;
    actor_id: string | null;
    actor_role: string | null;
    actor_department: string | null;
    photo_evidence_url: string | null;
    metadata: Json;
    correlation_id: string;
    idempotency_key: string | null;
    created_at: string;
  };
  Insert: {
    id?: string;
    scan_type: string;
    verification_type: string;
    entity_type: string;
    entity_id: string;
    order_id?: string | null;
    queue_item_id?: string | null;
    barcode_value: string;
    expected_barcode?: string | null;
    verification_status: string;
    mismatch_reason?: string | null;
    scan_source: string;
    scan_device_id?: string | null;
    actor_id?: string | null;
    actor_role?: string | null;
    actor_department?: string | null;
    photo_evidence_url?: string | null;
    metadata?: Json;
    correlation_id: string;
    idempotency_key?: string | null;
    created_at?: string;
  };
  Update: {
    id?: string;
    scan_type?: string;
    verification_type?: string;
    entity_type?: string;
    entity_id?: string;
    order_id?: string | null;
    queue_item_id?: string | null;
    barcode_value?: string;
    expected_barcode?: string | null;
    verification_status?: string;
    mismatch_reason?: string | null;
    scan_source?: string;
    scan_device_id?: string | null;
    actor_id?: string | null;
    actor_role?: string | null;
    actor_department?: string | null;
    photo_evidence_url?: string | null;
    metadata?: Json;
    correlation_id?: string;
    idempotency_key?: string | null;
    created_at?: string;
  };
  Relationships: [];
};

type FinanceExitFunctions = {
  get_finance_exit_facts_v1: {
    Args: { p_order_id: string };
    Returns: Json;
  };
  receive_submitted_b2b_dispatch_dpls_v1: {
    Args: {
      p_order_id: string;
      p_evidence_reference: string;
      p_correlation_id: string;
      p_idempotency_key: string;
      p_actor_id: string;
    };
    Returns: Json;
  };
  issue_final_invoice_v1: {
    Args: {
      p_order_id: string;
      p_pi_id: string;
      p_commercial_version_id: string;
      p_finance_dpl_receipt_id: string;
      p_invoice_number: string;
      p_invoice_date: string;
      p_document_reference: string;
      p_reason: string;
      p_correlation_id: string;
      p_idempotency_key: string;
      p_actor_id: string;
    };
    Returns: Json;
  };
  record_eway_bill_evidence_v1: {
    Args: {
      p_final_invoice_id: string;
      p_status: "VALIDATED" | "NOT_REQUIRED";
      p_eway_bill_number: string | null;
      p_document_reference: string | null;
      p_policy_reason: string;
      p_valid_from: string | null;
      p_valid_until: string | null;
      p_correlation_id: string;
      p_idempotency_key: string;
      p_actor_id: string;
    };
    Returns: Json;
  };
  decide_finance_dispatch_clearance_v1: {
    Args: {
      p_final_invoice_id: string;
      p_decision: "GRANTED" | "DENIED" | "REVOKED";
      p_reason: string;
      p_evidence_reference: string;
      p_correlation_id: string;
      p_idempotency_key: string;
      p_actor_id: string;
    };
    Returns: Json;
  };
  record_dispatch_proof_packet_v1: {
    Args: {
      p_order_id: string;
      p_transport_snapshot: Json;
      p_evidence_references: Json;
      p_dispatched_at: string;
      p_correlation_id: string;
      p_idempotency_key: string;
      p_actor_id: string;
    };
    Returns: Json;
  };
  release_b2b_dispatch_carton_at_gate_v1: {
    Args: { p_carton_id: string; p_scan_evidence_id: string };
    Returns: Json;
  };
};

export type Database = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedDatabase["public"], "Tables" | "Functions"> & {
    Tables: GeneratedDatabase["public"]["Tables"] & {
      operational_scan_records: OperationalScanRecordsTable;
    };
    Functions: GeneratedDatabase["public"]["Functions"] & FinanceExitFunctions;
  };
};
