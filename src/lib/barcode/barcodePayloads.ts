import { LABEL_PAYLOAD_SCHEMA_VERSION, type LabelKind, type LabelPayloadMeta, type LabelPhysicalPreset } from "./barcodeTypes";
import { TSC_TE244_99x38_PRESET } from "./labelPrintPresets";

const DEFAULT_PRESET: LabelPhysicalPreset = TSC_TE244_99x38_PRESET;

function meta(kind: LabelKind, title: string): LabelPayloadMeta {
  return {
    schema: LABEL_PAYLOAD_SCHEMA_VERSION,
    labelKind: kind,
    presetId: DEFAULT_PRESET.id,
    title,
  };
}

/** Product shelf / SKU label — no implied stock quantity unless caller passes display-only strings. */
export function buildProductLabelPayload(input: {
  productId: string;
  productName: string;
  sku: string | null;
  /** Encoded value for Code128 / GS1 data carrier when wired; may be SKU or GTIN string. */
  barcodeText: string;
  preset?: LabelPhysicalPreset;
}): Readonly<Record<string, unknown>> {
  const preset = input.preset ?? DEFAULT_PRESET;
  return {
    meta: meta("product", "Product label"),
    physical: preset,
    productId: input.productId,
    productName: input.productName,
    sku: input.sku,
    barcodeText: input.barcodeText,
    notes: "Payload only — no print execution.",
  } as const;
}

export function buildCartonLabelPayload(input: {
  cartonId: string;
  destinationLabel: string;
  lineItemsSummary: string;
  preset?: LabelPhysicalPreset;
}): Readonly<Record<string, unknown>> {
  const preset = input.preset ?? DEFAULT_PRESET;
  return {
    meta: meta("carton", "Carton label"),
    physical: preset,
    cartonId: input.cartonId,
    destinationLabel: input.destinationLabel,
    lineItemsSummary: input.lineItemsSummary,
    notes: "Payload only — no print execution.",
  } as const;
}

export function buildDispatchLabelPayload(input: {
  orderId: string;
  dispatchRef: string;
  destinationLabel: string;
  preset?: LabelPhysicalPreset;
}): Readonly<Record<string, unknown>> {
  const preset = input.preset ?? DEFAULT_PRESET;
  return {
    meta: meta("dispatch", "Dispatch label"),
    physical: preset,
    orderId: input.orderId,
    dispatchRef: input.dispatchRef,
    destinationLabel: input.destinationLabel,
    notes: "Payload only — no print execution.",
  } as const;
}

export function buildCustomerPickupLabelPayload(input: {
  pickupRef: string;
  storeName: string;
  customerName: string;
  pickupWindow: string;
  preset?: LabelPhysicalPreset;
}): Readonly<Record<string, unknown>> {
  const preset = input.preset ?? DEFAULT_PRESET;
  return {
    meta: meta("customer_pickup", "Customer pickup label"),
    physical: preset,
    pickupRef: input.pickupRef,
    storeName: input.storeName,
    customerName: input.customerName,
    pickupWindow: input.pickupWindow,
    disclaimer: "Pickup time is provisional until operations confirms.",
    notes: "Payload only — no print execution.",
  } as const;
}

/**
 * Reservation label — `qtyDisplay` is a caller-provided string (e.g. operator entry), never an inferred stock count.
 */
export function buildReservationLabelPayload(input: {
  reservationId: string;
  customerName: string;
  storeName: string;
  productLabel: string;
  qtyDisplay: string;
  pickupDisplay: string;
  preset?: LabelPhysicalPreset;
}): Readonly<Record<string, unknown>> {
  const preset = input.preset ?? DEFAULT_PRESET;
  return {
    meta: meta("reservation", "Reservation label"),
    physical: preset,
    reservationId: input.reservationId,
    customerName: input.customerName,
    storeName: input.storeName,
    productLabel: input.productLabel,
    qtyDisplay: input.qtyDisplay,
    pickupDisplay: input.pickupDisplay,
    disclaimer: "Reservation is not guaranteed until stock is manually verified.",
    notes: "Payload only — no print execution.",
  } as const;
}

export function buildFactoryFollowupLabelPayload(input: {
  followupId: string;
  department: string;
  urgency: string;
  neededByDisplay: string;
  productLabel: string;
  storeName: string;
  preset?: LabelPhysicalPreset;
}): Readonly<Record<string, unknown>> {
  const preset = input.preset ?? DEFAULT_PRESET;
  return {
    meta: meta("factory_followup_internal", "Factory follow-up (internal)"),
    physical: preset,
    followupId: input.followupId,
    department: input.department,
    urgency: input.urgency,
    neededByDisplay: input.neededByDisplay,
    productLabel: input.productLabel,
    storeName: input.storeName,
    notes: "Payload only — internal coordination; no automation.",
  } as const;
}
