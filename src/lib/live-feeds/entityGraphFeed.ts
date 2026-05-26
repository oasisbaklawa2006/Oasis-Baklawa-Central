import { entityRef } from "@/lib/entity-graph/entityTypes";
import type { EntityProjectionInput } from "@/lib/entity-graph/entityProjection";
import { blockedReadiness, readyReadiness } from "@/lib/entity-graph/entityReadiness";
import type { OperationalFeedContext } from "./feedTypes";
import { isFinanceHoldOrder, isDispatchPanicOrder, soLabel } from "./orderFeedUtils";
import { resolveOperationalDependencies } from "@/lib/dependency-graph/dependencyResolution";

export interface EntityGraphFeedResult {
  nodes: EntityProjectionInput[];
  complaintPlaceholderCount: number;
  warnings: string[];
}

export function buildEntityGraphFeed(ctx: OperationalFeedContext): EntityGraphFeedResult {
  const warnings: string[] = [];
  if (ctx.orderQueryError) {
    return { nodes: [], complaintPlaceholderCount: 0, warnings: [ctx.orderQueryError] };
  }

  const nodes: EntityProjectionInput[] = [];
  const financeBlocked = ctx.orders.some(isFinanceHoldOrder);
  const dep = resolveOperationalDependencies({
    finance: !financeBlocked,
    production: !financeBlocked,
    assembly: false,
    dispatch: false,
    scan: false,
    invoice: !financeBlocked,
    shipment: false,
    reservation: false,
    inventory_verification: false,
  });

  for (const o of ctx.orders.slice(0, 40)) {
    const finHold = isFinanceHoldOrder(o);
    nodes.push({
      ref: entityRef("order", o.id, soLabel(o.id)),
      label: `${soLabel(o.id)} · ${o.company_name ?? "Customer"}`,
      sourceModule: "orders",
      customerImpact: true,
      metadata: { financeBlocked: finHold, dispatchPanic: isDispatchPanicOrder(o) },
      readiness: finHold
        ? blockedReadiness([{ code: "finance", label: "Finance verification pending" }])
        : readyReadiness(),
      severity: isDispatchPanicOrder(o) ? "critical" : finHold ? "high" : "low",
    });

    if (o.company_id) {
      nodes.push({
        ref: entityRef("customer_timeline_projection", `customer:${o.company_id}`, o.company_name),
        label: o.company_name ?? "Customer",
        sourceModule: "companies",
      });
    }

    if (finHold) {
      nodes.push({
        ref: entityRef("approval_request", `finance:${o.id}`),
        label: `Finance review · ${soLabel(o.id)}`,
        sourceModule: "finance",
        severity: "high",
        customerImpact: true,
      });
      nodes.push({
        ref: entityRef("invoice", `invoice:${o.id}`),
        label: `Invoice lane · ${soLabel(o.id)}`,
        sourceModule: "finance",
      });
      nodes.push({
        ref: entityRef("payment", `payment:${o.id}`),
        label: `Payment lane · ${soLabel(o.id)}`,
        sourceModule: "finance",
      });
    }

    if (isDispatchPanicOrder(o) || ["cleared_for_dispatch", "packed_ready", "dispatched", "in_transit"].includes((o.status || "").toLowerCase())) {
      nodes.push({
        ref: entityRef("dispatch", `dispatch:${o.id}`),
        label: `Dispatch · ${soLabel(o.id)}`,
        sourceModule: "dispatch",
        severity: isDispatchPanicOrder(o) ? "critical" : "medium",
      });
      nodes.push({
        ref: entityRef("shipment", `shipment:${o.id}`),
        label: `Shipment · ${soLabel(o.id)}`,
        sourceModule: "dispatch",
      });
    }

    if (["manufacturing", "in_production", "submitted"].includes((o.status || "").toLowerCase())) {
      nodes.push({
        ref: entityRef("factory_followup", `production:${o.id}`),
        label: `Production · ${soLabel(o.id)}`,
        sourceModule: "production",
      });
    }

    if (["assembly", "partial_ready", "packed_ready"].includes((o.status || "").toLowerCase())) {
      nodes.push({
        ref: entityRef("carton", `carton:${o.id}`),
        label: `Assembly / carton · ${soLabel(o.id)}`,
        sourceModule: "assembly",
      });
    }

    if ((o.status || "").toLowerCase() === "packed_ready") {
      nodes.push({
        ref: entityRef("inventory_snapshot", `inv:${o.id}`),
        label: `Ready goods · ${soLabel(o.id)}`,
        sourceModule: "inventory",
      });
    }

    if (o.needs_clarification) {
      nodes.push({
        ref: entityRef("order_item", `3p:${o.id}`),
        label: `Third-party clarification · ${soLabel(o.id)}`,
        sourceModule: "third_party",
      });
    }

    if (o.has_complaint) {
      nodes.push({
        ref: entityRef("notification", `ticket:${o.id}`),
        label: `Support ticket · ${soLabel(o.id)}`,
        sourceModule: "support_tickets",
      });
    }
  }

  if (dep.rootBlocker) {
    warnings.push(dep.escalationRecommendation);
  }
  const complaintPlaceholderCount = ctx.orders.filter((o) => o.has_complaint).length;

  return { nodes, complaintPlaceholderCount, warnings };
}
