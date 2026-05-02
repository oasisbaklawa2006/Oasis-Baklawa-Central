import { motion } from "framer-motion";
import {
  Package, CheckCircle2, Settings, Wrench, Box, FileText, Truck, MapPin, ShieldCheck, Circle,
} from "lucide-react";

export interface TimelineStep {
  key: string;
  label: string;
  icon: React.ElementType;
  description?: string;
}

export const ORDER_TIMELINE_STEPS: TimelineStep[] = [
  { key: "draft", label: "Draft", icon: Package, description: "Cart prepared, awaiting submission." },
  { key: "submitted", label: "Order Placed", icon: Package, description: "Order received by Oasis." },
  { key: "confirmed", label: "Finance Approved", icon: CheckCircle2, description: "Finance verified the SO." },
  { key: "in_production", label: "Production", icon: Settings, description: "Items being manufactured." },
  { key: "assembly", label: "Assembly", icon: Wrench, description: "Assembling components." },
  { key: "packing", label: "Packing", icon: Box, description: "Packing line in progress." },
  { key: "invoice_generated", label: "Invoice Generated", icon: FileText, description: "Tax invoice issued." },
  { key: "dispatched", label: "Dispatched", icon: Truck, description: "Handed over to courier." },
  { key: "in_transit", label: "In Transit", icon: MapPin, description: "On the way to you." },
  { key: "delivered", label: "Delivered", icon: CheckCircle2, description: "Order delivered." },
  { key: "support_window", label: "Support Window", icon: ShieldCheck, description: "10-day post-delivery support." },
];

const STATUS_TO_INDEX: Record<string, number> = {
  draft: 0, cart: 0,
  submitted: 1, pending: 1,
  confirmed: 2, approved: 2,
  in_production: 3, manufacturing: 3, processing: 3,
  assembly: 4,
  packing: 5, packed_ready: 5, cleared_for_dispatch: 5,
  invoice_generated: 6, awaiting_payment: 6, payment_cleared: 6,
  dispatched: 7,
  in_transit: 8,
  delivered: 9, closed: 10,
  support_window: 10,
};

export function getStepIndex(status: string | null | undefined): number {
  if (!status) return 0;
  const k = status.toLowerCase().trim().replace(/[\s-]/g, "_");
  return STATUS_TO_INDEX[k] ?? 0;
}

interface Props {
  status: string;
  /** Optional override label for the current step */
  currentLabel?: string;
  /** Compact mode for embedded contexts */
  compact?: boolean;
  /** Visual variant — neutral admin theme vs. amber public theme */
  variant?: "default" | "amber";
  /** Optional tracking info to render under the Dispatched step */
  tracking?: { number?: string | null; courier?: string | null };
}

const OrderTimeline = ({ status, currentLabel, compact = false, variant = "default", tracking }: Props) => {
  const current = getStepIndex(status);
  const amber = variant === "amber";

  const palette = amber
    ? {
        doneCircle: "bg-amber-500 text-white shadow",
        pendingCircle: "bg-amber-100 text-amber-300",
        ringCurrent: "ring-4 ring-amber-200",
        line: (done: boolean) => (done ? "bg-amber-500" : "bg-amber-200"),
        labelDone: "text-amber-900",
        labelPending: "text-amber-400",
        descColor: "text-amber-600",
        chip: "bg-amber-500 text-white",
      }
    : {
        doneCircle: "bg-primary text-primary-foreground",
        pendingCircle: "bg-muted text-muted-foreground",
        ringCurrent: "ring-2 ring-primary/30 ring-offset-2 ring-offset-background",
        line: (done: boolean) => (done ? "bg-primary" : "bg-border"),
        labelDone: "text-foreground",
        labelPending: "text-muted-foreground",
        descColor: "text-muted-foreground",
        chip: "bg-primary text-primary-foreground",
      };

  const size = compact ? 32 : 38;
  const iconSize = compact ? 14 : 16;

  return (
    <ol className="relative">
      {ORDER_TIMELINE_STEPS.map((step, i) => {
        const isDone = i <= current;
        const isCurrent = i === current;
        const Icon = step.icon;
        return (
          <li key={step.key} className="flex items-start gap-3 sm:gap-4 relative">
            {i < ORDER_TIMELINE_STEPS.length - 1 && (
              <div
                className={`absolute top-[${size}px] w-0.5 h-[calc(100%-6px)] ${palette.line(i < current)}`}
                style={{ left: size / 2 - 1, top: size - 2 }}
                aria-hidden
              />
            )}
            <motion.div
              initial={isCurrent ? { scale: 0.85 } : false}
              animate={isCurrent ? { scale: [0.85, 1.08, 1] } : {}}
              transition={{ duration: 0.45 }}
              className={`relative z-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                isDone ? palette.doneCircle : palette.pendingCircle
              } ${isCurrent ? palette.ringCurrent : ""}`}
              style={{ width: size, height: size }}
            >
              {isDone ? <Icon size={iconSize} /> : <Circle size={iconSize} />}
            </motion.div>
            <div className={`pb-5 min-w-0 flex-1 ${isCurrent ? "pt-0" : "pt-1"}`}>
              <p className={`text-sm font-semibold ${isDone ? palette.labelDone : palette.labelPending}`}>
                {step.label}
              </p>
              {(isCurrent || isDone) && step.description && !compact && (
                <p className={`text-[11px] mt-0.5 ${palette.descColor}`}>{step.description}</p>
              )}
              {isCurrent && (
                <span className={`mt-1 inline-block text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${palette.chip}`}>
                  {currentLabel || "Current"}
                </span>
              )}
              {step.key === "dispatched" && isDone && (tracking?.number || tracking?.courier) && (
                <div className="mt-1.5 bg-muted/60 rounded-lg px-3 py-2 border border-border">
                  {tracking?.number && (
                    <p className="text-[11px] font-semibold text-foreground">
                      LR No: <span className="font-number">{tracking.number}</span>
                    </p>
                  )}
                  {tracking?.courier && (
                    <p className="text-[11px] text-muted-foreground">Transporter: {tracking.courier}</p>
                  )}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default OrderTimeline;
