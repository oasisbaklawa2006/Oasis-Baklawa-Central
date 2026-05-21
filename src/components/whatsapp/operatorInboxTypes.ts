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
}
