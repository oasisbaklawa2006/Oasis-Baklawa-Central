/** Governed carton row shape — mirrors b2b_dispatch_cartons SELECT projection. */
export type GovernedCartonRow = {
  id: string;
  consignment_id: string;
  carton_code: string;
  carton_sequence: number;
  status: string;
  net_weight: number | null;
  gross_weight: number | null;
  open_photo_ref: string | null;
  seal_reference: string | null;
  locked_by: string | null;
  locked_at: string | null;
  current_version: number;
};

/** Governed carton item row — mirrors b2b_dispatch_carton_items SELECT projection. */
export type GovernedCartonItemRow = {
  id: string;
  carton_id: string;
  consignment_line_id: string;
  order_item_id: string;
  product_code: string;
  barcode_value: string;
  batch_lot: string;
  quantity: number;
  scanned_at: string;
};

/** Consignment line authority for quantity reconciliation. */
export type GovernedConsignmentLineRow = {
  id: string;
  product_code: string;
  accepted_ready_qty: number;
  packed_qty: number;
};

/** DPL version row — mirrors b2b_dispatch_packing_list_versions SELECT projection. */
export type GovernedDplVersionRow = {
  id: string;
  consignment_id: string;
  version_number: number;
  status: string;
  submitted_to_finance_at: string | null;
  finance_check_state: string;
  superseded_by: string | null;
  generated_at: string;
};

export type PackingContractViolation = {
  code: string;
  message: string;
};

export type PackingContractResult = {
  ok: boolean;
  violations: PackingContractViolation[];
};
