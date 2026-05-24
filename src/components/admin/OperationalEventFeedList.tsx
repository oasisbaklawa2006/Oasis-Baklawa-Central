import { format } from "date-fns";
import type { OperationalEventCategory, OperationalEventRecord, OperationalEventSeverity } from "@/lib/operational-events/types";
import { cn } from "@/lib/utils";

function categoryBadgeClass(cat: OperationalEventCategory): string {
  switch (cat) {
    case "financial":
      return "border-emerald-600/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    case "dispatch":
      return "border-sky-600/40 bg-sky-500/10 text-sky-950 dark:text-sky-100";
    case "communication":
      return "border-violet-600/40 bg-violet-500/10 text-violet-950 dark:text-violet-100";
    case "escalation":
      return "border-orange-600/40 bg-orange-500/10 text-orange-950 dark:text-orange-100";
    case "support":
      return "border-amber-600/40 bg-amber-500/10 text-amber-950 dark:text-amber-100";
    case "audit":
      return "border-zinc-600/40 bg-zinc-500/10 text-zinc-900 dark:text-zinc-100";
    case "operational":
    default:
      return "border-border bg-muted text-foreground";
  }
}

function severityCardClass(sev: OperationalEventSeverity): string {
  switch (sev) {
    case "critical":
      return "border border-destructive/40 border-l-4 border-l-destructive bg-destructive/5";
    case "urgent":
      return "border border-orange-500/35 border-l-4 border-l-orange-500 bg-orange-500/5";
    case "warning":
      return "border border-amber-500/35 border-l-4 border-l-amber-500 bg-amber-500/5";
    case "info":
    default:
      return "border border-border border-l-4 border-l-primary/50 bg-card/60";
  }
}

interface Props {
  events: OperationalEventRecord[];
  /** Screen-reader label for the list */
  listLabel?: string;
  className?: string;
}

/**
 * Read-only vertical feed for operational events (mobile-safe, no nested scroll).
 */
export default function OperationalEventFeedList({
  events,
  listLabel = "Operational event feed",
  className,
}: Props) {
  if (events.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Read-only snapshot — not a full audit log. Timestamps appear only when sourced from order columns.
      </p>
      <ul className="space-y-2" role="list" aria-label={listLabel}>
        {events.map((e) => (
          <li
            key={e.id}
            role="listitem"
            className={cn("rounded-md px-3 py-2.5 text-xs shadow-sm", severityCardClass(e.severity))}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex max-w-full rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  categoryBadgeClass(e.category),
                )}
              >
                {e.category}
              </span>
              {e.occurredAt && (
                <time className="text-[10px] text-muted-foreground" dateTime={e.occurredAt}>
                  {format(new Date(e.occurredAt), "MMM d, yyyy · HH:mm")}
                </time>
              )}
            </div>
            <p className="mt-1.5 font-medium text-foreground">{e.title}</p>
            {e.detail && (
              <p className="mt-1 whitespace-pre-wrap break-words text-[11px] leading-snug text-muted-foreground">
                {e.detail}
              </p>
            )}
            <p className="mt-1 text-[10px] text-muted-foreground">
              <span className="font-medium text-foreground/80">{e.actor.displayLabel ?? e.actor.role}</span>
              <span className="mx-1 text-muted-foreground/70">·</span>
              <span className="font-mono text-[10px]">{e.kind}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
