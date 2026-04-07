export interface ProductionJob {
  id: string;
  order_item_id: string | null;
  order_id: string | null;
  product_id: string | null;
  department: string;
  assigned_to: string | null;
  assigned_qty: number;
  produced_qty: number;
  wasted_qty: number;
  net_weight_per_unit: number;
  batch_number: string | null;
  priority: "normal" | "urgent" | "red";
  stage: "prep" | "processing" | "finishing" | "ready";
  status: string;
  rejection_reason: string | null;
  started_at: string | null;
  completed_at: string | null;
  locked: boolean;
  created_at: string | null;
  updated_at: string | null;
  product?: { name: string; image_url: string | null; sku: string | null } | null;
  order?: { id: string; created_at: string | null; status: string } | null;
}

export interface PauseRecord {
  id: string;
  job_id: string;
  reason: string;
  comment: string | null;
  paused_at: string | null;
  resumed_at: string | null;
}

export interface DepartmentProduct {
  id: string;
  name: string;
  image_url: string | null;
  sku: string | null;
}

export const STAGE_ORDER = ["prep", "processing", "finishing", "ready"] as const;

export const STAGE_LABELS: Record<string, string> = {
  prep: "Prep",
  processing: "Processing",
  finishing: "Finishing",
  ready: "Ready",
};

export const PRIORITY_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  red: { bg: "bg-red-500/20", text: "text-red-600", border: "border-red-500", label: "RED PRIORITY" },
  urgent: { bg: "bg-amber-500/20", text: "text-amber-600", border: "border-amber-500", label: "URGENT" },
  normal: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-300", label: "NORMAL" },
};

export const HOD_DEPARTMENT_MAP: Record<string, string> = {
  HOD_ARABIC: "arabic_sweets",
  HOD_DRAGEES: "dragees",
  HOD_FUSION: "fusion_sweets",
  HOD_CHOCOLATE: "chocolate",
  HOD_BAKERY: "bakery",
  HOD_NUTS: "nuts_mixes",
  HOD_ASSEMBLY: "packing_assembly",
};

export const DEPARTMENTS = [
  { value: "arabic_sweets", label: "Arabic Sweets" },
  { value: "dragees", label: "Dragees" },
  { value: "fusion_sweets", label: "Fusion Sweets" },
  { value: "chocolate", label: "Chocolate" },
  { value: "bakery", label: "Bakery" },
  { value: "nuts_mixes", label: "Nuts & Mixes" },
  { value: "packing_assembly", label: "Packing & Assembly" },
];
