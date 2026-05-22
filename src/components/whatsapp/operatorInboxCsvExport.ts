import type { OperatorInboxPacket } from "./operatorInboxTypes";
import {
  inferLocalIntentFromText,
  packetAgeBucket,
  packetSlaUiMeta,
  packetStitchedPlainText,
} from "./operatorInboxUtils";

function csvCell(value: string): string {
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * CSV for the **currently visible** packet rows (already-loaded fields only).
 * No network; safe for client-side download.
 */
export function buildVisiblePacketsCsv(packets: OperatorInboxPacket[]): string {
  const headers = [
    "packet_id",
    "sender_company_display",
    "phone_number",
    "packet_status",
    "sla_bucket_label",
    "sla_bucket_range",
    "message_count",
    "last_message_at_iso",
    "local_intent_bucket",
  ];
  const lines = [headers.join(",")];
  for (const p of packets) {
    const intent = inferLocalIntentFromText(packetStitchedPlainText(p.stitched_content));
    const ageKey = packetAgeBucket(p.last_message_at);
    const sla = packetSlaUiMeta(ageKey);
    const count = p.messages?.length ?? 0;
    lines.push(
      [
        csvCell(p.id),
        csvCell(p.customer_name ?? ""),
        csvCell(p.phone_number ?? ""),
        csvCell(p.status ?? ""),
        csvCell(sla.title),
        csvCell(sla.range),
        csvCell(String(count)),
        csvCell(p.last_message_at ?? ""),
        csvCell(intent.label),
      ].join(","),
    );
  }
  return lines.join("\n");
}

export function downloadOperatorInboxCsv(filename: string, csv: string): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  a.click();
  URL.revokeObjectURL(url);
}
