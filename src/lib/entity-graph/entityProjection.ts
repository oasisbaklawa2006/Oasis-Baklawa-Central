import type { EntityEdge } from "./entityRelationships";
import { CANONICAL_ENTITY_RELATIONSHIPS } from "./entityRelationships";
import type { EntityRef, EntityGraphSnapshot, OperationalEntityNode } from "./entityTypes";
import { entityRef } from "./entityTypes";
import { ownershipForEntityType } from "./entityOwnership";
import { deriveEntityPriority } from "./entityPriority";
import type { EntityReadinessProjection } from "./entityReadiness";
import { readyReadiness } from "./entityReadiness";
import type { OperationalSeverity } from "./entityEscalation";

export interface EntityProjectionInput {
  ref: EntityRef;
  label: string;
  observedAt?: string;
  sourceModule?: string;
  readiness?: EntityReadinessProjection;
  severity?: OperationalSeverity;
  customerImpact?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
}

export interface ProjectedEntityNode extends OperationalEntityNode {
  priorityBand: ReturnType<typeof deriveEntityPriority>;
  readiness: EntityReadinessProjection;
  primaryOwnerRole: string;
}

export interface EntityGraphProjection {
  nodes: ProjectedEntityNode[];
  edges: EntityEdge[];
  generatedAt: string;
}

export function projectEntityNode(input: EntityProjectionInput): ProjectedEntityNode {
  const ownership = ownershipForEntityType(input.ref.type);
  const readiness = input.readiness ?? readyReadiness();
  const priorityBand = deriveEntityPriority({
    severity: input.severity,
    customerImpact: input.customerImpact,
    financeBlocked: input.metadata?.financeBlocked === true,
    dispatchPanic: input.metadata?.dispatchPanic === true,
  });
  return {
    ref: input.ref,
    label: input.label,
    observedAt: input.observedAt,
    sourceModule: input.sourceModule,
    metadata: input.metadata,
    priorityBand,
    readiness,
    primaryOwnerRole: ownership?.primaryOwner ?? "unassigned",
  };
}

export function projectEntityGraph(inputs: EntityProjectionInput[]): EntityGraphProjection {
  const nodes = inputs.map(projectEntityNode);
  const edges: EntityEdge[] = [];
  const idByType = new Map<string, string>();
  for (const n of nodes) {
    idByType.set(`${n.ref.type}:${n.ref.id}`, n.ref.id);
  }
  for (const rel of CANONICAL_ENTITY_RELATIONSHIPS) {
    const fromNodes = nodes.filter((n) => n.ref.type === rel.from);
    const toNodes = nodes.filter((n) => n.ref.type === rel.to);
    for (const from of fromNodes) {
      for (const to of toNodes) {
        edges.push({ relationshipId: rel.id, fromId: from.ref.id, toId: to.ref.id });
      }
    }
  }
  return { nodes, edges, generatedAt: new Date().toISOString() };
}

export function emptyEntityGraphSnapshot(): EntityGraphSnapshot {
  return { nodes: [], generatedAt: new Date().toISOString() };
}

/** Deterministic demo graph for admin explorer — explicit sample refs, not invented DB rows. */
export function demoEntityGraphProjection(): EntityGraphProjection {
  const orderId = "demo-order-001";
  return projectEntityGraph([
    {
      ref: entityRef("order", orderId, "SO-DEMO-001"),
      label: "Demo sales order",
      sourceModule: "projection",
      customerImpact: true,
      metadata: { financeBlocked: true },
      readiness: { state: "blocked", blockers: [{ code: "finance", label: "Finance verification pending" }], summary: "Finance hold" },
    },
    {
      ref: entityRef("order_item", "demo-item-001"),
      label: "Demo line item",
      sourceModule: "projection",
    },
    {
      ref: entityRef("carton", "demo-carton-001", "CTN-DEMO-001"),
      label: "Demo carton",
      sourceModule: "projection",
    },
    {
      ref: entityRef("approval_request", "demo-approval-001"),
      label: "Finance release approval",
      sourceModule: "governance",
      severity: "high",
      customerImpact: true,
    },
    {
      ref: entityRef("whatsapp_packet", "demo-wa-001"),
      label: "WhatsApp context packet",
      sourceModule: "whatsapp",
    },
    {
      ref: entityRef("customer_timeline_projection", `timeline:${orderId}`),
      label: "Customer timeline slice",
      sourceModule: "customer-safe",
    },
  ]);
}
