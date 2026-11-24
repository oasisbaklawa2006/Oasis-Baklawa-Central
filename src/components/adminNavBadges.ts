/** The pending B2B application count belongs to the Clients queue only. */
export const CLIENTS_ROUTE = "/admin/clients";

/**
 * `moduleKey: "clients"` is shared by several Governance links (for example Gifting enquiries), so the badge
 * must be keyed on the route, not the module, or the B2B count would point administrators at the wrong queue.
 */
export function showsPendingApplicationBadge(to: string, pendingApplications: number): boolean {
  return to === CLIENTS_ROUTE && pendingApplications > 0;
}
