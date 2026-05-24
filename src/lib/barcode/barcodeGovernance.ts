/**
 * Barcode governance — which domains require dual control before acting (design-time only).
 */

import type { BarcodeDomain } from "./scanEventTypes";

const DUAL_CONTROL: BarcodeDomain[] = ["dispatch", "reservation", "transfer"];

export function barcodeDomainRequiresDualControl(domain: BarcodeDomain): boolean {
  return DUAL_CONTROL.includes(domain);
}
