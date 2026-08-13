/** Shared shapes for operator inbox presentational pieces. */

export interface Message {
  id: string;
  content: string | null;
  message_type: string;
  direction: "inbound" | "outbound";
  created_at: string | null;
  packet_sequence: number | null;
  /** Present when selected in PostgREST (optional for backward compat). */
  status?: string | null;
  provider?: string | null;
  provider_message_id?: string | null;
  /** Present when loading messages via batched `.in('packet_id', …)` selects. */
  packet_id?: string | null;
}

/** Packet row shape for the operator inbox; mutations use governed Edge/Core contracts only. */
export interface OperatorInboxPacket {
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
