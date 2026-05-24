import type { OperationalSearchHit } from "./searchEntityContracts";

const KIND_ORDER: OperationalSearchHit["kind"][] = [
  "so_number",
  "uuid",
  "customer",
  "dispatch",
  "carton",
  "barcode",
  "whatsapp_packet",
  "reservation",
  "invoice",
  "shipment",
  "phone",
];

export function sortSearchHits(hits: OperationalSearchHit[]): OperationalSearchHit[] {
  return [...hits].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a.kind);
    const bi = KIND_ORDER.indexOf(b.kind);
    const ao = ai === -1 ? 99 : ai;
    const bo = bi === -1 ? 99 : bi;
    if (ao !== bo) return ao - bo;
    return a.label.localeCompare(b.label);
  });
}
