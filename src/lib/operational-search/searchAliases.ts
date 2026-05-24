import type { OperationalSearchKind } from "./searchEntityContracts";

/** Normalized aliases for operator search — no network. */
export const SEARCH_QUERY_ALIASES: Record<string, OperationalSearchKind> = {
  so: "so_number",
  order: "so_number",
  po: "so_number",
  wa: "whatsapp_packet",
  whatsapp: "whatsapp_packet",
  pkt: "whatsapp_packet",
  ctn: "carton",
  carton: "carton",
  inv: "invoice",
  dispatch: "dispatch",
  res: "reservation",
  ship: "shipment",
};

export function inferSearchKindFromQuery(query: string): OperationalSearchKind | null {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return null;
  const prefix = trimmed.split(/[:\s]/)[0];
  if (SEARCH_QUERY_ALIASES[prefix]) return SEARCH_QUERY_ALIASES[prefix];
  if (/^\+?\d{10,}$/.test(trimmed.replace(/\s/g, ""))) return "phone";
  if (/^so[-#]?/i.test(trimmed)) return "so_number";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) return "uuid";
  return null;
}
