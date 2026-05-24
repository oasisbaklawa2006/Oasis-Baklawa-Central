import type { EntityRef } from "@/lib/entity-graph/entityTypes";
import type { TimelineVisibilityClass } from "./timelineVisibility";
import { isVisibleToAudience } from "./timelineVisibility";
import type { TimelineAudience } from "./timelineAudience";
import { groupTimelineEvents, type TimelineEventProjection } from "./timelineGrouping";
import { projectTimelineSeverity } from "./timelineSeverity";
import type { OperationalSeverity } from "@/lib/entity-graph/entityEscalation";

export interface RawTimelineEventInput {
  id: string;
  at: string;
  title: string;
  summary?: string;
  visibilityClass: TimelineVisibilityClass;
  severity?: OperationalSeverity;
  group?: string;
  entityRefs?: EntityRef[];
}

export interface OperationalTimelineProjection {
  audience: TimelineAudience;
  events: TimelineEventProjection[];
  groups: ReturnType<typeof groupTimelineEvents>;
  entityRefs: EntityRef[];
  generatedAt: string;
}

export function projectOperationalTimeline(
  audience: TimelineAudience,
  inputs: RawTimelineEventInput[],
): OperationalTimelineProjection {
  const events: TimelineEventProjection[] = [];
  const entityRefs: EntityRef[] = [];

  for (const raw of inputs) {
    if (!isVisibleToAudience(raw.visibilityClass, audience)) continue;
    if (raw.entityRefs) entityRefs.push(...raw.entityRefs);
    const sev = projectTimelineSeverity(raw.severity ?? "low", audience === "customer_safe");
    events.push({
      id: raw.id,
      at: raw.at,
      title: raw.title,
      summary: raw.summary,
      audience: [audience],
      group: raw.group ?? "general",
    });
    void sev;
  }

  return {
    audience,
    events,
    groups: groupTimelineEvents(events),
    entityRefs,
    generatedAt: new Date().toISOString(),
  };
}
