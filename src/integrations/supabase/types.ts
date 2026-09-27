import type { Database as GeneratedDatabase, Json } from "./database.types";

type FinanceReviewEvidenceTable = {
  Row: {
    id: string;
    order_id: string;
    review_type: string;
    review_status: string;
    evidence_type: string;
    evidence_ref: string | null;
    utr_ref: string | null;
    amount: number | null;
    currency: string | null;
    actor_id: string | null;
    actor_role: string | null;
    actor_department: string | null;
    override_reason: string | null;
    correlation_id: string;
    metadata: Json;
    created_at: string;
  };
  Insert: {
    id?: string;
    order_id: string;
    review_type: string;
    review_status: string;
    evidence_type: string;
    evidence_ref?: string | null;
    utr_ref?: string | null;
    amount?: number | null;
    currency?: string | null;
    actor_id?: string | null;
    actor_role?: string | null;
    actor_department?: string | null;
    override_reason?: string | null;
    correlation_id: string;
    metadata?: Json;
    created_at?: string;
  };
  Update: {
    id?: string;
    order_id?: string;
    review_type?: string;
    review_status?: string;
    evidence_type?: string;
    evidence_ref?: string | null;
    utr_ref?: string | null;
    amount?: number | null;
    currency?: string | null;
    actor_id?: string | null;
    actor_role?: string | null;
    actor_department?: string | null;
    override_reason?: string | null;
    correlation_id?: string;
    metadata?: Json;
    created_at?: string;
  };
  Relationships: [];
};

type InventoryReservationsTable = {
  Row: {
    id: string;
    reservation_number: string;
    order_id: string;
    queue_item_id: string | null;
    customer_id: string | null;
    product_id: string;
    sku: string;
    requested_qty: number;
    reserved_qty: number;
    fulfilled_qty: number;
    released_qty: number;
    reservation_status: string;
    reservation_priority: string;
    source_department: string | null;
    reserved_by: string | null;
    approved_by: string | null;
    expires_at: string | null;
    notes: string | null;
    correlation_id: string;
    version: number;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    reservation_number: string;
    order_id: string;
    queue_item_id?: string | null;
    customer_id?: string | null;
    product_id: string;
    sku: string;
    requested_qty: number;
    reserved_qty?: number;
    fulfilled_qty?: number;
    released_qty?: number;
    reservation_status: string;
    reservation_priority?: string;
    source_department?: string | null;
    reserved_by?: string | null;
    approved_by?: string | null;
    expires_at?: string | null;
    notes?: string | null;
    correlation_id: string;
    version?: number;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    id?: string;
    reservation_number?: string;
    order_id?: string;
    queue_item_id?: string | null;
    customer_id?: string | null;
    product_id?: string;
    sku?: string;
    requested_qty?: number;
    reserved_qty?: number;
    fulfilled_qty?: number;
    released_qty?: number;
    reservation_status?: string;
    reservation_priority?: string;
    source_department?: string | null;
    reserved_by?: string | null;
    approved_by?: string | null;
    expires_at?: string | null;
    notes?: string | null;
    correlation_id?: string;
    version?: number;
    created_at?: string;
    updated_at?: string;
  };
  Relationships: [];
};

/** Operator inbox contact projection — Core `whatsapp_contacts` (schema introspection §2). */
type WhatsappContactsTable = {
  Row: {
    id: string;
    phone_number: string | null;
    customer_name: string | null;
    wa_contact_id: string | null;
  };
  Insert: {
    id?: string;
    phone_number?: string | null;
    customer_name?: string | null;
    wa_contact_id?: string | null;
  };
  Update: {
    id?: string;
    phone_number?: string | null;
    customer_name?: string | null;
    wa_contact_id?: string | null;
  };
  Relationships: [];
};

/** Operator inbox packet projection — Core `whatsapp_message_packets` (schema introspection §2). */
type WhatsappMessagePacketsTable = {
  Row: {
    id: string;
    contact_id: string;
    fragment_count: number;
    status: string;
    first_message_at: string;
    last_message_at: string;
    stitched_content: Json;
    created_at: string | null;
  };
  Insert: {
    id?: string;
    contact_id: string;
    fragment_count?: number;
    status?: string;
    first_message_at?: string;
    last_message_at?: string;
    stitched_content?: Json;
    created_at?: string | null;
  };
  Update: {
    id?: string;
    contact_id?: string;
    fragment_count?: number;
    status?: string;
    first_message_at?: string;
    last_message_at?: string;
    stitched_content?: Json;
    created_at?: string | null;
  };
  Relationships: [
    {
      foreignKeyName: "whatsapp_message_packets_contact_id_fkey";
      columns: ["contact_id"];
      isOneToOne: false;
      referencedRelation: "whatsapp_contacts";
      referencedColumns: ["id"];
    },
  ];
};

/** Operator inbox message projection — Core `whatsapp_messages` (schema introspection §2). */
type WhatsappMessagesTable = {
  Row: {
    id: string;
    content: string | null;
    message_type: string | null;
    direction: string;
    created_at: string | null;
    packet_sequence: number | null;
    status: string | null;
    provider: string | null;
    provider_message_id: string | null;
    media_url: string | null;
    packet_id: string | null;
  };
  Insert: {
    id?: string;
    content?: string | null;
    message_type?: string | null;
    direction: string;
    created_at?: string | null;
    packet_sequence?: number | null;
    status?: string | null;
    provider?: string | null;
    provider_message_id?: string | null;
    media_url?: string | null;
    packet_id?: string | null;
  };
  Update: {
    id?: string;
    content?: string | null;
    message_type?: string | null;
    direction?: string;
    created_at?: string | null;
    packet_sequence?: number | null;
    status?: string | null;
    provider?: string | null;
    provider_message_id?: string | null;
    media_url?: string | null;
    packet_id?: string | null;
  };
  Relationships: [
    {
      foreignKeyName: "fk_whatsapp_messages_packet_id";
      columns: ["packet_id"];
      isOneToOne: false;
      referencedRelation: "whatsapp_message_packets";
      referencedColumns: ["id"];
    },
  ];
};

/**
 * Backwards-compatible Supabase contract.
 *
 * `database.types.ts` remains the canonical generated snapshot. The operational
 * scan table, Finance/Exit RPCs, and WhatsApp inbox tables below are already
 * deployed Core authority but are newer than that snapshot, so they are added
 * here without weakening the client to untyped string/table casts. Remove these
 * supplements after the next canonical generated-type refresh includes them verbatim.
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
      finance_review_evidence: FinanceReviewEvidenceTable;
      inventory_reservations: InventoryReservationsTable;
      whatsapp_contacts: WhatsappContactsTable;
      whatsapp_message_packets: WhatsappMessagePacketsTable;
      whatsapp_messages: WhatsappMessagesTable;
    };
    Functions: GeneratedDatabase["public"]["Functions"] & FinanceExitFunctions;
  };
};
