import type { LabelKind } from "./barcodeTypes";

/** Describes which fields a template expects — used by UI shells and docs only. */
export interface LabelTemplateDescriptor {
  id: string;
  labelKind: LabelKind;
  /** Short operator-facing description. */
  summary: string;
  /** Logical field names expected in payloads (not validated at runtime beyond builders). */
  primaryFields: readonly string[];
}

export const LABEL_TEMPLATES: readonly LabelTemplateDescriptor[] = [
  {
    id: "tpl-product-sku",
    labelKind: "product",
    summary: "Product identity — SKU, name, optional batch placeholder.",
    primaryFields: ["productId", "productName", "sku", "barcodeText"],
  },
  {
    id: "tpl-carton-shipment",
    labelKind: "carton",
    summary: "Carton / inner pack — carton id, destination hint, weight placeholder.",
    primaryFields: ["cartonId", "destinationLabel", "lineItemsSummary"],
  },
  {
    id: "tpl-dispatch-waybill",
    labelKind: "dispatch",
    summary: "Dispatch / vehicle handoff — order ref, transporter placeholder.",
    primaryFields: ["orderId", "dispatchRef", "destinationLabel"],
  },
  {
    id: "tpl-customer-pickup",
    labelKind: "customer_pickup",
    summary: "Customer pickup window — store, pickup slot, reservation ref.",
    primaryFields: ["pickupRef", "storeName", "customerName", "pickupWindow"],
  },
  {
    id: "tpl-reservation-hold",
    labelKind: "reservation",
    summary: "Reservation / prebooking — never implies confirmed stock.",
    primaryFields: ["reservationId", "customerName", "storeName", "productLabel", "qtyDisplay", "pickupDisplay"],
  },
  {
    id: "tpl-factory-followup",
    labelKind: "factory_followup_internal",
    summary: "Internal factory follow-up — department, urgency, needed-by.",
    primaryFields: ["followupId", "department", "urgency", "neededByDisplay", "productLabel"],
  },
] as const;

export function listTemplatesForKind(kind: LabelKind): LabelTemplateDescriptor[] {
  return LABEL_TEMPLATES.filter((t) => t.labelKind === kind);
}
