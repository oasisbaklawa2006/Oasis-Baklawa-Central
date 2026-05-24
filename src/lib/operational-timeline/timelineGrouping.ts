import type { TimelineAudience } from "./timelineAudience";

export interface TimelineEventProjection {
  id: string;
  at: string;
  title: string;
  summary?: string;
  audience: TimelineAudience[];
  group: string;
}

export interface TimelineGroup {
  group: string;
  events: TimelineEventProjection[];
}

export function groupTimelineEvents(events: TimelineEventProjection[]): TimelineGroup[] {
  const map = new Map<string, TimelineEventProjection[]>();
  for (const e of events) {
    const list = map.get(e.group) ?? [];
    list.push(e);
    map.set(e.group, list);
  }
  return [...map.entries()]
    .map(([group, groupEvents]) => ({
      group,
      events: [...groupEvents].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()),
    }))
    .sort((a, b) => {
      const aMax = a.events[0]?.at ?? "";
      const bMax = b.events[0]?.at ?? "";
      return new Date(bMax).getTime() - new Date(aMax).getTime();
    });
}
