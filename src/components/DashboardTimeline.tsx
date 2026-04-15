import { Package, CheckCircle2, Settings, Wrench, Box, FileText, Truck, MapPin, ShieldCheck, Circle } from "lucide-react";
import { motion } from "framer-motion";

// Color tokens: Past=Grey(muted), Current=Brand Teal(primary), Future=Hazel
const HAZEL = "#8B7355";

const ORDER_STEPS = [
  { key: "submitted", label: "Order Placed", icon: Package },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle2 },
  { key: "in_production", label: "Manufacturing", icon: Settings },
  { key: "assembly", label: "Assembly", icon: Wrench },
  { key: "packing", label: "Packing", icon: Box },
  { key: "invoice_generated", label: "Invoice", icon: FileText },
  { key: "dispatched", label: "Dispatched", icon: Truck },
  { key: "in_transit", label: "In Transit", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
  { key: "support_window", label: "Support", icon: ShieldCheck },
];

function getStepIndex(status: string): number {
  const map: Record<string, number> = {
    submitted: 0, pending: 0,
    confirmed: 1, approved: 1,
    in_production: 2, manufacturing: 2, processing: 2,
    assembly: 3,
    packing: 4, packed_ready: 4,
    invoice_generated: 5,
    dispatched: 6,
    in_transit: 7,
    delivered: 8,
    support_window: 9, closed: 9,
  };
  return map[status?.toLowerCase()] ?? 0;
}

interface Props {
  order: {
    status: string;
    tracking_number?: string | null;
    courier_name?: string | null;
  };
}

const DashboardTimeline = ({ order }: Props) => {
  const currentStep = getStepIndex(order.status);

  return (
    <div className="relative">
      {ORDER_STEPS.map((step, i) => {
        const isPassed = i < currentStep;
        const isCurrent = i === currentStep;
        const isUpcoming = i > currentStep;
        const StepIcon = step.icon;

        // Past = Grey (muted), Current = Brand Teal (primary), Future = Hazel
        const bgColor = isPassed
          ? "bg-muted"
          : isCurrent
            ? "bg-primary"
            : "bg-transparent";

        return (
          <div key={step.key} className="flex items-start gap-4 relative">
            {/* Connector line */}
            {i < ORDER_STEPS.length - 1 && (
              <div
                className="absolute left-[17px] top-[36px] w-0.5 h-[calc(100%-4px)]"
                style={{
                  backgroundColor: isPassed
                    ? "hsl(var(--muted-foreground))"
                    : isCurrent
                      ? "hsl(var(--primary))"
                      : HAZEL,
                }}
              />
            )}
            {/* Step circle */}
            <div
              className={`relative z-10 w-[36px] h-[36px] rounded-full flex items-center justify-center shrink-0 ${bgColor} ${isCurrent ? "ring-2 ring-primary/30 ring-offset-2 ring-offset-background animate-pulse" : ""}`}
              style={isUpcoming ? { border: `2px solid ${HAZEL}` } : {}}
            >
              {isPassed ? (
                <StepIcon size={16} className="text-muted-foreground" />
              ) : isCurrent ? (
                <StepIcon size={16} className="text-primary-foreground" />
              ) : (
                <Circle size={16} style={{ color: HAZEL }} />
              )}
            </div>
            {/* Step label */}
            <div className="pb-5">
              <p
                className={`text-sm font-semibold ${isPassed ? "text-muted-foreground" : isCurrent ? "text-foreground" : ""}`}
                style={isUpcoming ? { color: HAZEL } : {}}
              >
                {step.label}
              </p>
              {isCurrent && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[10px] text-primary font-bold uppercase tracking-wider"
                >
                  Current Status
                </motion.span>
              )}
              {step.key === "dispatched" && (isPassed || isCurrent) && (order.tracking_number || order.courier_name) && (
                <div className="mt-1.5 bg-muted/60 rounded-lg px-3 py-2 border border-border">
                  {order.tracking_number && (
                    <p className="text-[11px] font-semibold text-foreground">
                      LR No: <span className="font-number">{order.tracking_number}</span>
                    </p>
                  )}
                  {order.courier_name && (
                    <p className="text-[11px] text-muted-foreground">Transporter: {order.courier_name}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DashboardTimeline;
