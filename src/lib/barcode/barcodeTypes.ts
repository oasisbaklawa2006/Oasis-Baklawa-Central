/**
 * Barcode / label domain types — payload generation only.
 * No device drivers, no print execution, no persistence.
 */

/** Supported thermal label families for this foundation. */
export type ThermalPrinterFamily = "tsc_te244_compatible";

/**
 * Logical label kinds supported by the Label Command Center and payload builders.
 */
export type LabelKind =
  | "product"
  | "carton"
  | "dispatch"
  | "customer_pickup"
  | "reservation"
  | "factory_followup_internal";

/** Version string embedded in payloads for forward compatibility. */
export const LABEL_PAYLOAD_SCHEMA_VERSION = "oasis.label_payload.v1" as const;

export interface LabelPhysicalPreset {
  id: string;
  printerFamily: ThermalPrinterFamily;
  /** Nominal width in millimetres (TSC TE244 common stock). */
  widthMm: number;
  /** Nominal height in millimetres. */
  heightMm: number;
  /** Assumed print resolution (dots per inch) for layout math in downstream drivers. */
  dpi: number;
  /** Approximate printable width in dots at `dpi` (informational). */
  printableWidthDots: number;
  /** Approximate printable height in dots at `dpi` (informational). */
  printableHeightDots: number;
}

export interface LabelPayloadMeta {
  schema: typeof LABEL_PAYLOAD_SCHEMA_VERSION;
  labelKind: LabelKind;
  presetId: string;
  /** Human-readable title for previews. */
  title: string;
}
