import { isSuppressedInternalLabel } from "@/lib/customer-safe/customerSafeStatus";
import type { OperationalStoreEventRecord } from "@/lib/operational-events/operationalEventTypes";

export function ExecutionEventTimeline({ events }: { events: OperationalStoreEventRecord[] }) {
  return (
    <ul className="max-h-48 space-y-2 overflow-y-auto text-xs">
      {events.map((ev) => {
        const label = `${ev.title} ${ev.message ?? ""}`;
        const staffOnly = isSuppressedInternalLabel(label);
        return (
          <li key={ev.id} className="border-b border-border/50 pb-1">
            <span className="font-medium">{staffOnly ? "[Staff] update" : ev.title}</span>
            <span className="ml-2 text-muted-foreground">{ev.eventType}</span>
            <p className="text-[10px] text-muted-foreground">{new Date(ev.createdAt).toLocaleString()}</p>
          </li>
        );
      })}
      {events.length === 0 ? <li className="text-muted-foreground">No events</li> : null}
    </ul>
  );
}
