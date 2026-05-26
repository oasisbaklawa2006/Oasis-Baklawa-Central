const SUPPORT_WINDOW_DAYS = 10;

export function computeSupportWindowEndsAt(deliveredAtIso: string | null): string | null {
  if (!deliveredAtIso) return null;
  const end = new Date(deliveredAtIso);
  end.setDate(end.getDate() + SUPPORT_WINDOW_DAYS);
  return end.toISOString();
}

export function isSupportWindowActive(deliveredAtIso: string | null, nowIso: string): boolean {
  const ends = computeSupportWindowEndsAt(deliveredAtIso);
  if (!ends) return false;
  return new Date(nowIso).getTime() <= new Date(ends).getTime();
}
