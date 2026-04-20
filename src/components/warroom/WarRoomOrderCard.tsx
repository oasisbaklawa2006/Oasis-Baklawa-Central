import { useMemo } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, Eye, Package, Truck, CheckCircle2, Clock, CreditCard, ShieldCheck, Factory, Box, Hammer, FileText, HeartHandshake } from "lucide-react";
import { normalizeOrderStatus } from "@/utils/orderStatus";

const IST_OFFSET = 5.5 * 3600000;

function relativeTimeIST(dateStr: string | null): string {
  if (!dateStr) return "—";
  const nowUtc = Date.now();
  const createdUtc = new Date(dateStr).getTime();
  const diffMs = nowUtc - createdUtc;
  if (diffMs < 0) return "Just now";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ${mins % 60}m ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

const STEPS = [
  { key: "draft", label: "Cart / Draft", statuses: ["draft", "cart"], icon: Package },
  { key: "finance", label: "Finance", statuses: ["submitted", "confirmed", "approved"], icon: CreditCard },
  { key: "production", label: "Production", statuses: ["manufacturing", "in_production"], icon: Factory },
  { key: "assembly", label: "Assembly", statuses: ["assembly"], icon: Hammer },
  { key: "packing", label: "Packing", statuses: ["packing", "packed_ready"], icon: Box },
  { key: "billing", label: "Billing", statuses: ["invoice_generated", "awaiting_payment", "payment_cleared"], icon: FileText },
  { key: "security", label: "Dispatch", statuses: ["dispatched", "in_transit"], icon: Truck },
  { key: "support", label: "Delivered", statuses: ["delivered"], icon: HeartHandshake },
];

function getActiveStep(status: string) {
  const s = normalizeOrderStatus(status).replace(/[\s-]/g, "_");
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].statuses.includes(s)) return i;
  }
  return 0;
}

interface OrderItem {
  quantity: number;
  product_name?: string;
}

interface Order {
  id: string;
  status: string;
  created_at: string | null;
  sales_order_value: number | null;
  dispatch_urgency: string | null;
  company_id: string | null;
  company_name?: string;
  has_complaint?: boolean;
  items?: OrderItem[];
  total_weight_kg?: number | null;
  needs_clarification?: boolean | null;
  is_duplicate?: boolean | null;
  duplicate_of_order_id?: string | null;
}

interface Props {
  order: Order;
  isMinimized: boolean;
  onToggleMinimize: () => void;
  onValidateAsUnique?: () => void;
}

export default function WarRoomOrderCard({ order, isMinimized, onToggleMinimize, onValidateAsUnique }: Props) {
  const activeStep = getActiveStep(order.status);
  const isPanic = order.dispatch_urgency === "panic";
  const isComplaint = order.has_complaint;
  const isAmbiguous = !!order.needs_clarification;
  const isDuplicate = !!order.is_duplicate || order.status === "potential_duplicate";
  const timeAgo = relativeTimeIST(order.created_at);

  const tierColor = useMemo(() => {
    if (!order.created_at) return "bg-muted text-muted-foreground";
    const hours = (Date.now() - new Date(order.created_at).getTime()) / 3600000;
    if (hours >= 6) return "bg-red-600 text-white animate-pulse";
    if (hours >= 4) return "bg-amber-500/20 text-amber-600 border border-amber-400/40";
    return "bg-muted text-muted-foreground";
  }, [order.created_at]);

  return (
    <div
      className={`rounded-xl border p-4 transition-all
        ${isComplaint ? "bg-red-500/5 border-red-500/40"
          : isAmbiguous ? "bg-orange-500/5 border-orange-500/50 ring-1 ring-orange-400/40"
          : isPanic ? "border-violet-500/60 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
          : "bg-card border-border"}
        ${isPanic ? "animate-pulse" : ""}
      `}
      style={isPanic ? { animationDuration: "2s" } : undefined}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`inline-flex items-center justify-center min-w-[3.5rem] px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none ${tierColor}`}>
            {timeAgo}
          </span>
          <div className="min-w-0">
            <span className="text-sm font-bold text-foreground">#{order.id.slice(0, 8).toUpperCase()}</span>
            <span className="ml-2 text-xs text-muted-foreground truncate">{order.company_name}</span>
          </div>
          {isPanic && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-full">
              <AlertTriangle size={10} /> PANIC
            </span>
          )}
          {isComplaint && (
            <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full">🚨 COMPLAINT</span>
          )}
          {isAmbiguous && (
            <span className="text-[10px] font-bold text-orange-600 bg-orange-500/10 border border-orange-400/40 px-2 py-0.5 rounded-full">
              ⚠ AWAITING CLARIFICATION
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {order.total_weight_kg && order.total_weight_kg > 0 ? (
            <span className="text-sm font-bold text-foreground">
              {order.total_weight_kg.toLocaleString("en-IN", { maximumFractionDigits: 2 })} kg
            </span>
          ) : (
            <span className="text-sm font-semibold text-foreground">₹{(order.sales_order_value ?? 0).toLocaleString("en-IN")}</span>
          )}
          <button onClick={onToggleMinimize} className="text-muted-foreground hover:text-foreground transition-colors">
            {isMinimized ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Order items preview */}
          {order.items && order.items.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-1">
              {order.items.slice(0, 5).map((item, i) => (
                <span key={i} className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                  {item.product_name || "SKU"} × {item.quantity}
                </span>
              ))}
              {order.items.length > 5 && (
                <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">+{order.items.length - 5} more</span>
              )}
            </div>
          )}

          {/* Lifecycle Steps with Icons */}
          <div className="flex items-center gap-0 overflow-x-auto pb-1">
            {STEPS.map((step, i) => {
              const isActive = i === activeStep;
              const isCompleted = i < activeStep;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex items-center">
                  <div
                    className={`flex flex-col items-center min-w-[72px] px-1.5 py-2 rounded-lg text-center transition-all
                      ${isActive ? "bg-primary/10 ring-1 ring-primary/30" : isCompleted ? "opacity-50" : "opacity-30"}
                    `}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center mb-1
                        ${isActive ? "bg-primary text-primary-foreground animate-pulse" : isCompleted ? "bg-muted-foreground/30 text-background" : "bg-[hsl(30,30%,60%)] text-white/70"}
                      `}
                    >
                      {isCompleted ? <CheckCircle2 size={14} /> : <Icon size={14} />}
                    </div>
                    <span className={`text-[9px] font-medium leading-tight ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {step.label}
                    </span>
                    {isActive && (
                      <span className="mt-0.5 text-[8px] font-semibold text-primary bg-primary/5 px-1 py-0.5 rounded">CURRENT</span>
                    )}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-3 h-[2px] ${i < activeStep ? "bg-muted-foreground/30" : "bg-border"}`} />
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
