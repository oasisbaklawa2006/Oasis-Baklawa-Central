import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchPacketAutonomyViews,
  type PacketAutonomyView,
} from "@/lib/wa-governance/orderAutonomy";

export function packetIdsNeedingAutonomyFetch(
  packetIds: string[],
  cache: Map<string, PacketAutonomyView>,
  revalidate: boolean,
): string[] {
  const unique = [...new Set(packetIds.filter(Boolean))];
  if (revalidate) return unique;
  return unique.filter((packetId) => !cache.has(packetId));
}

export function pruneAutonomyCache(
  cache: Map<string, PacketAutonomyView>,
  activePacketIds: string[],
): Map<string, PacketAutonomyView> {
  const active = new Set(activePacketIds);
  const next = new Map<string, PacketAutonomyView>();
  for (const [packetId, view] of cache) {
    if (active.has(packetId)) next.set(packetId, view);
  }
  return next;
}

export async function loadPacketAutonomyViewsIncremental(
  supabase: SupabaseClient,
  packetIds: string[],
  cache: Map<string, PacketAutonomyView>,
  revalidate: boolean,
): Promise<Map<string, PacketAutonomyView>> {
  const activeIds = [...new Set(packetIds.filter(Boolean))];
  const base = revalidate ? new Map<string, PacketAutonomyView>() : pruneAutonomyCache(cache, activeIds);
  const toFetch = packetIdsNeedingAutonomyFetch(activeIds, base, revalidate);
  if (toFetch.length === 0) return base;

  const fetched = await fetchPacketAutonomyViews(supabase, toFetch);
  const merged = new Map(base);
  for (const [packetId, view] of fetched) merged.set(packetId, view);
  return merged;
}
