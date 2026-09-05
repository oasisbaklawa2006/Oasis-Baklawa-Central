/**
 * POINT71 — static census of Central order-pool / list / queue routes.
 * Compatibility aliases are consolidated into the canonical hub or governed deep links.
 */
export type CentralOrderPoolRouteDisposition = "canonical" | "governed_deep_link" | "compatibility_redirect";

export type CentralOrderPoolRouteEntry = {
  path: string;
  disposition: CentralOrderPoolRouteDisposition;
  authority: string;
  notes: string;
};

export const CENTRAL_ORDER_POOL_ROUTE_CENSUS: CentralOrderPoolRouteEntry[] = [
  {
    path: "/admin/central-pool",
    disposition: "canonical",
    authority: "CentralOrderPoolCommandCentre",
    notes: "Single read-only composition hub; links into governed intake and execution lenses.",
  },
  {
    path: "/admin/orders",
    disposition: "compatibility_redirect",
    authority: "CentralOrderPoolCommandCentre",
    notes: "Legacy general order list retired; redirects to the canonical hub.",
  },
  {
    path: "/admin/order-management",
    disposition: "governed_deep_link",
    authority: "OrderManagement",
    notes: "Governed order pipeline and status transitions via order authority RPCs.",
  },
  {
    path: "/admin/operator-inbox",
    disposition: "governed_deep_link",
    authority: "OperatorInbox",
    notes: "Canonical WhatsApp / suggested-order intake review.",
  },
  {
    path: "/admin/whatsapp",
    disposition: "governed_deep_link",
    authority: "OperatorInbox",
    notes: "Governed WhatsApp intake review surface.",
  },
  {
    path: "/admin/cmd-war-room",
    disposition: "compatibility_redirect",
    authority: "CentralOrderPoolCommandCentre",
    notes: "Retired CMD alias; redirects to the canonical order pool hub.",
  },
  {
    path: "/admin/store-coordination",
    disposition: "governed_deep_link",
    authority: "StoreCoordination",
    notes: "Store transfer and coordination queue.",
  },
  {
    path: "/admin/label-command-center",
    disposition: "governed_deep_link",
    authority: "LabelCommandCenter",
    notes: "Label printing and carton labelling work queue.",
  },
  {
    path: "/admin/execution/third-party",
    disposition: "governed_deep_link",
    authority: "ThirdPartyExecutionBoard",
    notes: "Third-party execution board.",
  },
  {
    path: "/admin/accounts-release",
    disposition: "governed_deep_link",
    authority: "AdminAccountsRelease",
    notes: "Finance account release queue.",
  },
  {
    path: "/admin/exceptions",
    disposition: "governed_deep_link",
    authority: "AdminExceptions",
    notes: "Commercial and operational exceptions.",
  },
];

export const CENTRAL_ORDER_POOL_CANONICAL_ROUTE = "/admin/central-pool";
