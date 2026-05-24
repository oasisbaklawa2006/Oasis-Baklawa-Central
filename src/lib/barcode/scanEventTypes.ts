export type BarcodeDomain =
  | "product"
  | "carton"
  | "dispatch"
  | "reservation"
  | "transfer"
  | "pickup";

export interface ScanEventInput {
  id: string;
  domain: BarcodeDomain;
  barcodeText: string;
  /** Monotonic sequence from scanner or client; used for ordering checks only. */
  sequence: number;
}

export type ScanAnomalyKind =
  | "duplicate_scan"
  | "out_of_order_scan"
  | "dispatch_without_finance_release"
  | "carton_mismatch"
  | "damaged_carton"
  | "missing_barcode";
