import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Paperclip } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import type { OperationalEventCategory, OperationalEventRecord } from "@/lib/operational-events/types";

export type OperationalTimelineFilter = "all" | OperationalEventCategory;

type DayBucket = { dayKey: string; dayLabel: string; items: OperationalEventRecord[] };

function bucketDayKey(iso: string | null): { key: string; label: string } {
  if (!iso) return { key: "snapshot", label: "Snapshot (no exact time)" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { key: "snapshot", label: "Snapshot" };
  const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const label = format(d, "EEE · MMM d, yyyy");
  return { key, label };
}

function severityDotClass(sev: OperationalEventRecord["severity"]): string {
  switch (sev) {
    case "critical":
      return "bg-destructive";
    case "urgent":
      return "bg-orange-500";
    case "warning":
      return "bg-amber-500";
    case "info":
    default:
      return "bg-sky-500";
  }
}

function categoryRailTint(cat: OperationalEventCategory): string {
  switch (cat) {
    case "financial":
      return "from-emerald-500/30";
    case "dispatch":
      return "from-sky-500/35";
    case "communication":
      return "from-violet-500/35";
    case "escalation":
      return "from-orange-500/40";
    case "support":
      return "from-amber-500/35";
    case "audit":
      return "from-zinc-500/30";
    case "operational":
    default:
      return "from-slate-500/25";
  }
}

interface OperationalTimelineProps {
  events: OperationalEventRecord[];
  /** Accessible label for the timeline region */
  ariaLabel?: string;
  filter?: OperationalTimelineFilter;
  defaultFilter?: OperationalTimelineFilter;
  onFilterChange?: (f: OperationalTimelineFilter) => void;
  className?: string;
  /** When false, hide filter strip (e.g. embedded narrow column) */
  showFilters?: boolean;
}

const FILTER_OPTIONS: { value: OperationalTimelineFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "operational", label: "Ops" },
  { value: "financial", label: "Finance" },
  { value: "communication", label: "Comms" },
  { value: "escalation", label: "Escalation" },
  { value: "dispatch", label: "Dispatch" },
  { value: "support", label: "Support" },
];

/**
 * Unified operational timeline — chronological, grouped by day, filterable, mobile-safe.
 */
export function OperationalTimeline({
  events,
  ariaLabel = "Operational timeline",
  filter: controlledFilter,
  defaultFilter = "all",
  onFilterChange,
  className,
  showFilters = true,
}: OperationalTimelineProps) {
  const [uncontrolled, setUncontrolled] = useState<OperationalTimelineFilter>(defaultFilter);
  const activeFilter = controlledFilter ?? uncontrolled;
  const setFilter = (v: OperationalTimelineFilter) => {
    if (onFilterChange) onFilterChange(v);
    else setUncontrolled(v);
  };

  const filtered = useMemo(() => {
    if (activeFilter === "all") return events;
    return events.filter((e) => e.category === activeFilter);
  }, [events, activeFilter]);

  const byDay: DayBucket[] = useMemo(() => {
    const map = new Map<string, DayBucket>();
    for (const e of filtered) {
      const { key, label } = bucketDayKey(e.occurredAt);
      if (!map.has(key)) map.set(key, { dayKey: key, dayLabel: label, items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.values()];
  }, [filtered]);

  if (filtered.length === 0) {
    return (
      <div
        className={cn("rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center", className)}
        role="status"
      >
        <p className="text-xs text-muted-foreground">No events for this filter.</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)} role="region" aria-label={ariaLabel}>
      {showFilters ? (
        <ToggleGroup
          type="single"
          value={activeFilter}
          onValueChange={(v) => {
            const next = (v || "all") as OperationalTimelineFilter;
            setFilter(next);
          }}
          className="flex w-full flex-wrap justify-start gap-1"
          variant="outline"
          size="sm"
          aria-label="Timeline category filter"
        >
          {FILTER_OPTIONS.map((opt) => (
            <ToggleGroupItem
              key={opt.value}
              value={opt.value}
              className="h-9 min-h-9 touch-manipulation px-2.5 text-[11px] data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
            >
              {opt.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      ) : null}

      <div className="space-y-6">
        {byDay.map((day) => (
          <section key={day.dayKey} aria-labelledby={`op-day-${day.dayKey}`}>
            <h3 id={`op-day-${day.dayKey}`} className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {day.dayLabel}
            </h3>
            <ol className="relative space-y-0 border-l border-border/80 pl-4">
              {day.items.map((e) => (
                <li key={e.id} className="relative pb-5 last:pb-0">
                  <span
                    className={cn(
                      "absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
                      severityDotClass(e.severity),
                    )}
                    aria-hidden
                  />
                  <div
                    className={cn(
                      "ml-1 rounded-lg border border-border/90 bg-gradient-to-r to-card/80 pl-3 shadow-sm",
                      categoryRailTint(e.category),
                    )}
                  >
                    <div className="flex flex-wrap items-start gap-2 border-l-2 border-transparent py-2 pr-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                            {e.category}
                          </span>
                          {e.occurredAt ? (
                            <time className="text-[10px] text-muted-foreground" dateTime={e.occurredAt}>
                              {format(new Date(e.occurredAt), "HH:mm")}
                            </time>
                          ) : null}
                          {e.hasAttachment ? (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground" title="Attachment heuristic">
                              <Paperclip className="h-3 w-3 shrink-0" aria-hidden />
                              <span className="sr-only">Has attachment hint</span>
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-sm font-medium leading-snug text-foreground">{e.title}</p>
                        {e.detail && e.detail.length > 140 ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-[11px] font-medium text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                              Show full detail
                            </summary>
                            <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                              {e.detail}
                            </p>
                          </details>
                        ) : e.detail ? (
                          <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                            {e.detail}
                          </p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          <span className="font-medium text-foreground/80">{e.actor.displayLabel ?? e.actor.role}</span>
                          <span className="mx-1">·</span>
                          <span className="font-mono">{e.kind}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
