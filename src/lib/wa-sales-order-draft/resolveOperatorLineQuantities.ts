/**
 * Merge parent-owned live edits with localStorage fallback.
 * Parent quantities win on conflict (most recent operator edit).
 */
export function resolveOperatorLineQuantities(args: {
  parentLineQuantities: Record<number, number>;
  storedLineQuantities: Record<number, number>;
}): Record<number, number> {
  return { ...args.storedLineQuantities, ...args.parentLineQuantities };
}
