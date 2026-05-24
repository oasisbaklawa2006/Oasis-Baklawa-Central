import { describe, expect, it } from "vitest";
import { CANONICAL_ENTITY_RELATIONSHIPS, outgoingRelationships } from "../entityRelationships";
import { deriveEntityEscalation, maxSeverity } from "../entityEscalation";
import { deriveEntityPriority } from "../entityPriority";
import { demoEntityGraphProjection, projectEntityGraph } from "../entityProjection";
import { entityRef } from "../entityTypes";

describe("entity graph", () => {
  it("defines canonical relationships including order to order_item", () => {
    expect(CANONICAL_ENTITY_RELATIONSHIPS.some((r) => r.from === "order" && r.to === "order_item")).toBe(true);
    expect(CANONICAL_ENTITY_RELATIONSHIPS.some((r) => r.from === "payment" && r.to === "invoice")).toBe(true);
  });

  it("projects deterministic demo graph", () => {
    const g = demoEntityGraphProjection();
    expect(g.nodes.length).toBeGreaterThan(0);
    expect(g.nodes.find((n) => n.ref.type === "order")).toBeDefined();
    expect(g.generatedAt).toBeTruthy();
  });

  it("propagates escalation for finance hold trigger", () => {
    const esc = deriveEntityEscalation("approval_request", "a1", "finance_hold_stale");
    expect(esc?.tier).toBe("department_head");
    expect(esc?.customerImpact).toBe(true);
  });

  it("derives priority from severity and customer impact", () => {
    expect(deriveEntityPriority({ severity: "critical", customerImpact: true })).toBe("critical");
    expect(maxSeverity("low", "high")).toBe("high");
  });

  it("groups relationships for entity type", () => {
    const rels = outgoingRelationships("carton");
    expect(rels.some((r) => r.to === "dispatch")).toBe(true);
  });

  it("builds edges when parent and child nodes exist", () => {
    const g = projectEntityGraph([
      { ref: entityRef("order", "o1"), label: "Order" },
      { ref: entityRef("order_item", "i1"), label: "Item" },
    ]);
    expect(g.edges.length).toBeGreaterThan(0);
  });
});
