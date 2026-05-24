import { cn } from "@/lib/utils";

export type CustomerTimelineStepState = "completed" | "current" | "upcoming";

export interface CustomerTimelineStep {
  id: string;
  /** Customer-safe label (no internal jargon). */
  label: string;
  state: CustomerTimelineStepState;
  /** Optional short subline for the step. */
  caption?: string;
}

const DEFAULT_STEPS: CustomerTimelineStep[] = [
  { id: "placed", label: "Order placed", state: "completed" },
  { id: "finance", label: "Finance verification", state: "current", caption: "Advance or credit checks when applicable." },
  { id: "mfg", label: "Manufacturing", state: "upcoming" },
  { id: "assembly", label: "Assembly", state: "upcoming" },
  { id: "packing", label: "Packing", state: "upcoming" },
  { id: "invoice", label: "Invoice generated", state: "upcoming" },
  { id: "dispatched", label: "Dispatched", state: "upcoming" },
  { id: "transit", label: "In transit", state: "upcoming" },
  { id: "delivered", label: "Delivered", state: "upcoming" },
  { id: "support", label: "10-day support window", state: "upcoming", caption: "Reach support through your usual channel." },
];

export interface CustomerOrderTimelineProps {
  /** Optional override for demos; defaults to a static curated journey. */
  steps?: CustomerTimelineStep[];
  className?: string;
}

/**
 * Curated, customer-safe order journey — no internal operational logs or raw statuses.
 */
export function CustomerOrderTimeline({ steps = DEFAULT_STEPS, className }: CustomerOrderTimelineProps) {
  return (
    <ol className={cn("relative space-y-0 border-l border-border/80 pl-6", className)}>
      {steps.map((s, idx) => (
        <li key={s.id} className="pb-6 last:pb-0">
          <span
            className={cn(
              "absolute -left-[9px] mt-1.5 h-4 w-4 rounded-full border-2 border-background",
              s.state === "completed" && "bg-emerald-500",
              s.state === "current" && "bg-sky-500 ring-2 ring-sky-500/30",
              s.state === "upcoming" && "bg-muted-foreground/30",
            )}
            aria-hidden
          />
          <div className="space-y-0.5">
            <p className={cn("text-sm font-semibold", s.state === "upcoming" && "text-muted-foreground")}>{s.label}</p>
            {s.caption ? <p className="text-xs text-muted-foreground">{s.caption}</p> : null}
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground/80">Step {idx + 1}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
